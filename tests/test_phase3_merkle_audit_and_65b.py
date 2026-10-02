import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.merkle_audit_service import (
    MerkleAuditService,
    merkle_audit_service,
)
from app.core.security_engine import security_engine
from app.schemas.risk_schema import (
    AudioSignalsIn,
    ContextSignalsIn,
    EvaluateRiskRequest,
)


class TestMerkleAuditService:
    """Unit tests for Cryptographic Merkle Ledger & Section 65B evidence generation."""

    def test_record_event_and_merkle_chaining(self):
        t0 = time.time()
        rec1 = merkle_audit_service.record_event(
            session_id="test-session-merkle-1",
            timestamp=t0,
            voice_token="TOKEN_ALPHA_001",
            threat_score=15,
            threat_tier="LOW",
            action="ALLOW_STREAM",
            forensic_summary="Natural speaker verified.",
        )
        assert rec1["leaf_index"] >= 0
        assert len(rec1["leaf_hash"]) == 64
        assert len(rec1["merkle_root"]) == 64
        assert "TSA-" in rec1["rfc3161_token"]

        rec2 = merkle_audit_service.record_event(
            session_id="test-session-merkle-2",
            timestamp=t0 + 1.0,
            voice_token="TOKEN_BETA_002",
            threat_score=85,
            threat_tier="HIGH",
            action="TERMINATE_AND_ALERT_FRAUD_DESK",
            forensic_summary="Synthetic deepfake speech detected.",
        )
        assert rec2["leaf_index"] == rec1["leaf_index"] + 1
        assert rec2["prev_leaf_hash"] == rec1["leaf_hash"]  # Strict cryptographic hash chaining
        assert rec2["merkle_root"] != rec1["merkle_root"]  # Root dynamically rolls forward

    def test_mathematical_proof_of_inclusion(self):
        leaf_idx = 0
        proof = merkle_audit_service.get_merkle_proof(leaf_idx)
        assert proof["leaf_index"] == leaf_idx
        assert "proof_path" in proof
        assert "merkle_root" in proof

        # Mathematical verification
        is_valid = merkle_audit_service.verify_merkle_proof(
            leaf_hash=proof["leaf_hash"],
            proof_path=proof["proof_path"],
            expected_root=proof["merkle_root"],
        )
        assert is_valid is True

    def test_tamper_detection_fails_invalid_proof(self):
        leaf_idx = 0
        proof = merkle_audit_service.get_merkle_proof(leaf_idx)
        # Flip a single character in the leaf hash (simulating database tampering)
        tampered_hash = "f" + proof["leaf_hash"][1:]
        is_valid = merkle_audit_service.verify_merkle_proof(
            leaf_hash=tampered_hash,
            proof_path=proof["proof_path"],
            expected_root=proof["merkle_root"],
        )
        assert is_valid is False  # Tamper detected immediately

    def test_section_65b_certificate_generation(self):
        session_id = "test-session-merkle-65b"
        _ = merkle_audit_service.record_event(
            session_id=session_id,
            timestamp=time.time(),
            voice_token="TOKEN_COURT_LEGAL_65B",
            threat_score=92,
            threat_tier="HIGH",
            action="TERMINATE_AND_ALERT_FRAUD_DESK",
            forensic_summary="Digital Arrest extortionist syndicate match.",
        )

        cert = merkle_audit_service.generate_section_65b_certificate(session_id)
        assert cert["status"] == "ISSUED"
        assert cert["session_id"] == session_id
        assert cert["merkle_proof_verified"] is True
        assert "Section 65B(4), Indian Evidence Act, 1872" in cert["statutory_acts"]
        assert "Section 63, Bharatiya Sakshya Adhiniyam, 2023" in cert["statutory_acts"]
        assert "Digital Personal Data Protection Act, 2023" in cert["statutory_acts"]
        assert "CERTIFICATE UNDER SECTION 65B" in cert["legal_affidavit_markdown"]


class TestSecurityEngineMerkleIntegration:
    """Tests that SecurityEngine automatically writes every decision to the Merkle ledger."""

    def test_evaluate_populates_merkle_fields(self):
        req = EvaluateRiskRequest(
            audio_signals=AudioSignalsIn(
                acoustic_fake_prob=0.88,
                codec_compression_anomaly=0.40,
                spectral_discontinuity=0.60,
                snr_db=19.5,
                detected_codec="PCM",
            ),
            context_signals=ContextSignalsIn(
                session_id="test-engine-merkle-session",
                turn_index=1,
                transcript="Transfer funds immediately",
                caller_id_verified=False,
                user_consent_granted=True,
            ),
        )
        resp = security_engine.evaluate(req)
        assert resp.audit_log.leaf_index is not None
        assert resp.audit_log.leaf_hash is not None
        assert resp.audit_log.merkle_root is not None
        assert resp.audit_log.rfc3161_token is not None
        assert len(resp.audit_log.leaf_hash) == 64


class TestAuditRESTEndpoints:
    """Integration tests for Audit REST endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_get_ledger_and_stats(self, client):
        resp = client.get("/api/v1/audit/ledger?limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "blocks" in data
        assert len(data["blocks"]) > 0

        stats_resp = client.get("/api/v1/audit/stats")
        assert stats_resp.status_code == 200
        stats = stats_resp.json()
        assert stats["total_audit_blocks"] > 0
        assert stats["hash_algorithm"] == "SHA-256"
        assert stats["dpdp_compliant"] is True

    def test_get_proof_and_verify_endpoint(self, client):
        session_id = "test-endpoint-proof-session"
        _ = merkle_audit_service.record_event(
            session_id=session_id,
            timestamp=time.time(),
            voice_token="TOKEN_PROOF_TEST",
            threat_score=45,
            threat_tier="MEDIUM",
            action="STEP_UP_LIVENESS_CHALLENGE",
        )

        proof_resp = client.get(f"/api/v1/audit/proof/{session_id}")
        assert proof_resp.status_code == 200
        proof_data = proof_resp.json()
        assert proof_data["session_id"] == session_id
        assert "proof_path" in proof_data

        # Post back to verify endpoint
        verify_resp = client.post(
            "/api/v1/audit/verify-proof",
            json={
                "leaf_hash": proof_data["leaf_hash"],
                "proof_path": proof_data["proof_path"],
                "expected_root": proof_data["merkle_root"],
            },
        )
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["valid"] is True

    def test_get_section_65b_endpoint(self, client):
        session_id = "test-endpoint-65b-session"
        _ = merkle_audit_service.record_event(
            session_id=session_id,
            timestamp=time.time(),
            voice_token="TOKEN_65B_API",
            threat_score=75,
            threat_tier="HIGH",
            action="TERMINATE_AND_ALERT_FRAUD_DESK",
        )

        cert_resp = client.get(f"/api/v1/audit/section-65b/{session_id}")
        assert cert_resp.status_code == 200
        cert = cert_resp.json()
        assert cert["certificate_id"].startswith("CERT-65B-")
        assert cert["merkle_proof_verified"] is True
        assert "CERTIFICATE UNDER SECTION 65B" in cert["legal_affidavit_markdown"]
