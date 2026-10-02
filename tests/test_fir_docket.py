"""
Unit & Integration Test Suite for Cyber Crime FIR & Regulatory Evidence Docket Generator.

Validates:
1. Police FIR formal legal narrative generation under IT Act Section 66D & BNS Sections 318-319
2. RBI Central Fraud Registry (CFR) Master Directions schedule formatting
3. BSA Section 63 / Evidence Act Section 65B cryptographic integrity certifications
4. REST endpoints for automated docket compilation
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.fir_docket_service import (
    FIRDocketService,
    fir_docket_service,
)


@pytest.fixture
def client():
    return TestClient(app)


class TestFIRDocketService:
    def test_generate_docket_narrative_and_cfr(self):
        service = FIRDocketService()
        sample_result = {
            "analysis_id": "SBI-ATTACK-001",
            "synthetic_speech_probability": 0.94,
            "risk_score": 93,
            "audio_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "merkle_root": "1122334455667788990011223344556677889900112233445566778899001122",
            "vocoder_attribution": {
                "family_name": "HiFi-GAN (Multi-Period Discriminator GAN)",
            },
        }

        docket = service.generate_docket(
            analysis_result=sample_result,
            bank_name="State Bank of India (Priority Banking)",
            caller_ani="+91-98201-77889",
            claimed_account_id="SBI-9104",
            attempted_amount_inr=1850000.0,
        )

        assert docket["status"] == "DOCKET_GENERATED"
        assert docket["docket_id"].startswith("I4C-CFR-")
        assert docket["averted_amount_inr"] == 1850000.0
        assert "Section 66D, Information Technology Act" in docket["police_fir_complaint_text"]
        assert "Section 318 & 319, Bharatiya Nyaya Sanhita" in docket["police_fir_complaint_text"]
        assert "Section 63, Bharatiya Sakshya Adhiniyam" in docket["police_fir_complaint_text"]
        assert "+91-98201-77889" in docket["police_fir_complaint_text"]
        assert "HiFi-GAN" in docket["police_fir_complaint_text"]

        # Check RBI CFR schedule
        cfr = docket["rbi_cfr_schedule"]
        assert cfr["rbi_cfr_format_version"] == "CFR-2023-V2"
        assert cfr["loss_averted_inr"] == 1850000.0
        assert cfr["loss_incurred_inr"] == 0.0

    def test_get_statutory_guidelines(self):
        service = FIRDocketService()
        res = service.get_statutory_guidelines()
        assert res["status"] == "GUIDELINES_ACTIVE"
        assert len(res["legislation_references"]) >= 4
        acts = [ref["act"] for ref in res["legislation_references"]]
        assert any("Information Technology Act" in a for a in acts)
        assert any("Bharatiya Nyaya Sanhita" in a for a in acts)
        assert any("Bharatiya Sakshya Adhiniyam" in a for a in acts)


class TestFIRDocketRESTEndpoints:
    def test_get_statutory_guidelines_endpoint(self, client):
        resp = client.get("/api/v1/docket/statutory-guidelines")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "GUIDELINES_ACTIVE"

    def test_generate_docket_endpoint(self, client):
        payload = {
            "analysis_result": {
                "analysis_id": "API-TEST-DOCKET-01",
                "synthetic_speech_probability": 0.91,
                "risk_score": 89,
                "audio_sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            },
            "bank_name": "HDFC Bank Corporate Banking",
            "branch_code": "HDFC-DLH-012",
            "caller_ani": "+91-98111-22334",
            "claimed_account_id": "HDFC-CORP-4402",
            "attempted_amount_inr": 2500000.0,
        }
        resp = client.post("/api/v1/docket/generate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "DOCKET_GENERATED"
        assert "I4C-CFR-" in data["docket_id"]
        assert data["averted_amount_inr"] == 2500000.0
        assert "police_fir_complaint_text" in data
        assert "rbi_cfr_schedule" in data
