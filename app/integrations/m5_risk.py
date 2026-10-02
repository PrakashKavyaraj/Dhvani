from app.core.config import get_settings
from app.models.domain import (
    DetectorPrediction,
    PreparedAudio,
    RiskAssessment,
    RiskLevel,
)


def calculate_risk(
    prediction: DetectorPrediction,
    prepared_audio: PreparedAudio,
) -> RiskAssessment:
    """
    Risk scoring and recommendation policy engine.
    Preserves signature: calculate_risk(DetectorPrediction, PreparedAudio) -> RiskAssessment

    Presents probabilistic risk only; NEVER makes automated fraud, blocking,
    or identity decisions.
    """
    settings = get_settings()

    # Clamp probability to [0.0, 1.0] and compute 0-100 risk score
    clamped_prob = max(0.0, min(1.0, prediction.synthetic_speech_probability))
    risk_score = int(round(clamped_prob * 100))

    if risk_score <= settings.LOW_RISK_MAX:
        risk_level = RiskLevel.LOW
        base_recommendation = "Record the result and use normal review procedures."
    elif risk_score <= settings.MEDIUM_RISK_MAX:
        risk_level = RiskLevel.MEDIUM
        base_recommendation = "Consider independent secondary verification before a sensitive action."
    else:
        risk_level = RiskLevel.HIGH
        base_recommendation = "Perform independent secondary verification before a sensitive action."

    recommendation = base_recommendation
    if prepared_audio.quality_status != "suitable":
        recommendation += " Audio quality may reduce confidence."

    return RiskAssessment(
        risk_score=risk_score,
        risk_level=risk_level,
        recommendation=recommendation,
        risk_policy_version=settings.RISK_POLICY_VERSION,
    )