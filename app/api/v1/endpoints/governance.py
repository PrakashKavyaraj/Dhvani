"""
RBI FREE-AI & Model Risk Governance REST Router for Dhvani.

Endpoints:
1. GET `/api/v1/governance/model-cards`: Detailed model risk cards for all models.
2. GET `/api/v1/governance/rbi-free-ai`: 26-point FREE-AI compliance mapping.
3. GET `/api/v1/governance/dpdp-compliance`: DPDP Rules 2025 data flow & rights matrix.
4. POST `/api/v1/governance/explain-verdict`: Human-readable forensic explanation for analysts.
5. POST `/api/v1/governance/customer-dispute`: File a contestation against an AI decision.
6. GET `/api/v1/governance/customer-disputes`: Review active customer dispute cases.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.governance_service import governance_service

router = APIRouter(prefix="/governance", tags=["RBI FREE-AI & Model Governance"])


class ExplainVerdictRequest(BaseModel):
    analysis_verdict: Dict[str, Any] = Field(..., description="Full analysis verdict dictionary")


class CustomerDisputeRequest(BaseModel):
    call_sid: str = Field(..., description="Telephony call SID or session identifier")
    customer_account_id: str = Field(..., description="Customer bank account or CID")
    reason: str = Field(..., description="Reason for contesting the automated AI flag")
    officer_notes: Optional[str] = Field(None, description="Internal compliance officer commentary")


@router.get("/model-cards")
def get_model_cards():
    """Returns official model cards compliant with RBI Draft Model Risk Management guidelines."""
    return governance_service.get_model_cards()


@router.get("/rbi-free-ai")
def get_rbi_free_ai_matrix():
    """Returns the 26-point RBI FREE-AI compliance status across all 6 pillars."""
    return governance_service.get_rbi_free_ai_matrix()


@router.get("/dpdp-compliance")
def get_dpdp_compliance_profile():
    """Returns DPDP Act 2023 & Rules 2025 compliance data flow and 72-hour breach SLAs."""
    return governance_service.get_dpdp_compliance_profile()


@router.post("/explain-verdict")
def explain_verdict(payload: ExplainVerdictRequest):
    """
    Translates technical acoustic metrics into a plain-language explanation
    for fraud desk analysts and regulatory submissions.
    """
    return governance_service.generate_plain_language_explanation(payload.analysis_verdict)


@router.post("/customer-dispute")
def file_customer_dispute(payload: CustomerDisputeRequest):
    """
    Registers a customer appeal against an automated AI decision
    under RBI FREE-AI Pillar 4 contestability guidelines.
    """
    return governance_service.register_customer_dispute(
        call_sid=payload.call_sid,
        customer_account_id=payload.customer_account_id,
        reason=payload.reason,
        officer_notes=payload.officer_notes,
    )


@router.get("/customer-disputes")
def list_customer_disputes():
    """Lists all active customer disputes pending secondary human review."""
    return {"disputes": governance_service.list_disputes()}
