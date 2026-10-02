"""
Core Banking & Telephony REST Endpoints for Dhvani.

Provides:
- POST /api/v1/banking/pre-auth-evaluate: Pre-authorization transaction fraud intercept evaluation (ISO 8583 / ISO 20022).
- POST /api/v1/banking/simulate-telephony: Carrier SIP/RTP packetized streaming simulation.
"""

from typing import Optional
from fastapi import APIRouter, Body, Response, status
from pydantic import BaseModel, Field

from app.integrations.banking_bridge import banking_bridge

router = APIRouter(prefix="/banking", tags=["Core Banking & Telephony Bridge"])


class PreAuthRequest(BaseModel):
    analysis_id: Optional[str] = Field(None, description="Completed Dhvani voice analysis ID")
    voiceprint_sha256: Optional[str] = Field(None, description="Sha256 hash of analysed voiceprint")
    customer_id: Optional[str] = Field(None, description="Unique customer/account identifier")
    transaction_amount_inr: float = Field(0.0, description="Transaction amount in INR")
    liveness_verified: Optional[bool] = Field(None, description="Status of active liveness challenge")
    biometric_similarity: Optional[float] = Field(None, description="Voiceprint similarity score (0.0 to 1.0)")


class TelephonySimulateRequest(BaseModel):
    duration_seconds: float = Field(2.0, ge=0.5, le=30.0, description="Duration in seconds")
    sample_rate: int = Field(16000, description="Audio sample rate (8000 or 16000)")
    packet_duration_ms: int = Field(20, ge=10, le=100, description="RTP frame size in ms")


@router.post(
    "/pre-auth-evaluate",
    status_code=status.HTTP_200_OK,
    summary="Evaluate transaction pre-authorization against voice integrity metrics (ISO 8583)",
)
def evaluate_pre_auth(
    payload: PreAuthRequest,
    response: Response,
):
    result = banking_bridge.evaluate_pre_auth(
        analysis_id=payload.analysis_id,
        voiceprint_sha256=payload.voiceprint_sha256,
        customer_id=payload.customer_id,
        transaction_amount_inr=payload.transaction_amount_inr,
        liveness_verified=payload.liveness_verified,
        biometric_similarity=payload.biometric_similarity,
    )
    # Inject ISO 20022 / Banking headers into HTTP response
    for header_name, header_value in result["compliance_headers"].items():
        response.headers[header_name] = str(header_value)

    return result


@router.post(
    "/simulate-telephony",
    status_code=status.HTTP_200_OK,
    summary="Simulate carrier-grade SIP/RTP packetized streaming with 20ms frames",
)
def simulate_telephony(payload: TelephonySimulateRequest = Body(default_factory=TelephonySimulateRequest)):
    return banking_bridge.simulate_telephony_stream(
        duration_seconds=payload.duration_seconds,
        sample_rate=payload.sample_rate,
        packet_duration_ms=payload.packet_duration_ms,
    )
