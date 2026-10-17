"""
Vendor Due Diligence, Security Controls, and Shadow Mode API Router for Dhvani.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security_auth import require_admin_role
from app.services.vendor_due_diligence_service import due_diligence_service
from app.services.shadow_mode_service import shadow_mode_engine

router = APIRouter(prefix="/vendor", tags=["Vendor Due Diligence & Shadow Mode"])


class IncidentReportRequest(BaseModel):
    incident_id: Optional[str] = Field(None, json_schema_extra={"example": "INC-2026-901"})
    severity: str = Field("HIGH", json_schema_extra={"example": "CRITICAL"})
    description: str = Field(
        "Suspected coordinated synthetic voice spoofing campaign targeting corporate wire authorizations.",
        json_schema_extra={"example": "Fraud syndicate replay attack attempt."},
    )
    affected_tenants: Optional[List[str]] = Field(None, json_schema_extra={"example": ["HDFC-BANK", "SBI-RETAIL"]})


class Section63CertificateRequest(BaseModel):
    call_sid: str = Field(..., json_schema_extra={"example": "CALL-9820-X10"})
    audio_sha256: str = Field(..., json_schema_extra={"example": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"})
    merkle_root: str = Field(..., json_schema_extra={"example": "7a8b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"})
    detection_score: float = Field(0.92, json_schema_extra={"example": 0.94})
    bank_name: str = Field("HDFC Bank (Wholesale Banking)", json_schema_extra={"example": "State Bank of India"})
    officer_name: str = Field("Rajeshwari Iyer", json_schema_extra={"example": "Venkatesh Ramanathan"})
    officer_designation: str = Field("Vice President, Information Security & Cyber Defense")
    system_hostname: str = Field("dhvani-prod-core-01.mumbai.internal")


class ShadowEvaluateRequest(BaseModel):
    session_id: str = Field(..., json_schema_extra={"example": "CALL-STREAM-01"})
    primary_score: float = Field(..., json_schema_extra={"example": 0.12})
    tenant_id: str = Field("HDFC-BANK", json_schema_extra={"example": "HDFC-BANK"})
    codec: str = Field("G711_ULAW", json_schema_extra={"example": "G711_ULAW"})


class ShadowPromoteRequest(BaseModel):
    officer_id: str = Field("ADMIN-CISO-01", json_schema_extra={"example": "ADMIN-CISO-01"})


@router.get("/security-pack")
def get_security_certifications() -> Dict[str, Any]:
    """
    Returns the comprehensive ISO 27001, SOC 2 Type II, and Cloud KMS/HSM posture pack.
    """
    return due_diligence_service.get_security_certifications_pack()


@router.get("/rbi-due-diligence")
def get_rbi_due_diligence() -> Dict[str, Any]:
    """
    Returns statutory due diligence dossier compliant with RBI Master Directions on IT Outsourcing
    and RBI FREE-AI Third-Party AI covenants.
    """
    return due_diligence_service.get_rbi_third_party_due_diligence()


@router.post("/incident-report")
def create_incident_report(payload: IncidentReportRequest) -> Dict[str, Any]:
    """
    Generates regulatory incident reporting dossiers for CERT-In (6-hour) and DPDP Board (72-hour).
    """
    return due_diligence_service.generate_incident_response_dossier(
        incident_id=payload.incident_id,
        severity=payload.severity,
        description=payload.description,
        affected_tenants=payload.affected_tenants,
    )


@router.post("/section-63-certificate")
def create_section_63_certificate(payload: Section63CertificateRequest) -> Dict[str, Any]:
    """
    Generates a formal Certificate of Electronic Evidence under Section 63 of Bharatiya Sakshya Adhiniyam, 2023.
    """
    return due_diligence_service.generate_bsa_section_63_certificate(
        call_sid=payload.call_sid,
        audio_sha256=payload.audio_sha256,
        merkle_root=payload.merkle_root,
        detection_score=payload.detection_score,
        bank_name=payload.bank_name,
        officer_name=payload.officer_name,
        officer_designation=payload.officer_designation,
        system_hostname=payload.system_hostname,
    )


@router.get("/shadow-mode/telemetry")
def get_shadow_telemetry() -> Dict[str, Any]:
    """
    Returns real-time shadow deployment telemetry, score drift, and circuit breaker health.
    """
    return shadow_mode_engine.get_shadow_telemetry()


@router.post("/shadow-mode/evaluate")
def evaluate_shadow_call(payload: ShadowEvaluateRequest) -> Dict[str, Any]:
    """
    Evaluates dual-inference for incoming call: live primary score + silent shadow score.
    """
    return shadow_mode_engine.evaluate_dual_inference(
        session_id=payload.session_id,
        primary_score=payload.primary_score,
        tenant_id=payload.tenant_id,
        codec=payload.codec,
    )


@router.post("/shadow-mode/promote", dependencies=[Depends(require_admin_role)])
def promote_shadow_model(payload: ShadowPromoteRequest) -> Dict[str, Any]:
    """
    Promotes the candidate shadow model to active production.
    """
    return shadow_mode_engine.promote_candidate_to_primary(officer_id=payload.officer_id)


@router.post("/shadow-mode/reset-circuit-breaker", dependencies=[Depends(require_admin_role)])
def reset_shadow_circuit_breaker() -> Dict[str, Any]:
    """
    Resets the shadow mode circuit breaker after analyst review.
    """
    return shadow_mode_engine.reset_circuit_breaker()
