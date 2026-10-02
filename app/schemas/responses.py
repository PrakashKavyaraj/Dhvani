from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    versions: dict[str, str]


class AnalysisAcceptedResponse(BaseModel):
    analysis_id: str
    status: str = "queued"
    message: str = "Audio accepted for analysis."


class AudioQualitySchema(BaseModel):
    status: str
    speech_seconds: float
    notes: list[str] = Field(default_factory=list)


class EvidenceSchema(BaseModel):
    spectral_anomaly: str
    prosody_anomaly: str


class VersionsSchema(BaseModel):
    model: str
    preprocessing: str
    risk_policy: str


class JobErrorSchema(BaseModel):
    code: str
    message: str


class AnalysisStatusResponse(BaseModel):
    analysis_id: str
    status: str
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    synthetic_speech_probability: Optional[float] = None
    model_confidence: Optional[float] = None
    audio_quality: Optional[AudioQualitySchema] = None
    evidence: Optional[EvidenceSchema] = None
    recommendation: Optional[str] = None
    versions: Optional[VersionsSchema] = None
    processing_time_ms: Optional[int] = None
    disclaimer: Optional[str] = None
    error: Optional[JobErrorSchema] = None
    aegis: Optional[dict] = None
    voiceprint_sha256: Optional[str] = None
    primary_risk_score: Optional[int] = None
    secondary_risk_score: Optional[int] = None
    salt_base64: Optional[str] = None
    dpdpVault: Optional[dict] = None

    model_config = ConfigDict(exclude_none=True)