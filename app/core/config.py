from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Upload & Audio Constraints
    MAX_UPLOAD_SIZE_MB: int = 20
    MAX_DURATION_SECONDS: float = 120.0
    MIN_DURATION_SECONDS: float = 2.0
    MIN_SPEECH_SECONDS: float = 1.0
    TEMP_AUDIO_DIR: str = "data/temp"
    ANALYSIS_RECORDS_PATH: str = "data/analysis_records.json"
    ALERTS_OUTBOX_PATH: str = "data/alerts_outbox.json"
    WORKFLOW_RULES_PATH: str = "data/workflow_rules.json"
    AEGIS_WEBHOOK_URL: str = "http://127.0.0.1:8000/api/v1/alerts/mock-webhook"

    # Integration Versions
    MODEL_VERSION: str = "baseline-v1"
    PREPROCESSING_VERSION: str = "v1"
    RISK_POLICY_VERSION: str = "v1"

    # M1 Detector Settings
    DETECTOR_BACKEND: str = "dummy"  # "dummy" or "transformers"
    DETECTOR_MODEL_ID: str = "Vansh180/deepfake-audio-wav2vec2"
    DETECTOR_SPOOF_LABEL: str = "spoof"
    DETECTOR_SPOOF_LABEL_INDEX: int = 1
    DETECTOR_TARGET_SAMPLE_RATE: int = 16000
    MODEL_CACHE_DIR: str = "data/model-cache"

    # M5 Risk Thresholds
    LOW_RISK_MAX: int = 39
    MEDIUM_RISK_MAX: int = 69

    # Legal / Non-Forensic Disclaimer
    DISCLAIMER_TEXT: str = (
        "This is a probabilistic risk estimate based on audio characteristics. "
        "It is not proof of fraud, identity, authorship, or authenticity. "
        "Elevated-risk results require independent secondary verification."
    )

    # AEGIS Engine Settings
    AEGIS_ENABLED: bool = True
    AEGIS_AASIST_PATH: str = "AEGIS_INTEGRATION/aasist/models/weights/AASIST-L.pth"
    AEGIS_FORENSICS_03B_PATH: str = "models/weights/forensics_0.3B_base.safetensors"
    AEGIS_ECAPA_CACHE_DIR: str = "models/cache/spkrec-ecapa-voxceleb"
    AEGIS_SPEAKER_PROFILE_PATH: str = "AEGIS_INTEGRATION/weights/speaker_profile.pt"
    AEGIS_DEVICE: str = "cpu"

    # Security Engine & Cryptographic Secrets
    VOICE_SALT: str = "DHVANI_VOICE_TOKEN_SALT_V5"
    AUDIT_SECRET: str = "DHVANI_AUDIT_SIGNING_KEY_V5"
    SESSION_TTL_SECONDS: int = 3600  # 1 hour in-memory session drift TTL
    SECURE_MEMORY_WIPE: bool = True

    # Enterprise Scalability: PostgreSQL, pgvector & Redis
    DATABASE_URL: Optional[str] = None
    REDIS_URL: Optional[str] = "redis://localhost:6379/0"
    REDIS_SESSION_TTL_SECONDS: int = 15
    DEFAULT_TENANT_ID: str = "HDFC-BANK"
    ENABLE_PGVECTOR: bool = False
    TENANT_HEADER: str = "X-Tenant-ID"
    API_KEY_HEADER: str = "X-API-Key"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def temp_audio_path(self) -> Path:
        path = Path(self.TEMP_AUDIO_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def analysis_records_path(self) -> Path:
        p = Path(self.ANALYSIS_RECORDS_PATH)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p

    @property
    def alerts_outbox_path(self) -> Path:
        p = Path(self.ALERTS_OUTBOX_PATH)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p

    @property
    def workflow_rules_path(self) -> Path:
        p = Path(self.WORKFLOW_RULES_PATH)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p

    @property
    def aegis_aasist_path(self) -> Path:
        p = Path(self.AEGIS_AASIST_PATH)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p

    @property
    def aegis_forensics_path(self) -> Path:
        p = Path(self.AEGIS_FORENSICS_03B_PATH)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p

    @property
    def aegis_speaker_profile_path(self) -> Path:
        p = Path(self.AEGIS_SPEAKER_PROFILE_PATH)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p

    @property
    def aegis_ecapa_cache_dir(self) -> Path:
        p = Path(self.AEGIS_ECAPA_CACHE_DIR)
        if not p.is_absolute():
            return Path(__file__).resolve().parent.parent.parent / p
        return p


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()