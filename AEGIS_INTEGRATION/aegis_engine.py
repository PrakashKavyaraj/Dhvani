
import time
import importlib.util
from pathlib import Path
import numpy as np


def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AegisEngine:

    def __init__(
        self,
        aasist_model_path,
        ecapa_model_dir,
        speaker_profile_path,
        forensics_model_path=None,
        device="cpu",
    ):
        self.device = device

        # Load components
        aasist_mod = _load_module(
            "aasist_detector",
            Path(__file__).parent / "inference" / "aasist_detector.py"
        )

        forensics_mod = _load_module(
            "forensics_detector",
            Path(__file__).parent / "inference" / "forensics_detector.py"
        )

        robust_mod = _load_module(
            "robust_spoof",
            Path(__file__).parent / "inference" / "robust_spoof.py"
        )

        channel_mod = _load_module(
            "channel_analyzer",
            Path(__file__).parent / "inference" / "channel_analyzer.py"
        )

        ecapa_mod = _load_module(
            "ecapa_verifier",
            Path(__file__).parent / "inference" / "ecapa_verifier.py"
        )

        fusion_mod = _load_module(
            "fusion_engine",
            Path(__file__).parent / "fusion_engine.py"
        )

        temporal_mod = _load_module(
            "temporal_engine",
            Path(__file__).parent / "temporal_engine.py"
        )

        self.robust_spoof = robust_mod.robust_spoof_evidence
        self.ChannelAnalyzer = channel_mod.ChannelAnalyzer
        self.channel_analyzer = self.ChannelAnalyzer()
        self.FusionEngine = fusion_mod.AEGISFusionEngine
        self.TemporalEvidenceEngine = temporal_mod.TemporalEvidenceEngine

        # Primary acoustic deepfake detector: Forensics 0.3B
        resolved_forensics_path = (
            Path(forensics_model_path)
            if forensics_model_path
            else Path(__file__).parent.parent / "models" / "weights" / "forensics_0.3B_base.safetensors"
        )
        if resolved_forensics_path.is_file():
            self.forensics_detector = forensics_mod.ForensicsDetector(
                checkpoint_path=str(resolved_forensics_path),
                device=device,
            )
        else:
            self.forensics_detector = None

        # Secondary independent detector: AASIST-L (Preserved)
        self.aasist = aasist_mod.AASISTDetector(
            model_path=str(aasist_model_path),
            model_source=str(
                Path(__file__).parent
                / "aasist"
                / "models"
                / "AASIST.py"
            ),
            device=device,
        )

        self.ecapa = ecapa_mod.ECAPAVerifier(
            model_dir=str(ecapa_model_dir),
            profile_path=str(speaker_profile_path),
            device=device,
        )

    def analyze(self, audio_path, session_id="aegis-session"):

        start = time.perf_counter()
        audio_input = audio_path if isinstance(audio_path, np.ndarray) else str(audio_path)

        # ---------------------------------------------------------
        # 0. ACOUSTIC CHANNEL DOMAIN ANALYSIS
        # ---------------------------------------------------------

        channel_info = self.channel_analyzer.analyze(audio_input)
        channel_reliability = float(channel_info.get("channel_reliability", 1.0))

        # ---------------------------------------------------------
        # 1. PRIMARY DETECTOR: Forensics 0.3B
        # ---------------------------------------------------------

        primary_result = None
        if self.forensics_detector is not None:
            try:
                primary_result = self.forensics_detector.predict(audio_input)
            except Exception as exc:
                primary_result = None

        if primary_result is not None:
            primary_fake_prob = float(primary_result["fake_probability"])
            primary_bonafide_prob = float(primary_result["bonafide_probability"])
            primary_windows = primary_result.get("window_scores", [primary_fake_prob])
        else:
            primary_fake_prob = None
            primary_bonafide_prob = None
            primary_windows = []

        # ---------------------------------------------------------
        # 2. SECONDARY DETECTOR: AASIST-L (Preserved Telemetry)
        # ---------------------------------------------------------

        spoof_result = self.aasist.predict(audio_input)

        window_scores = [
            w["spoof_score"]
            for w in spoof_result["window_scores"]
        ]

        robust = self.robust_spoof(
            window_scores,
            audio_quality=spoof_result.get("audio_quality", 1.0),
            channel_reliability=channel_reliability,
        )

        raw_current_spoof = window_scores[-1] if window_scores else 0.0
        # When channel constraints (e.g. telephony) are present, pull current spoof toward neutral
        current_spoof = float(
            channel_reliability * raw_current_spoof
            + (1.0 - channel_reliability) * 0.50
        )
        raw_persistent_spoof = float(
            robust.get("raw_persistent_spoof_evidence", robust["reliable_score"])
        )
        persistent_spoof = float(robust["reliable_score"])

        # ---------------------------------------------------------
        # 3. SPEAKER IDENTITY
        # ---------------------------------------------------------

        identity = self.ecapa.verify(audio_input)

        speaker_similarity = identity.get("similarity")
        raw_similarity = identity.get("raw_similarity")

        identity_available = speaker_similarity is not None

        # ---------------------------------------------------------
        # 4. TEMPORAL EVIDENCE
        # ---------------------------------------------------------

        temporal = self.TemporalEvidenceEngine()

        # Primary detector window scores drive temporal tracking if available
        tracking_windows = primary_windows if primary_windows else window_scores

        for i, score in enumerate(tracking_windows):
            # If using primary detector, scores are already robust/calibrated.
            # If using fallback AASIST, scale window score by channel reliability.
            if primary_windows:
                adj_window_score = float(score)
            else:
                adj_window_score = float(
                    channel_reliability * score
                    + (1.0 - channel_reliability) * 0.50
                )

            temporal.update(
                timestamp=float(i),
                spoof_score=adj_window_score,
                speaker_similarity=(
                    float(speaker_similarity)
                    if speaker_similarity is not None
                    else 1.0
                ),
                conversation_risk=0.0,
                replay_score=0.0,

                spoof_available=True,
                identity_available=identity_available,
                conversation_available=False,
                replay_available=False,
            )

        temporal_result = temporal.get_history()

        # ---------------------------------------------------------
        # 5. FUSION
        # ---------------------------------------------------------

        fusion = self.FusionEngine()

        # FusionEngine v2 expects scalar temporal evidence,
        # not the complete temporal-result dictionary.
        # Temporal Engine v2 returns a history list.
        # Use the latest entry as the current temporal state.
        temporal_last = (
            temporal_result[-1]
            if isinstance(temporal_result, list) and temporal_result
            else {}
        )

        temporal_risk = float(
            temporal_last.get("evidence_score", 0.0)
        )

        temporal_confidence = float(
            temporal_last.get("coverage", 0.0)
        )

        # Primary acoustic spoof evidence feeds into multimodal fusion
        fusion_spoof = (
            primary_fake_prob
            if primary_fake_prob is not None
            else persistent_spoof
        )

        fusion_result = fusion.fuse(
            spoof_score=float(fusion_spoof),
            primary_spoof=float(primary_fake_prob) if primary_fake_prob is not None else None,
            secondary_spoof=float(raw_persistent_spoof),
            channel_reliability=float(channel_reliability),
            channel_status=str(channel_info.get("channel_status", "HIGH_FIDELITY")),
            speaker_similarity=speaker_similarity,
            conversation_risk=None,
            replay_score=None,
            audio_quality=float(
                spoof_result.get("audio_quality", 1.0)
            ),
            temporal_risk=float(temporal_risk),
            temporal_confidence=float(temporal_confidence),
            identity_status=identity.get("status"),
            spoof_available=True,
            identity_available=identity_available,
            conversation_available=False,
            replay_available=False,
        )

        processing_ms = (time.perf_counter() - start) * 1000

        # ---------------------------------------------------------
        # 6. STANDARDIZED AEGIS OUTPUT
        # ---------------------------------------------------------

        return {
            "session_id": session_id,

            "audio": {
                "duration": spoof_result.get("duration_sec"),
                "quality": spoof_result.get("audio_quality", 1.0),
            },

            "primary_detector": {
                "model": primary_result.get("model", "eliya/forensics_0.3B_base_deepfake_classifier"),
                "version": primary_result.get("version", "0.3B-base-v1"),
                "fake_probability": primary_fake_prob,
                "bonafide_probability": primary_bonafide_prob,
                "center_fake_probability": primary_result.get("center_fake_probability"),
                "verdict": primary_result.get("verdict", "REAL"),
                "windows_analyzed": primary_result.get("windows_analyzed", 1),
                "window_scores": primary_windows,
            } if primary_result is not None else None,

            "voice_authenticity": {
                "current_spoof_score": current_spoof,
                "persistent_spoof_evidence": persistent_spoof,
                "raw_current_spoof_score": raw_current_spoof,
                "raw_persistent_spoof_evidence": raw_persistent_spoof,
                "channel_reliability": channel_reliability,
                "reliability_adjusted_spoof_evidence": persistent_spoof,
                "reliability": robust.get("reliability", 0.0),
                "windows_analyzed": len(window_scores),
            },

            "channel": {
                "status": channel_info.get("channel_status", "UNKNOWN"),
                "channel_reliability": channel_reliability,
                "indicators": channel_info.get("indicators", {}),
                "active_indicators": channel_info.get("active_indicators", []),
                "reason": channel_info.get("reason", ""),
            },

            "sensor_agreement": fusion_result.get("sensor_agreement", "NOT_APPLICABLE"),

            "speaker_identity": {
                "status": identity.get("status", "UNKNOWN"),
                "similarity": speaker_similarity,
                "raw_similarity": raw_similarity,
                "mean_similarity": identity.get("mean_similarity"),
                "median_similarity": identity.get("median_similarity"),
            },

            "conversation": {
                "status": "NOT_AVAILABLE",
                "risk": None,
                "signals": [],
            },

            "replay": {
                "status": "NOT_AVAILABLE",
                "score": None,
            },

            "temporal": temporal_result,

            "decision": {
                "status": "PARTIAL",

                "action": (
                    fusion_result.get("action")
                    or fusion_result.get("recommended_action")
                    or fusion_result.get("decision", {}).get("action")
                    or "VERIFY"
                ),

                "risk": (
                    fusion_result.get("risk")
                    if fusion_result.get("risk") is not None
                    else fusion_result.get("decision", {}).get("risk")
                ),

                "severity": (
                    fusion_result.get("severity")
                    if fusion_result.get("severity") is not None
                    else fusion_result.get("decision", {}).get("severity")
                ),

                "confidence": (
                    fusion_result.get("confidence")
                    if fusion_result.get("confidence") is not None
                    else fusion_result.get("decision", {}).get("confidence")
                ),

                "sensor_agreement": fusion_result.get("sensor_agreement", "NOT_APPLICABLE"),
            },

            "evidence": fusion_result.get("evidence", []),

            "processing_time_ms": round(processing_ms, 2),
        }
