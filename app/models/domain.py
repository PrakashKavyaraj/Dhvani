from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class PreparedAudio:
    raw_data: bytes
    sample_rate: int
    duration_seconds: float
    speech_seconds: float
    quality_status: str
    quality_notes: list[str]
    preprocessing_version: str
    channels: int
    sample_width: int
    frame_count: int


@dataclass
class DetectorPrediction:
    synthetic_speech_probability: float
    model_confidence: float
    model_version: str
    spectral_anomaly: str = "low"
    prosody_anomaly: str = "not_available"


@dataclass
class RiskAssessment:
    risk_score: int
    risk_level: RiskLevel
    recommendation: str
    risk_policy_version: str


@dataclass
class JobError:
    code: str
    message: str


@dataclass
class AnalysisJob:
    analysis_id: str
    status: JobStatus
    file_path: Optional[Path]
    created_at: float
    experiment_id: Optional[str] = None
    language: Optional[str] = None
    prepared_audio: Optional[PreparedAudio] = None
    prediction: Optional[DetectorPrediction] = None
    risk_assessment: Optional[RiskAssessment] = None
    processing_time_ms: Optional[int] = None
    error: Optional[JobError] = None
    aegis_result: Optional[dict] = None
    voiceprint_sha256: Optional[str] = None
    salt_base64: Optional[str] = None
    primary_risk_score: Optional[int] = None
    secondary_risk_score: Optional[int] = None
    audit_hmac: Optional[str] = None