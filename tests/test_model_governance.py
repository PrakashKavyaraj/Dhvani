"""
Unit & Integration Test Suite for RBI FREE-AI & Model Risk Governance Service.

Validates:
1. Model cards compliance under RBI Draft Model Risk Management guidelines.
2. 26-point FREE-AI compliance framework mapping across 6 pillars.
3. DPDP Act 2023 & DPDP Rules 2025 data flow hierarchy and 72-hour notification SLA.
4. Plain-language forensic explainability generator for fraud desk analysts.
5. Customer dispute registration and audit listing under FREE-AI Pillar 4.
6. REST endpoints for model governance.
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.governance_service import (
    MODEL_CARDS,
    RBI_FREE_AI_PILLARS,
    ModelGovernanceService,
    governance_service,
)


@pytest.fixture
def client():
    return TestClient(app)


class TestModelGovernanceService:
    def test_model_cards_structure(self):
        service = ModelGovernanceService()
        cards = service.get_model_cards()
        assert cards["status"] == "MODEL_CARDS_ACTIVE"
        assert cards["total_models"] >= 4
        assert "Forensics-0.3B" in cards["models"]
        assert "AASIST-L" in cards["models"]
        assert "ECAPA-TDNN" in cards["models"]

        # Check WavLM details
        wavlm = cards["models"]["Forensics-0.3B"]
        assert "WavLM" in wavlm["primary_architecture"]
        assert len(wavlm["known_limitations"]) >= 2
        assert "ethical_guardrails" in wavlm

    def test_rbi_free_ai_matrix(self):
        service = ModelGovernanceService()
        free_ai = service.get_rbi_free_ai_matrix()
        assert free_ai["status"] == "FREE_AI_ASSESSMENT_ACTIVE"
        assert len(free_ai["pillars"]) == 6

        pillars = free_ai["pillars"]
        assert "Pillar_1_Infrastructure" in pillars
        assert "Pillar_4_Governance" in pillars
        assert "Pillar_5_Protection" in pillars
        assert pillars["Pillar_5_Protection"]["dhvani_compliance_status"] == "FULLY_COMPLIANT"

    def test_dpdp_compliance_profile(self):
        service = ModelGovernanceService()
        dpdp = service.get_dpdp_compliance_profile()
        assert dpdp["status"] == "DPDP_COMPLIANCE_ACTIVE"
        hierarchy = dpdp["data_classification_hierarchy"]

        assert "tier_1_raw_audio" in hierarchy
        assert hierarchy["tier_1_raw_audio"]["disk_persistence_bytes"] == 0
        assert "Section 8(7)" in hierarchy["tier_1_raw_audio"]["legal_ground"]

        assert "tier_2_voice_embeddings" in hierarchy
        assert "Rule 8(3)" in hierarchy["tier_2_voice_embeddings"]["consent_rule"]

        sla = dpdp["incident_response_sla"]
        assert "72 Hours" in sla["dpdp_board_notice"]
        assert "6 Hours" in sla["cert_in_direction"]

    def test_plain_language_explanation_high_risk(self):
        service = ModelGovernanceService()
        sample_verdict = {
            "synthetic_speech_probability": 0.92,
            "calibrated_probability": 0.94,
            "risk_score": 94,
            "channel_status": "G.711_ALAW_8K",
            "evidence": {
                "spectral_anomaly": "high",
                "prosody_anomaly": "synthetic_drift",
            },
        }

        explanation = service.generate_plain_language_explanation(sample_verdict)
        assert explanation["verdict_summary"] == "FLAGGED_FOR_FRAUD"
        assert explanation["risk_score"] == 94
        assert "High-confidence synthetic speech detected" in explanation["plain_language_narrative"]
        assert "transposed convolution" in explanation["plain_language_narrative"]
        assert len(explanation["bullet_points"]) >= 3

    def test_customer_dispute_registration(self):
        service = ModelGovernanceService()
        dispute = service.register_customer_dispute(
            call_sid="CALL-DISPUTE-01",
            customer_account_id="SBI-RET-8819",
            reason="Caller claims hoarse voice due to seasonal laryngitis, not AI synthetic speech.",
            officer_notes="Customer branch visit requested for physical biometric verification.",
        )

        assert dispute["status"] == "UNDER_SECONDARY_HUMAN_REVIEW"
        assert dispute["dispute_id"].startswith("DISP-")
        assert dispute["sla_resolution_hours"] == 48

        all_disp = service.list_disputes()
        assert any(d["dispute_id"] == dispute["dispute_id"] for d in all_disp)


class TestModelGovernanceEndpoints:
    def test_get_model_cards_endpoint(self, client):
        resp = client.get("/api/v1/governance/model-cards")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "MODEL_CARDS_ACTIVE"
        assert "Forensics-0.3B" in data["models"]

    def test_get_rbi_free_ai_endpoint(self, client):
        resp = client.get("/api/v1/governance/rbi-free-ai")
        assert resp.status_code == 200
        data = resp.json()
        assert data["overall_status"] == "ENTERPRISE_ALIGNED"
        assert len(data["pillars"]) == 6

    def test_get_dpdp_compliance_endpoint(self, client):
        resp = client.get("/api/v1/governance/dpdp-compliance")
        assert resp.status_code == 200
        data = resp.json()
        assert "enforcement_timeline" in data
        assert "14 November 2026" in data["enforcement_timeline"]["consent_manager_registration"]

    def test_explain_verdict_endpoint(self, client):
        payload = {
            "analysis_verdict": {
                "synthetic_speech_probability": 0.88,
                "calibrated_probability": 0.89,
                "risk_score": 89,
                "channel_status": "AMR_NB_CELLULAR",
                "evidence": {
                    "spectral_anomaly": "high",
                    "prosody_anomaly": "synthetic_drift",
                },
            }
        }
        resp = client.post("/api/v1/governance/explain-verdict", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict_summary"] == "FLAGGED_FOR_FRAUD"
        assert "plain_language_narrative" in data

    def test_customer_dispute_endpoint_flow(self, client):
        payload = {
            "call_sid": "CALL-API-DISP-01",
            "customer_account_id": "HDFC-CORP-919",
            "reason": "False alarm on executive voice confirmation.",
        }
        resp = client.post("/api/v1/governance/customer-dispute", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "UNDER_SECONDARY_HUMAN_REVIEW"
        assert "DISP-" in data["dispute_id"]

        resp_list = client.get("/api/v1/governance/customer-disputes")
        assert resp_list.status_code == 200
        disputes = resp_list.json()["disputes"]
        assert len(disputes) >= 1
