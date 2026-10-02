"""
Unit & Integration Test Suite for Inter-Bank Fraud Syndicate Federation.

Validates:
1. Federation network status and participating banking nodes
2. Real-time threat bulletin aggregation and sorting
3. Cross-bank threat broadcasting and HNSW synchronization
4. REST endpoints for network stats, bulletin feed, and broadcast actions
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.federation_service import (
    InterBankFederationService,
    federation_service,
)


@pytest.fixture
def client():
    return TestClient(app)


class TestInterBankFederationService:
    def test_get_federation_stats(self):
        service = InterBankFederationService()
        stats = service.get_federation_stats()
        assert stats["status"] == "FEDERATION_OPERATIONAL"
        assert stats["participating_banks_count"] >= 5
        assert stats["total_losses_averted_inr"] > 10000000.0
        assert stats["total_active_bulletins"] >= 3
        bank_codes = [node["bank_code"] for node in stats["member_nodes"]]
        assert "SBI" in bank_codes
        assert "HDFC" in bank_codes
        assert "ICICI" in bank_codes

    def test_get_bulletins(self):
        service = InterBankFederationService()
        bulletins = service.get_bulletins()
        assert len(bulletins) >= 3
        top = bulletins[0]
        assert "bulletin_id" in top
        assert "syndicate_id" in top
        assert "threat_level" in top
        assert "total_losses_averted_inr" in top

    def test_broadcast_threat(self):
        service = InterBankFederationService()
        initial_count = len(service.get_bulletins())

        res = service.broadcast_threat(
            originating_bank="AXIS",
            syndicate_name="Axis Fake Beneficiary Voice Ring",
            attack_vector="VITS Zero-shot Voice Conversion via Telegram Bot",
            detected_vocoder="BigVGAN (Periodic Snake)",
            threat_level="CRITICAL",
            caller_ani_prefix="+91-99881-XXXXX",
            attempted_amount_inr=3200000.0,
        )

        assert res["status"] == "BROADCAST_SUCCESSFUL"
        assert res["hnsw_blacklist_updated"] is True
        assert res["synchronized_nodes_count"] >= 5
        assert len(service.get_bulletins()) == initial_count + 1
        assert service.get_bulletins()[0]["originating_bank"] == "AXIS"


class TestFederationRESTEndpoints:
    def test_get_stats_endpoint(self, client):
        resp = client.get("/api/v1/federation/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "FEDERATION_OPERATIONAL"
        assert data["participating_banks_count"] >= 5

    def test_get_bulletins_endpoint(self, client):
        resp = client.get("/api/v1/federation/bulletins")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "BULLETINS_RETRIEVED"
        assert len(data["bulletins"]) >= 3

    def test_broadcast_threat_endpoint(self, client):
        payload = {
            "originating_bank": "ICICI",
            "syndicate_name": "ICICI Wealth Management Impersonator",
            "attack_vector": "HiFi-GAN ElevenLabs Clone",
            "detected_vocoder": "HiFi-GAN",
            "threat_level": "CRITICAL",
            "caller_ani_prefix": "+91-97110-XXXXX",
            "attempted_amount_inr": 4500000.0,
        }
        resp = client.post("/api/v1/federation/broadcast", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "BROADCAST_SUCCESSFUL"
        assert data["bulletin"]["originating_bank"] == "ICICI"
