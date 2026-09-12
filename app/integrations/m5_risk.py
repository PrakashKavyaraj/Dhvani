"""M5 integration boundary for configurable, non-decisive risk presentation."""
from app.core.config import settings
from app.models.domain import DetectorPrediction, PreparedAudio, RiskAssessment


def calculate_risk(prediction: DetectorPrediction, prepared_audio: PreparedAudio) -> RiskAssessment:
    score = round(max(0.0, min(1.0, prediction.synthetic_probability)) * 100)
    if score <= settings.low_risk_max:
        level, recommendation = "LOW", "Record the result and use normal review procedures."
    elif score <= settings.medium_risk_max:
        level, recommendation = "MEDIUM", "Consider independent secondary verification before a sensitive action."
    else:
        level, recommendation = "HIGH", "Perform independent secondary verification before a sensitive action."
    notes = [] if prepared_audio.quality_status == "suitable" else ["Audio quality may reduce confidence."]
    return RiskAssessment(score, level, recommendation, settings.risk_policy_version, notes)
