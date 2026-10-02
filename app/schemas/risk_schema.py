from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ThreatTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RecommendedAction(str, Enum):
    ALLOW_STREAM = "ALLOW_STREAM"
    STEP_UP_LIVENESS_CHALLENGE = "STEP_UP_LIVENESS_CHALLENGE"
    TERMINATE_AND_ALERT_FRAUD_DESK = "TERMINATE_AND_ALERT_FRAUD_DESK"


class AudioSignalsIn(BaseModel):
    acoustic_fake_prob: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Member 1 ML model synthetic speech probability [0.0, 1.0]",
    )
    codec_compression_anomaly: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Member 2 DSP codec compression anomaly score [0.0, 1.0]",
    )
    spectral_discontinuity: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Member 2 DSP spectral discontinuity score [0.0, 1.0]",
    )
    snr_db: float = Field(
        ...,
        description="Signal-to-noise ratio in decibels (dB)",
    )
    detected_codec: Optional[str] = Field(
        "PCM",
        description="Detected audio codec (e.g. AMR, AMR-WB, G.711, OPUS, PCM)",
    )
    presentation_attack_prob: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="ISO/IEC 30107-3 loudspeaker replay presentation attack probability [0.0, 1.0]",
    )
    passive_liveness_anomaly: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Passive continuous physiological liveness anomaly score [0.0, 1.0]",
    )
    glottal_asymmetry_anomaly: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Liljencrants-Fant vocal cord glottal closure anomaly [0.0, 1.0]",
    )
    packet_loss_rate: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Measured RTP packet loss rate ratio [0.0, 1.0]",
    )
    jitter_ms: float = Field(
        0.0,
        ge=0.0,
        description="Network packet arrival delay jitter in milliseconds",
    )
    plc_artifact_prob: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Detected Packet Loss Concealment (PLC) extrapolation artifact score [0.0, 1.0]",
    )
    transmission_rating_r: Optional[float] = Field(
        None,
        description="ITU-T G.107 E-Model transmission quality rating factor R [0.0, 100.0]",
    )
    mos_score: Optional[float] = Field(
        None,
        description="Derived Mean Opinion Score (MOS) [1.0, 4.5]",
    )


class ContextSignalsIn(BaseModel):
    session_id: str = Field(
        ...,
        description="Persistent call/session identifier",
    )
    turn_index: int = Field(
        ...,
        ge=0,
        description="Dialogue turn sequence index",
    )
    transcript: Optional[str] = Field(
        "",
        description="ASR transcript text",
    )
    caller_id_verified: bool = Field(
        True,
        description="STIR/SHAKEN caller ID verification status",
    )
    client_ip: Optional[str] = Field(
        None,
        description="Client IP address",
    )
    user_consent_granted: bool = Field(
        ...,
        description="Digital Personal Data Protection (DPDP) Act explicit consent flag",
    )


class EvaluateRiskRequest(BaseModel):
    audio_signals: AudioSignalsIn
    context_signals: ContextSignalsIn
    raw_audio_chunk_b64: Optional[str] = Field(
        None,
        description="Optional base64-encoded raw audio frame",
    )


class AuditLogOut(BaseModel):
    session_id: str
    timestamp: float
    voice_token: str = Field(
        ...,
        description="Salted irreversible SHA-256 voice token for zero raw biometric persistence",
    )
    signature: str = Field(
        ...,
        description="Tamper-proof SHA-256 signature of the evaluation event",
    )
    leaf_index: Optional[int] = Field(
        None,
        description="Sequential leaf block index in the append-only Merkle audit tree",
    )
    leaf_hash: Optional[str] = Field(
        None,
        description="Cryptographic SHA-256 leaf hash of the incident evaluation record",
    )
    merkle_root: Optional[str] = Field(
        None,
        description="Active cryptographic Merkle root hash validating tamper-evidence",
    )
    rfc3161_token: Optional[str] = Field(
        None,
        description="RFC 3161-compliant digital timestamp token for court admissibility",
    )


class RiskEvaluationResponse(BaseModel):
    session_id: str
    threat_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Composite threat score (0-100)",
    )
    threat_tier: ThreatTier
    recommended_action: RecommendedAction
    challenge_required: bool
    drift_detected: bool = False
    telephony_degradation_discount: Optional[float] = Field(
        None,
        description="Applied synthetic score de-biasing discount due to network degradation [0.0, 1.0]",
    )
    forensic_reasons: List[str] = Field(
        default_factory=list,
        description="XAI forensic explainability reasons",
    )
    audit_log: AuditLogOut

    model_config = ConfigDict(use_enum_values=True)
