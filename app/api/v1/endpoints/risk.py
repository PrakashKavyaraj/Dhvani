from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security_engine import SecurityEngine, security_engine
from app.schemas.risk_schema import (
    EvaluateRiskRequest,
    RiskEvaluationResponse,
)

router = APIRouter(prefix="/risk", tags=["Security & Risk Engine"])


def get_security_engine() -> SecurityEngine:
    return security_engine


@router.post(
    "/evaluate",
    response_model=RiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Composite Call/Stream Risk",
)
def evaluate_risk(
    request: EvaluateRiskRequest,
    engine: SecurityEngine = Depends(get_security_engine),
):
    """
    Evaluates acoustic, contextual, DSP, and session drift signals
    through Member 5's Security & Risk Engine.

    Guarantees:
    - DPDP Act consent enforcement (403 if user_consent_granted=False)
    - Codec resilience weighting on lossy telephony networks
    - Social engineering regex intent scanning
    - Mid-call voice injection drift surveillance
    - Salted voice token generation (zero raw biometric storage)
    - Tamper-proof audit signature
    """
    return engine.evaluate(request)


@router.delete(
    "/session/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Clear Session Drift Cache",
)
def clear_session_cache(
    session_id: str,
    engine: SecurityEngine = Depends(get_security_engine),
):
    """
    Purges historical turn drift tracking for a given session ID
    upon call termination or session tear-down.
    """
    cleared = engine.clear_session(session_id)
    return {
        "status": "cleared" if cleared else "not_found",
        "session_id": session_id,
    }


@router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    summary="Security Engine Operational Readiness",
)
def get_engine_status(
    engine: SecurityEngine = Depends(get_security_engine),
):
    return {
        "status": "ready",
        "engine_version": "member-5-v1.0",
        "active_sessions_tracked": engine.get_active_session_count(),
        "dpdp_enforcement": True,
        "tamper_proof_signing": True,
    }
