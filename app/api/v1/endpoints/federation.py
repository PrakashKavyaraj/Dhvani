"""
Inter-Bank Fraud Syndicate Federation REST Endpoints for Dhvani.

Features:
- Live Federated Threat Exchange (FTX) across participating Indian & global banks
- Instant cross-bank threat broadcasting and HNSW blacklist sync
- Network statistics and prevented fraud telemetry
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.federation_service import (
    federation_service,
)

router = APIRouter(prefix="/federation", tags=["Inter-Bank Fraud Syndicate Federation"])


class BroadcastThreatRequest(BaseModel):
    originating_bank: str = Field("SBI", description="Reporting member bank code (e.g. SBI, HDFC, ICICI)")
    syndicate_name: str = Field(..., description="Name or classification of fraud syndicate")
    attack_vector: str = Field(..., description="Modus operandi (e.g. Voice Clone RTGS Fraud)")
    detected_vocoder: str = Field("HiFi-GAN (ElevenLabs API)", description="Identified neural vocoder architecture")
    threat_level: str = Field("CRITICAL", description="Threat level: CRITICAL, HIGH, MEDIUM")
    caller_ani_prefix: str = Field("+91-XXXXX", description="Sanitized caller telephone prefix")
    attempted_amount_inr: float = Field(0.0, ge=0.0, description="Fraud amount averted in INR")
    voiceprint_hash: Optional[str] = Field(None, description="SHA-256 voiceprint hash")


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Get Inter-Bank Federation network statistics and participating members",
)
async def get_federation_stats():
    """Returns network status, member nodes, total averted losses, and active campaigns."""
    return federation_service.get_federation_stats()


@router.get(
    "/bulletins",
    status_code=status.HTTP_200_OK,
    summary="Get active cross-bank federated threat bulletins",
)
async def get_federation_bulletins():
    """Returns list of real-time threat bulletins shared across member banking institutions."""
    bulletins = federation_service.get_bulletins()
    return {
        "status": "BULLETINS_RETRIEVED",
        "total_count": len(bulletins),
        "bulletins": bulletins,
    }


@router.post(
    "/broadcast",
    status_code=status.HTTP_200_OK,
    summary="Broadcast new fraud syndicate threat bulletin across the federation",
)
async def broadcast_threat(request: BroadcastThreatRequest):
    """Publishes a threat bulletin to all member institutions and triggers instant HNSW updates."""
    result = federation_service.broadcast_threat(
        originating_bank=request.originating_bank,
        syndicate_name=request.syndicate_name,
        attack_vector=request.attack_vector,
        detected_vocoder=request.detected_vocoder,
        threat_level=request.threat_level,
        caller_ani_prefix=request.caller_ani_prefix,
        attempted_amount_inr=request.attempted_amount_inr,
        voiceprint_hash=request.voiceprint_hash,
    )
    return result
