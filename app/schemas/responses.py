from typing import Literal

from pydantic import BaseModel, Field


class Versions(BaseModel):
    model: str
    preprocessing: str
    risk_policy: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class AcceptedResponse(BaseModel):
    analysis_id: str
    status: Literal["queued"]
    message: str


class PendingResponse(BaseModel):
    analysis_id: str
    status: Literal["queued", "running"]


class AudioQuality(BaseModel):
    status: str
    speech_seconds: float
    notes: list[str]


class CompletedResponse(BaseModel):
    analysis_id: str
    status: Literal["completed"]
    risk_score: int = Field(ge=0, le=100)
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    synthetic_speech_probability: float = Field(ge=0, le=1)
    model_confidence: float | None = Field(default=None, ge=0, le=1)
    audio_quality: AudioQuality
    evidence: dict[str, str]
    recommendation: str
    versions: Versions
    processing_time_ms: int
    disclaimer: str
    dpdpVault: dict[str, str] | None = None


class FailedResponse(BaseModel):
    analysis_id: str
    status: Literal["failed"]
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: Literal["ok"]
    versions: Versions
