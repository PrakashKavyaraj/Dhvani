"""
AEGIS VOICE Adapter.

Integrates the official AASIST-L (Audio Anti-Spoofing using Integrated Spectro-Temporal
Graph Attention Networks) deepfake detection model and robust multi-window pooling.

Provides a clean, modular adapter layer (AegisAdapter) conforming to the standardized
AegisResult Pydantic schema without mutating existing API or frontend contracts.
"""

import math
import os
import sys
import time
import uuid
import wave
from pathlib import Path
from threading import RLock
from typing import Any, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn.functional as F

from app.integrations.aasist_model import AASISTModel, AASIST_L_CONFIG
from app.integrations.robust_spoof import compute_robust_spoof_evidence
from app.schemas.aegis_schema import (
    AegisResult,
    AudioMetrics,
    ConversationRisk,
    DecisionEvidence,
    ReplayEvidence,
    SpeakerIdentity,
    TemporalRisk,
    VoiceAuthenticity,
)


class AegisAdapter:
    """
    AEGIS Inference Adapter.
    Executes AASIST-L acoustic spoofing inference across temporal sliding windows.
    Enforces strict checkpoint validation: fails loudly if the trained weights are absent.
    """

    DEFAULT_CHECKPOINT_PATH = Path(__file__).resolve().parent.parent.parent / "models" / "weights" / "AASIST-L.pth"
    WINDOW_LEN = 64600  # ~4.0375s at 16 kHz
    HOP_LEN = 32300     # 50% overlap

    def __init__(self, checkpoint_path: Optional[Union[str, Path]] = None):
        if checkpoint_path is not None:
            self.checkpoint_path = Path(checkpoint_path)
        else:
            self.checkpoint_path = self.DEFAULT_CHECKPOINT_PATH

        self._model: Optional[AASISTModel] = None
        self._load_model()

    def _load_model(self) -> None:
        """
        Instantiates AASIST-L and strictly loads trained PyTorch weights.
        FAILS LOUDLY if checkpoint is missing or corrupt. Never runs with random weights.
        """
        if not self.checkpoint_path.is_file():
            raise FileNotFoundError(
                f"AASIST-L checkpoint not found at: {self.checkpoint_path}. "
                f"AegisAdapter strictly requires official trained weights. "
                f"Ensure 'AASIST-L.pth' is placed in backend/models/weights/."
            )

        # Instantiate official AASIST-L architecture
        self._model = AASISTModel(AASIST_L_CONFIG)
        self._model.eval()

        try:
            checkpoint = torch.load(
                str(self.checkpoint_path),
                map_location="cpu",
                weights_only=False,
            )
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            # Strict loading: must match all 229 keys exactly
            self._model.load_state_dict(state_dict, strict=True)
        except Exception as exc:
            self._model = None
            raise RuntimeError(
                f"Failed to load AASIST-L checkpoint from '{self.checkpoint_path}': {exc}"
            ) from exc

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def analyze(
        self,
        audio_path: Union[str, Path],
        prepared_audio=None,
        session_id: Optional[str] = None,
    ) -> AegisResult:
        """
        Executes AASIST-L inference over temporal sliding windows and produces
        a standardized AegisResult.

        Args:
            audio_path: Path to the target WAV audio file.
            prepared_audio: Optional domain PreparedAudio object (unused in this stage).
            session_id: Optional persistent session identifier.

        Returns:
            AegisResult adhering to the AEGIS Pydantic contract.
        """
        if self._model is None:
            raise RuntimeError("AegisAdapter model is not loaded.")

        path = Path(audio_path)
        if not path.is_file():
            raise FileNotFoundError(f"Audio file not found: {path}")

        resolved_session_id = session_id or f"aegis-{uuid.uuid4().hex[:12]}"

        # 1. Load, downmix to mono, and resample to 16 kHz
        samples, duration = self._load_and_resample(path, target_sr=16000)

        # 2. Slice audio into 64,600-sample sliding windows
        windows = self._create_sliding_windows(samples)

        # 3. Execute AASIST-L CPU inference across windows
        t_start = time.perf_counter()
        per_window_spoof_scores: List[float] = []

        with torch.no_grad():
            for win in windows:
                tensor_win = torch.from_numpy(win).float().unsqueeze(0)  # (1, 64600)
                _, output = self._model(tensor_win)
                # Output logits shape (1, 2): index 0 = spoof, index 1 = bona_fide
                probs = F.softmax(output, dim=-1)[0]
                spoof_prob = float(probs[0].item())
                per_window_spoof_scores.append(round(spoof_prob, 4))

        inference_time_ms = (time.perf_counter() - t_start) * 1000.0

        # 4. Compute distinct current window vs. robust persistent evidence
        current_score, persistent_evidence, reliability = compute_robust_spoof_evidence(
            per_window_spoof_scores,
            duration,
        )

        # 5. Compile explainability evidence
        evidence_list: List[str] = []
        if persistent_evidence >= 0.70:
            evidence_list.append("Persistent synthetic/spoofing evidence across temporal windows")
        elif persistent_evidence <= 0.30:
            evidence_list.append("Acoustic phonation characteristics consistent with natural vocal tract")
        else:
            evidence_list.append("Ambiguous acoustic boundary; secondary verification recommended")

        # 6. Construct standardized AegisResult
        return AegisResult(
            session_id=resolved_session_id,
            audio=AudioMetrics(
                duration=round(duration, 2),
                quality=1.0,
            ),
            voice_authenticity=VoiceAuthenticity(
                current_spoof_score=current_score,
                persistent_spoof_evidence=persistent_evidence,
                reliability=reliability,
                windows_analyzed=len(windows),
            ),
            speaker_identity=SpeakerIdentity(
                status="NOT_AVAILABLE",
                similarity=None,
            ),
            conversation=ConversationRisk(
                status="NOT_AVAILABLE",
                risk=0.0,
                signals=[],
            ),
            replay=ReplayEvidence(
                status="NOT_AVAILABLE",
                score=0.0,
            ),
            temporal=TemporalRisk(
                status="NOT_AVAILABLE",
                trend=None,
            ),
            decision=DecisionEvidence(
                status="PARTIAL",
                action="VERIFY" if persistent_evidence >= 0.70 else "ALLOW",
                confidence=round(reliability, 3),
            ),
            evidence=evidence_list,
            processing_time_ms=round(inference_time_ms, 2),
        )

    def _load_and_resample(self, path: Path, target_sr: int = 16000) -> Tuple[np.ndarray, float]:
        with wave.open(str(path), "rb") as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            n_frames = wf.getnframes()
            raw_bytes = wf.readframes(n_frames)

        duration = n_frames / float(sample_rate)

        if sample_width == 2:
            samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 1:
            samples = (np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        else:
            raise ValueError(f"Unsupported sample width: {sample_width}")

        if channels > 1:
            samples = samples.reshape(-1, channels).mean(axis=1)

        if sample_rate != target_sr:
            orig_indices = np.linspace(0.0, duration, num=len(samples), endpoint=False)
            target_len = int(round(duration * target_sr))
            target_indices = np.linspace(0.0, duration, num=target_len, endpoint=False)
            samples = np.interp(target_indices, orig_indices, samples).astype(np.float32)

        return samples, duration

    def _create_sliding_windows(self, samples: np.ndarray) -> List[np.ndarray]:
        if len(samples) < self.WINDOW_LEN:
            reps = math.ceil(self.WINDOW_LEN / len(samples))
            padded = np.tile(samples, reps)[: self.WINDOW_LEN]
            return [padded]

        windows = []
        for start in range(0, len(samples) - self.WINDOW_LEN + 1, self.HOP_LEN):
            windows.append(samples[start : start + self.WINDOW_LEN])

        if len(samples) > self.WINDOW_LEN and (len(samples) - self.WINDOW_LEN) % self.HOP_LEN != 0:
            windows.append(samples[-self.WINDOW_LEN :])

        return windows

    @staticmethod
    def get_engine():
        """Accessor for the unified AEGIS engine singleton."""
        return get_aegis_engine()


_AEGIS_ENGINE: Optional[Any] = None
_AEGIS_LOCK = RLock()


def get_aegis_engine() -> Optional[Any]:
    """
    Thread-safe singleton accessor for the unified AEGIS engine.
    Initializes AASIST-L and ECAPA-TDNN models once, avoiding per-request reloading.
    """
    global _AEGIS_ENGINE
    if _AEGIS_ENGINE is None:
        with _AEGIS_LOCK:
            if _AEGIS_ENGINE is None:
                from app.core.config import get_settings
                settings = get_settings()
                if not getattr(settings, "AEGIS_ENABLED", True):
                    return None

                aegis_pkg_dir = Path(__file__).resolve().parent.parent.parent / "AEGIS_INTEGRATION"
                if str(aegis_pkg_dir) not in sys.path:
                    sys.path.insert(0, str(aegis_pkg_dir))

                from aegis_engine import AegisEngine
                _AEGIS_ENGINE = AegisEngine(
                    aasist_model_path=str(settings.aegis_aasist_path),
                    ecapa_model_dir=str(settings.aegis_ecapa_cache_dir),
                    speaker_profile_path=str(settings.aegis_speaker_profile_path),
                    device=getattr(settings, "AEGIS_DEVICE", "cpu"),
                )
    return _AEGIS_ENGINE
