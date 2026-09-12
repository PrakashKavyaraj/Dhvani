from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass
class Settings:
    max_upload_size_mb: int = _int_env("MAX_UPLOAD_SIZE_MB", 20)
    max_duration_seconds: int = _int_env("MAX_DURATION_SECONDS", 120)
    min_duration_seconds: int = _int_env("MIN_DURATION_SECONDS", 2)
    min_speech_seconds: float = float(os.getenv("MIN_SPEECH_SECONDS", "1"))
    temp_audio_dir: Path = Path(os.getenv("TEMP_AUDIO_DIR", "data/temp"))
    model_version: str = os.getenv("MODEL_VERSION", "baseline-v1")
    detector_backend: str = os.getenv("DETECTOR_BACKEND", "dummy").lower()
    detector_model_id: str = os.getenv("DETECTOR_MODEL_ID", "Vansh180/deepfake-audio-wav2vec2")
    detector_spoof_label: str = os.getenv("DETECTOR_SPOOF_LABEL", "spoof").lower()
    detector_spoof_label_index: int = _int_env("DETECTOR_SPOOF_LABEL_INDEX", 1)
    detector_target_sample_rate: int = _int_env("DETECTOR_TARGET_SAMPLE_RATE", 16000)
    model_cache_dir: Path = Path(os.getenv("MODEL_CACHE_DIR", "data/model-cache"))
    preprocessing_version: str = os.getenv("PREPROCESSING_VERSION", "v1")
    risk_policy_version: str = os.getenv("RISK_POLICY_VERSION", "v1")
    low_risk_max: int = _int_env("LOW_RISK_MAX", 39)
    medium_risk_max: int = _int_env("MEDIUM_RISK_MAX", 69)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


settings = Settings()
