from typing import Any, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class VoiceAuthenticity(BaseModel):
    """
    Voice authenticity telemetry derived from AASIST-L inference.
    Maintains strict separation between current window and aggregated temporal evidence.
    """
    current_spoof_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Spoof probability of the most recent/current temporal window",
    )
    persistent_spoof_evidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Aggregated robust spoof evidence across temporal sliding windows",
    )
    reliability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Reliability metric factoring in duration, quality, and channel domain",
    )
    windows_analyzed: int = Field(
        ...,
        ge=0,
        description="Total count of sliding windows evaluated",
    )
    raw_current_spoof_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Raw unadjusted spoof score of current window",
    )
    raw_persistent_spoof_evidence: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Raw unadjusted persistent spoof score before channel reliability modulation",
    )
    channel_reliability: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Acoustic channel reliability factor [0.25, 1.0]",
    )
    reliability_adjusted_spoof_evidence: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Reliability-adjusted spoof score consumed by multimodal fusion",
    )


class ChannelMetrics(BaseModel):
    status: str = Field("HIGH_FIDELITY", description="Channel status (HIGH_FIDELITY, CHANNEL_CONSTRAINED, TELEPHONY)")
    channel_reliability: float = Field(1.0, ge=0.0, le=1.0, description="Confidence factor for acoustic spoof detection")
    indicators: dict = Field(default_factory=dict, description="Extracted spectral channel metrics")
    active_indicators: List[str] = Field(default_factory=list, description="List of active constraint triggers")
    reason: str = Field("", description="Channel classification explanation")


class SpeakerIdentity(BaseModel):
    status: str = Field("NOT_AVAILABLE", description="Speaker verification module state")
    similarity: Optional[float] = Field(None, description="Cosine similarity against enrolled voiceprint")
    raw_similarity: Optional[float] = Field(None, description="Raw un-normalized cosine similarity [-1, 1]")


class ConversationRisk(BaseModel):
    status: str = Field("NOT_AVAILABLE", description="Conversation intent module state")
    risk: Optional[float] = Field(None, ge=0.0, le=1.0, description="Conversational intent threat score")
    signals: List[str] = Field(default_factory=list, description="Detected intent triggers")


class ReplayEvidence(BaseModel):
    status: str = Field("NOT_AVAILABLE", description="Physical replay detection state")
    score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Acoustic replay anomaly score")


class TemporalRisk(BaseModel):
    status: str = Field("NOT_AVAILABLE", description="Temporal drift tracking state")
    trend: Optional[str] = Field(None, description="Temporal trajectory (e.g. STABLE, ESCALATING)")


class DecisionEvidence(BaseModel):
    status: str = Field(
        "PARTIAL",
        description="Decision engine status (PARTIAL until multimodal fusion is integrated)",
    )
    action: Optional[str] = Field("ALLOW", description="Interim recommendation based on available evidence")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Decision confidence")
    sensor_agreement: Optional[str] = Field(
        None,
        description="Agreement status between primary detector and secondary telemetry (AGREEMENT, DISAGREEMENT, NOT_APPLICABLE)",
    )


class AudioMetrics(BaseModel):
    duration: float = Field(..., ge=0.0, description="Audio duration in seconds")
    quality: float = Field(1.0, ge=0.0, le=1.0, description="Audio quality metric")


class PrimaryDetectorMetrics(BaseModel):
    """
    Primary acoustic deepfake detection telemetry from Forensics 0.3B.
    """
    model: str = Field(
        "eliya/forensics_0.3B_base_deepfake_classifier",
        description="Primary acoustic deepfake detection model name",
    )
    version: str = Field("0.3B-base-v1", description="Model version")
    fake_probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Calibrated acoustic fake/synthetic probability",
    )
    bonafide_probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Calibrated acoustic bonafide/human speech probability",
    )
    center_fake_probability: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Fake probability on center 5.0-second window",
    )
    verdict: str = Field("REAL", description="Binary decision (REAL or FAKE) based on 0.50 cutoff")
    windows_analyzed: int = Field(1, ge=0, description="Total count of 5-second windows evaluated")
    window_scores: List[float] = Field(default_factory=list, description="Per-window fake probabilities")


class AegisResult(BaseModel):
    """
    Standardized AEGIS evidence contract.
    Populates currently implemented AASIST-L voice authenticity components while
    explicitly maintaining 'NOT_AVAILABLE' / 'PARTIAL' status for deferred modules.
    """
    session_id: str = Field(..., description="Unique call/analysis session identifier")
    audio: AudioMetrics
    primary_detector: Optional[PrimaryDetectorMetrics] = Field(
        None,
        description="Primary deepfake detector (Forensics 0.3B) telemetry",
    )
    voice_authenticity: VoiceAuthenticity
    channel: Optional[ChannelMetrics] = Field(default_factory=ChannelMetrics)
    sensor_agreement: Optional[str] = Field(
        None,
        description="Agreement status between primary detector and secondary telemetry",
    )
    speaker_identity: SpeakerIdentity = Field(default_factory=SpeakerIdentity)
    conversation: ConversationRisk = Field(default_factory=ConversationRisk)
    replay: ReplayEvidence = Field(default_factory=ReplayEvidence)
    temporal: Union[TemporalRisk, List[Any], None] = Field(default_factory=TemporalRisk)
    decision: DecisionEvidence = Field(default_factory=DecisionEvidence)
    evidence: List[str] = Field(default_factory=list, description="Forensic explainability indicators")
    processing_time_ms: Optional[float] = Field(
        None,
        description="Total CPU inference latency in milliseconds",
    )

    model_config = ConfigDict(use_enum_values=True)

