"""
Unit tests for Vendor Due Diligence, Security Controls, and Shadow Mode Deployment.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.vendor_due_diligence_service import due_diligence_service
from app.services.shadow_mode_service import shadow_mode_engine

client = TestClient(app)


def test_security_certifications_pack():
    pack = due_diligence_service.get_security_certifications_pack()
    assert pack["vendor_name"] == "Dhvani Voice Integrity Systems Private Limited"
    assert "ISO/IEC 27001:2022" in str(pack["certifications"])
    assert "SOC 2 Type II" in str(pack["certifications"])
    assert len(pack["key_management"]["active_keys"]) >= 2
    assert pack["secure_software_lifecycle"]["sbom_format"] == "CycloneDX v1.5 / SPDX 2.3"


def test_rbi_third_party_due_diligence():
    res = due_diligence_service.get_rbi_third_party_due_diligence()
    assert res["due_diligence_status"] == "SUPPORTING_BANK_FREE_AI_AND_OUTSOURCING_COMPLIANCE"
    assert len(res["covenants"]) == 5
    assert res["sla_commitments"]["voice_decision_latency_budget_ms"] == 350
    assert res["sla_commitments"]["telephony_availability_sla_percent"] == 99.999


def test_incident_response_dossier():
    dossier = due_diligence_service.generate_incident_response_dossier(
        severity="CRITICAL",
        description="Simulated adversarial acoustic replay spike on IVR line.",
        affected_tenants=["HDFC-BANK", "ICICI-TREASURY"],
    )
    assert dossier["incident_severity"] == "CRITICAL"
    assert "HDFC-BANK" in dossier["affected_institutions"]
    assert dossier["regulatory_filing_schedules"]["cert_in_statutory_filing"]["reporting_window_hours"] == 6
    assert dossier["regulatory_filing_schedules"]["dpdp_board_filing"]["reporting_window_hours"] == 72


def test_bsa_section_63_certificate():
    cert = due_diligence_service.generate_bsa_section_63_certificate(
        call_sid="CALL-TEST-8819",
        audio_sha256="4f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
        merkle_root="9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
        detection_score=0.96,
        bank_name="Axis Wealth Management",
        officer_name="Kavita Deshmukh",
        officer_designation="Principal Director, Security Architecture",
    )
    assert cert["statute"] == "Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023"
    assert "SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM" in cert["certificate_text"]
    assert "Kavita Deshmukh" in cert["certificate_text"]
    assert "CALL-TEST-8819" in cert["certificate_text"]
    assert cert["tamper_evident_status"] == "CRYPTOGRAPHICALLY_VERIFIED"


def test_shadow_mode_evaluation_and_telemetry():
    # Evaluate a sequence of shadow inferences
    for i in range(25):
        res = shadow_mode_engine.evaluate_dual_inference(
            session_id=f"CALL-EVAL-{i}",
            primary_score=0.15,
            tenant_id="HDFC-BANK",
            codec="G711_ULAW",
        )
        assert res["shadow_active"] is True
        assert "divergence" in res

    telemetry = shadow_mode_engine.get_shadow_telemetry()
    assert telemetry["status"] == "SHADOW_ENGINE_ONLINE"
    assert telemetry["telemetry"]["total_calls_evaluated"] >= 25
    assert telemetry["telemetry"]["mean_primary_score"] == 0.15
    assert telemetry["circuit_breaker"]["tripped"] is False


def test_shadow_mode_promotion():
    promo = shadow_mode_engine.promote_candidate_to_primary(officer_id="CHIEF-RISK-OFFICER-01")
    assert promo["action"] == "PROMOTION_SUCCESSFUL"
    assert promo["new_primary_model"]["model_id"] == "dhvani-forensics-v1.2-multiview-calibrated"
    assert promo["new_primary_model"]["status"] == "PRIMARY_ACTIVE"

    # Reset circuit breaker
    rst = shadow_mode_engine.reset_circuit_breaker()
    assert rst["status"] == "CIRCUIT_BREAKER_RESET"


def test_api_vendor_endpoints():
    r1 = client.get("/api/v1/vendor/security-pack")
    assert r1.status_code == 200
    assert r1.json()["vendor_name"] == "Dhvani Voice Integrity Systems Private Limited"

    r2 = client.get("/api/v1/vendor/rbi-due-diligence")
    assert r2.status_code == 200
    assert len(r2.json()["covenants"]) == 5

    r3 = client.post("/api/v1/vendor/incident-report", json={
        "severity": "HIGH",
        "description": "Integration test incident.",
        "affected_tenants": ["SBI-RETAIL"],
    })
    assert r3.status_code == 200
    assert r3.json()["incident_severity"] == "HIGH"

    r4 = client.post("/api/v1/vendor/section-63-certificate", json={
        "call_sid": "CALL-API-01",
        "audio_sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "merkle_root": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "detection_score": 0.89,
        "bank_name": "ICICI Bank",
        "officer_name": "Arjun Singhal",
        "officer_designation": "Head of Fraud Prevention",
        "system_hostname": "icici-core-01",
    })
    assert r4.status_code == 200
    assert "Arjun Singhal" in r4.json()["certificate_text"]

    r5 = client.get("/api/v1/vendor/shadow-mode/telemetry")
    assert r5.status_code == 200
    assert r5.json()["status"] == "SHADOW_ENGINE_ONLINE"
