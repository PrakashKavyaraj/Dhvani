"""
Comprehensive Test Suite for Multi-Tenant Architecture, pgvector, and Distributed Ephemeral Sessions.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.redis_session_store import RedisSessionStore, redis_session_store
from app.main import app
from app.services.multi_tenant_vector_store import (
    MultiTenantVectorStore,
    multi_tenant_vector_store,
)
from app.services.tenant_policy_service import TenantPolicyService, tenant_policy_service


@pytest.fixture
def test_vector_store(tmp_path):
    db_file = tmp_path / "test_tenant_vault.db"
    return MultiTenantVectorStore(db_path=db_file, vector_dim=192)


@pytest.fixture
def test_session_store():
    # In-memory mode instance
    return RedisSessionStore(redis_url=None, default_ttl=5)


@pytest.fixture
def client():
    return TestClient(app)


class TestRedisSessionStore:
    def test_append_and_get_window_audio(self, test_session_store):
        call_sid = "CALL-TEST-9901"
        chunk_1 = b"AAAA" * 80  # 320 bytes
        chunk_2 = b"BBBB" * 80  # 320 bytes

        len1 = test_session_store.append_chunk(call_sid, chunk_1, max_chunks=3)
        assert len1 == 1

        len2 = test_session_store.append_chunk(call_sid, chunk_2, max_chunks=3)
        assert len2 == 2

        audio = test_session_store.get_window_audio(call_sid)
        assert len(audio) == 640
        assert audio.startswith(chunk_1)
        assert audio.endswith(chunk_2)

    def test_sliding_window_trimming(self, test_session_store):
        call_sid = "CALL-TEST-TRIM"
        # Push 5 chunks with max_chunks=3
        for i in range(5):
            test_session_store.append_chunk(call_sid, f"CHUNK-{i:02d}".encode().ljust(32, b"."), max_chunks=3)

        audio = test_session_store.get_window_audio(call_sid)
        # Only chunks 2, 3, 4 should remain
        assert b"CHUNK-00" not in audio
        assert b"CHUNK-01" not in audio
        assert b"CHUNK-02" in audio
        assert b"CHUNK-04" in audio

    def test_clear_session_purges_memory(self, test_session_store):
        call_sid = "CALL-TEST-WIPE"
        test_session_store.append_chunk(call_sid, b"SENSITIVE-AUDIO-BYTES", max_chunks=10)
        assert len(test_session_store.get_window_audio(call_sid)) > 0

        test_session_store.clear_session(call_sid)
        assert test_session_store.get_window_audio(call_sid) == b""

    def test_circuit_breaker_threshold(self, test_session_store):
        carrier = "TEST_EXOTEL"
        test_session_store.reset_circuit_breaker(carrier)
        assert not test_session_store.is_circuit_breaker_open(carrier, threshold=3)

        # Record 2 failures
        test_session_store.record_circuit_failure(carrier, window_seconds=10)
        test_session_store.record_circuit_failure(carrier, window_seconds=10)
        assert not test_session_store.is_circuit_breaker_open(carrier, threshold=3)

        # 3rd failure trips the breaker
        test_session_store.record_circuit_failure(carrier, window_seconds=10)
        assert test_session_store.is_circuit_breaker_open(carrier, threshold=3)

        # Reset clears it
        test_session_store.reset_circuit_breaker(carrier)
        assert not test_session_store.is_circuit_breaker_open(carrier, threshold=3)

    def test_health_telemetry(self, test_session_store):
        health = test_session_store.get_health()
        assert "status" in health
        assert health["status"] in ["HEALTHY", "OPERATIONAL", "DEGRADED"]


class TestMultiTenantVectorStore:
    def test_enroll_and_verify_speaker(self, test_vector_store):
        tenant_id = "HDFC-BANK"
        customer_id = "CUST-9901"
        rng = np.random.RandomState(42)
        base_emb = rng.randn(192).astype(np.float32)

        enroll_res = test_vector_store.enroll_voiceprint(
            tenant_id=tenant_id,
            customer_account_id=customer_id,
            embedding=base_emb,
            speaker_name="Rajesh Verma",
        )
        assert enroll_res["status"] == "ENROLLED_ACTIVE"
        assert enroll_res["tenant_id"] == "HDFC-BANK"
        assert len(enroll_res["voice_token_sha256"]) == 64

        # Test verification with exact embedding
        verify_res = test_vector_store.verify_speaker(
            tenant_id=tenant_id,
            customer_account_id=customer_id,
            query_embedding=base_emb,
            threshold=0.75,
        )
        assert verify_res["verified"] is True
        assert verify_res["similarity"] >= 0.99
        assert verify_res["decision"] == "STRONG_MATCH"

        # Test verification with orthogonal noise embedding (suspected impersonation)
        noise_emb = rng.randn(192).astype(np.float32)
        fake_res = test_vector_store.verify_speaker(
            tenant_id=tenant_id,
            customer_account_id=customer_id,
            query_embedding=noise_emb,
            threshold=0.75,
        )
        assert fake_res["verified"] is False
        assert fake_res["similarity"] < 0.50
        assert fake_res["decision"] == "SUSPECTED_IMPERSONATION"

    def test_tenant_isolation_partition(self, test_vector_store):
        # Enrolling customer in HDFC-BANK must not be visible under ICICI-CORP
        rng = np.random.RandomState(10)
        emb = rng.randn(192).astype(np.float32)

        test_vector_store.enroll_voiceprint(
            tenant_id="HDFC-BANK",
            customer_account_id="CUST-HDFC-ONLY",
            embedding=emb,
        )

        hdfc_verify = test_vector_store.verify_speaker(
            tenant_id="HDFC-BANK",
            customer_account_id="CUST-HDFC-ONLY",
            query_embedding=emb,
        )
        assert hdfc_verify["verified"] is True

        icici_verify = test_vector_store.verify_speaker(
            tenant_id="ICICI-CORP",
            customer_account_id="CUST-HDFC-ONLY",
            query_embedding=emb,
        )
        assert icici_verify["status"] == "CUSTOMER_NOT_FOUND"
        assert icici_verify["verified"] is False

    def test_dpdp_right_to_erasure_purge(self, test_vector_store):
        rng = np.random.RandomState(77)
        emb = rng.randn(192).astype(np.float32)

        test_vector_store.enroll_voiceprint(
            tenant_id="SBI-RETAIL",
            customer_account_id="CUST-PURGE-ME",
            embedding=emb,
        )

        purge_res = test_vector_store.purge_customer("SBI-RETAIL", "CUST-PURGE-ME")
        assert purge_res["status"] == "PURGED_SUCCESS"
        assert purge_res["records_purged"] >= 1

        check = test_vector_store.verify_speaker("SBI-RETAIL", "CUST-PURGE-ME", emb)
        assert check["status"] == "CUSTOMER_NOT_FOUND"

    def test_pgvector_ddl_schema(self, test_vector_store):
        ddl = test_vector_store.get_pgvector_ddl()
        assert "CREATE EXTENSION IF NOT EXISTS vector;" in ddl
        assert "embedding vector(192)" in ddl
        assert "USING hnsw (embedding vector_cosine_ops)" in ddl
        assert "tenant_id VARCHAR(64)" in ddl


class TestTenantPolicyService:
    def test_policy_resolution(self):
        svc = TenantPolicyService()
        hdfc = svc.resolve_tenant(api_key="dhvani_live_hdfc_key_2026")
        assert hdfc.tenant_id == "HDFC-BANK"
        assert hdfc.block_threshold == 70

        icici = svc.resolve_tenant(api_key="dhvani_live_icici_key_2026")
        assert icici.tenant_id == "ICICI-CORP"
        assert icici.block_threshold == 50

        # Header fallback
        axis = svc.resolve_tenant(tenant_header="AXIS-WEALTH")
        assert axis.tenant_id == "AXIS-WEALTH"
        assert axis.sla_budget_ms == 200.0

    def test_update_tenant_policy(self):
        svc = TenantPolicyService()
        updated = svc.update_policy(
            tenant_id="CUSTOM-BANK",
            block_threshold=65,
            step_up_threshold=30,
            sla_budget_ms=280.0,
            institution_name="Custom Cooperative Bank",
        )
        assert updated.tenant_id == "CUSTOM-BANK"
        assert updated.block_threshold == 65
        assert updated.step_up_threshold == 30
        assert updated.sla_budget_ms == 280.0


class TestMultiTenantEndpoints:
    def test_list_tenants_endpoint(self, client):
        resp = client.get("/api/v1/tenants")
        assert resp.status_code == 200
        data = resp.json()
        assert "tenants" in data
        assert len(data["tenants"]) >= 4

    def test_get_pgvector_ddl_endpoint(self, client):
        resp = client.get("/api/v1/tenants/pgvector-ddl")
        assert resp.status_code == 200
        data = resp.json()
        assert data["vector_dimensions"] == 192
        assert "vector_cosine_ops" in data["sql_schema"]

    def test_get_redis_health_endpoint(self, client):
        resp = client.get("/api/v1/tenants/redis-session/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data

    def test_get_tenant_stats_endpoint(self, client):
        resp = client.get("/api/v1/tenants/HDFC-BANK/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == "HDFC-BANK"
        assert "vault" in data
        assert "policy" in data

    def test_update_tenant_policy_endpoint(self, client):
        payload = {
            "tenant_id": "HDFC-BANK",
            "block_threshold": 68,
            "step_up_threshold": 32,
            "sla_budget_ms": 320.0,
        }
        resp = client.post("/api/v1/tenants", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "POLICY_UPDATED"
        assert data["block_threshold"] == 68

    def test_purge_customer_endpoint(self, client):
        payload = {"customer_account_id": "CUST-API-PURGE-01"}
        resp = client.post("/api/v1/tenants/HDFC-BANK/purge-customer", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "PURGED_SUCCESS"
