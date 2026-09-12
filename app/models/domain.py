from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Status(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code, self.message = code, message
        super().__init__(message)


@dataclass
class PreparedAudio:
    waveform: bytes
    sample_rate: int
    duration_seconds: float
    speech_seconds: float
    quality_status: str
    quality_notes: list[str]
    preprocessing_version: str
    channels: int = 1
    sample_width: int = 2


@dataclass
class DetectorPrediction:
    synthetic_probability: float
    model_confidence: float | None
    model_version: str
    indicators: dict[str, str]


@dataclass
class RiskAssessment:
    risk_score: int
    risk_level: str
    recommendation: str
    risk_policy_version: str
    notes: list[str] = field(default_factory=list)


@dataclass
class AnalysisJob:
    analysis_id: str
    status: Status
    filename: str
    experiment_id: str | None = None
    language: str | None = None
    result: dict[str, Any] | None = None
    error: dict[str, str] | None = None
