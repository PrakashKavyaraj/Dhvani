"""
Cyber Crime FIR & Regulatory Evidence Docket Generator REST Endpoints for Dhvani.

Features:
- Generates Section 66D IT Act / Section 318-319 BNS Police FIR Complaint text
- Generates RBI Central Fraud Registry (CFR) Master Directions structured filing dossier
- Cryptographic Section 63 BSA 2023 evidence certification
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.fir_docket_service import (
    fir_docket_service,
)

router = APIRouter(prefix="/docket", tags=["Cyber Crime FIR & Regulatory Evidence Docket"])


class GenerateDocketRequest(BaseModel):
    analysis_result: Dict[str, Any] = Field(..., description="Forensic analysis result object")
    bank_name: str = Field("State Bank of India (Priority Banking)", description="Reporting bank")
    branch_code: str = Field("SBI-MUM-004", description="Branch identifier")
    nodal_officer_name: str = Field("Venkatesh Ramanathan", description="Reporting CISO or Nodal Officer")
    nodal_officer_title: str = Field("Chief Information Security Officer (CISO)", description="Officer designation")
    caller_ani: str = Field("+91-98201-XXXXX", description="Caller phone number (ANI)")
    claimed_account_id: str = Field("SBI-PRIORITY-9104", description="Victim account identifier")
    attempted_amount_inr: float = Field(1850000.0, ge=0.0, description="Fraudulent transfer amount averted in INR")
    supervisor_escalation_id: Optional[str] = Field(None, description="Optional supervisor escalation docket ID")


@router.get(
    "/statutory-guidelines",
    status_code=status.HTTP_200_OK,
    summary="Get statutory legal guidelines under IT Act 2000, BNS 2023, and BSA 2023",
)
async def get_statutory_guidelines():
    """Returns statutory legal matrix and evidentiary standards for electronic deepfake complaints."""
    return fir_docket_service.get_statutory_guidelines()


@router.post(
    "/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate Cyber Crime FIR Complaint & RBI CFR Dossier",
)
async def generate_docket(request: GenerateDocketRequest):
    """Compiles complete court-admissible FIR complaint narrative and structured RBI CFR schedule."""
    docket = fir_docket_service.generate_docket(
        analysis_result=request.analysis_result,
        bank_name=request.bank_name,
        branch_code=request.branch_code,
        nodal_officer_name=request.nodal_officer_name,
        nodal_officer_title=request.nodal_officer_title,
        caller_ani=request.caller_ani,
        claimed_account_id=request.claimed_account_id,
        attempted_amount_inr=request.attempted_amount_inr,
        supervisor_escalation_id=request.supervisor_escalation_id,
    )
    return docket
