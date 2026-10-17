"""
Joint Spoofing-Aware Speaker Verification (SASV) API Router for Dhvani.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.sasv_fusion_service import sasv_service

router = APIRouter(prefix="/sasv", tags=["Joint SASV (CM + ASV)"])


class JointVerdictRequest(BaseModel):
    cm_synthetic_prob: float = Field(..., json_schema_extra={"example": 0.08})
    asv_similarity: float = Field(..., json_schema_extra={"example": 0.88})
    transfer_amount_inr: float = Field(0.0, json_schema_extra={"example": 750000.0})
    customer_account_id: Optional[str] = Field(None, json_schema_extra={"example": "HDFC-CORP-4820"})


@router.post("/joint-verdict")
def evaluate_joint_sasv(payload: JointVerdictRequest) -> Dict[str, Any]:
    """
    Evaluates joint decision fusing Countermeasure (CM: Forensics-0.3B & AASIST-L)
    and Automatic Speaker Verification (ASV: ECAPA-TDNN 192-dim voiceprint).
    """
    return sasv_service.compute_joint_verdict(
        cm_synthetic_prob=payload.cm_synthetic_prob,
        asv_similarity=payload.asv_similarity,
        transfer_amount_inr=payload.transfer_amount_inr,
        customer_account_id=payload.customer_account_id,
    )


@router.get("/benchmark")
def get_sasv_benchmark() -> Dict[str, Any]:
    """
    Returns frozen SASV benchmark metrics (SASV EER, Zero-Effort Impostor EER,
    Spoofed Target EER, minDCF, and Banking actDCF).
    """
    return sasv_service.evaluate_sasv_benchmark()
