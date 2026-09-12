
import os
import importlib.util
from typing import Dict, Any

import numpy as np
import librosa
import torch


class AASISTDetector:
    """
    Production inference wrapper around the official AASIST-L model.

    Responsibilities:
        - Load AASIST-L once
        - Resample audio to 16 kHz mono
        - Remove DC offset
        - Create overlapping inference windows
        - Produce per-window spoof probabilities
        - Aggregate window-level evidence
        - Return structured inference results

    Important:
        AASIST class convention:
            class 0 = spoof
            class 1 = bonafide
    """

    DEFAULT_CONFIG = {
        "architecture": "AASIST",
        "nb_samp": 64600,
        "first_conv": 128,
        "filts": [
            70,
            [1, 32],
            [32, 32],
            [32, 24],
            [24, 24],
        ],
        "gat_dims": [24, 32],
        "pool_ratios": [0.4, 0.5, 0.7, 0.5],
        "temperatures": [2.0, 2.0, 100.0, 100.0],
    }

    def __init__(
        self,
        model_path: str,
        model_source: str,
        device: str = "cpu",
        config: Dict[str, Any] = None,
    ):
        self.model_path = model_path
        self.model_source = model_source
        self.device = torch.device(device)
        self.config = config or self.DEFAULT_CONFIG.copy()

        self.sample_rate = 16000
        self.window_samples = self.config["nb_samp"]
        self.hop_samples = self.window_samples // 2

        self.model = self._load_model()

    # --------------------------------------------------------
    # Model loading
    # --------------------------------------------------------

    def _load_model(self):
        if not os.path.exists(self.model_source):
            raise FileNotFoundError(
                f"AASIST source not found: {self.model_source}"
            )

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"AASIST checkpoint not found: {self.model_path}"
            )

        spec = importlib.util.spec_from_file_location(
            "aegis_aasist_model",
            self.model_source,
        )

        if spec is None or spec.loader is None:
            raise ImportError(
                "Could not load AASIST model source."
            )

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        model = module.Model(self.config)
        model = model.to(self.device)

        checkpoint = torch.load(
            self.model_path,
            map_location=self.device,
            weights_only=False,
        )

        if (
            isinstance(checkpoint, dict)
            and "state_dict" in checkpoint
        ):
            state_dict = checkpoint["state_dict"]
        else:
            state_dict = checkpoint

        # Handle DataParallel checkpoints.
        state_dict = {
            (
                key.replace("module.", "", 1)
                if key.startswith("module.")
                else key
            ): value
            for key, value in state_dict.items()
        }

        # Production invariant:
        # the verified official checkpoint must match exactly.
        model.load_state_dict(
            state_dict,
            strict=True,
        )

        model.eval()

        return model

    # --------------------------------------------------------
    # Audio preprocessing
    # --------------------------------------------------------

    def _load_audio(self, audio_input: Any):
        if isinstance(audio_input, np.ndarray):
            audio = audio_input.astype(np.float32)
            if audio.ndim > 1:
                audio = np.mean(audio, axis=0)
            audio = audio - np.mean(audio)
            return audio, self.sample_rate

        audio_path = str(audio_input)
        if not os.path.exists(audio_path):
            raise FileNotFoundError(
                f"Audio file not found: {audio_path}"
            )

        audio, sr = librosa.load(
            audio_path,
            sr=self.sample_rate,
            mono=True,
        )

        audio = np.asarray(
            audio,
            dtype=np.float32,
        )

        # Remove DC offset only.
        # Deliberately avoid peak normalization because it can
        # alter the acoustic evidence used by the detector.
        audio = audio - np.mean(audio)

        return audio, self.sample_rate

    # --------------------------------------------------------
    # Audio quality
    # --------------------------------------------------------

    @staticmethod
    def _audio_quality(audio: np.ndarray) -> float:
        """
        Lightweight reliability estimate.

        This is NOT a probability that the recording is genuine.
        It only estimates whether the signal is usable.
        """

        if audio.size == 0:
            return 0.0

        rms = float(np.sqrt(np.mean(audio ** 2)))
        peak = float(np.max(np.abs(audio)))

        if not np.isfinite(rms) or not np.isfinite(peak):
            return 0.0

        # Silence / near-silence
        if rms < 1e-4:
            return 0.0

        # Extremely clipped / pathological signal
        clipping_ratio = float(
            np.mean(np.abs(audio) >= 0.999)
        )

        quality = 1.0

        if rms < 0.005:
            quality *= 0.35
        elif rms < 0.01:
            quality *= 0.65

        if clipping_ratio > 0.05:
            quality *= 0.50
        elif clipping_ratio > 0.01:
            quality *= 0.80

        return float(np.clip(quality, 0.0, 1.0))

    # --------------------------------------------------------
    # Window generation
    # --------------------------------------------------------

    def _make_windows(self, audio: np.ndarray):
        windows = []

        if len(audio) < self.window_samples:
            padded = np.pad(
                audio,
                (0, self.window_samples - len(audio)),
            )

            windows.append(
                {
                    "start_sample": 0,
                    "end_sample": len(audio),
                    "audio": padded,
                }
            )

            return windows

        for start in range(
            0,
            len(audio),
            self.hop_samples,
        ):
            chunk = audio[
                start:start + self.window_samples
            ]

            if len(chunk) < self.window_samples:
                # Ignore tiny trailing fragments.
                if len(chunk) < self.window_samples // 2:
                    continue

                original_length = len(chunk)

                chunk = np.pad(
                    chunk,
                    (
                        0,
                        self.window_samples - len(chunk),
                    ),
                )

                windows.append(
                    {
                        "start_sample": start,
                        "end_sample": start + original_length,
                        "audio": chunk,
                    }
                )

                continue

            windows.append(
                {
                    "start_sample": start,
                    "end_sample": start + self.window_samples,
                    "audio": chunk,
                }
            )

        return windows

    # --------------------------------------------------------
    # Single-window inference
    # --------------------------------------------------------

    def _predict_window(self, audio_window: np.ndarray):
        waveform = torch.from_numpy(
            audio_window
        ).float().unsqueeze(0)

        waveform = waveform.to(self.device)

        with torch.inference_mode():
            _, logits = self.model(
                waveform,
                Freq_aug=False,
            )

            probabilities = torch.softmax(
                logits,
                dim=1,
            )

        spoof_score = float(
            probabilities[0, 0].detach().cpu()
        )

        bonafide_score = float(
            probabilities[0, 1].detach().cpu()
        )

        return spoof_score, bonafide_score

    # --------------------------------------------------------
    # Public inference API
    # --------------------------------------------------------

    def predict(
        self,
        audio_input: Any,
    ) -> Dict[str, Any]:

        audio, sr = self._load_audio(audio_input)

        quality = self._audio_quality(audio)

        windows = self._make_windows(audio)

        if not windows:
            raise ValueError(
                "No usable audio windows were generated."
            )

        window_results = []
        spoof_scores = []

        for index, window in enumerate(windows, start=1):

            spoof, bonafide = self._predict_window(
                window["audio"]
            )

            spoof_scores.append(spoof)

            window_results.append(
                {
                    "window": index,
                    "start_sec": round(
                        window["start_sample"] / sr,
                        4,
                    ),
                    "end_sec": round(
                        window["end_sample"] / sr,
                        4,
                    ),
                    "spoof_score": spoof,
                    "bonafide_score": bonafide,
                }
            )

        scores = np.asarray(
            spoof_scores,
            dtype=np.float32,
        )

        return {
            "model": "AASIST-L",
            "model_version": "official",
            "sample_rate": sr,
            "duration_sec": round(
                len(audio) / sr,
                4,
            ),
            "audio_quality": round(
                quality,
                4,
            ),
            "windows_analyzed": len(scores),

            # Current observation-level evidence.
            "current_spoof_score": float(
                scores[-1]
            ),

            # Call-level aggregate before temporal fusion.
            "mean_spoof_score": float(
                scores.mean()
            ),

            "median_spoof_score": float(
                np.median(scores)
            ),

            "max_spoof_score": float(
                scores.max()
            ),

            "min_spoof_score": float(
                scores.min()
            ),

            "spoof_std": float(
                scores.std()
            ),

            "window_scores": window_results,
        }
