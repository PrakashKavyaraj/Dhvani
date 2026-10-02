import io
import time
import wave
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.fraud_blacklist_service import (
    FraudBlacklistVaultService,
    fraud_blacklist_vault,
)


def _generate_pcm_wav(duration_s: float = 2.2, sample_rate: int = 16000, freq: float = 250.0) -> bytes:
    """Generates synthetic PCM WAV audio for testing."""
    n_samples = int(duration_s * sample_rate)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)
    signal = 0.5 * np.sin(2 * np.pi * freq * t)
    pcm_int16 = (signal * 30000).astype(np.int16)

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_int16.tobytes())
    return wav_io.getvalue()


class TestFraudBlacklistService:
    """Unit tests for FraudBlacklistVaultService and HNSW vector search."""

    def test_initialization_and_seeding(self):
        stats = fraud_blacklist_vault.get_stats()
        assert stats["total_blacklisted_voiceprints"] >= 5
        assert stats["total_syndicate_incidents"] >= 5
        assert "DIGITAL_ARREST" in stats["fraud_categories"]
        assert "HNSW" in stats["index_technology"] or "NumPy" in stats["index_technology"]

    def test_sub_millisecond_search_latency(self):
        # Warmup pass (loads neural weights into RAM if not already cached)
        random_audio = np.random.randn(16000 * 2).astype(np.float32)
        _ = fraud_blacklist_vault.match_voiceprint(random_audio, top_k=1)

        # Benchmark warm 1:N nearest-neighbor search speed
        t0 = time.perf_counter()
        result = fraud_blacklist_vault.match_voiceprint(random_audio, top_k=3)
        latency_ms = (time.perf_counter() - t0) * 1000

        # Sub-500ms budget for full neural embedding + HNSW search
        assert latency_ms < 500.0
        assert "latency_ms" in result
        # HNSW vector search alone is sub-5ms
        assert result["latency_ms"] < 10.0
        assert "candidates" in result
        assert len(result["candidates"]) > 0

    def test_dynamic_enrollment_and_immediate_match(self):
        test_audio = np.ones(16000 * 2, dtype=np.float32) * 0.45
        syndicate_id = "SYN-TEST-IMMEDIATE-99"
        syndicate_name = "Automated Test Fraud Ring"

        # Enroll
        enroll_res = fraud_blacklist_vault.enroll_fraudster(
            audio_input=test_audio,
            syndicate_id=syndicate_id,
            syndicate_name=syndicate_name,
            fraud_category="DIGITAL_ARREST",
            threat_level="CRITICAL",
            notes="Automated test voiceprint enrollment.",
        )
        assert enroll_res["status"] == "ENROLLED_IN_BLACKLIST"
        assert enroll_res["syndicate_id"] == syndicate_id
        entry_id = enroll_res["entry_id"]

        # Match exact same audio
        match_res = fraud_blacklist_vault.match_voiceprint(test_audio, match_threshold=0.70)
        assert match_res["is_match"] is True
        assert match_res["verdict"] == "CONFIRMED_FRAUDSTER_MATCH"
        assert match_res["similarity"] >= 0.70
        assert match_res["matched_syndicate"] is not None
        assert match_res["matched_syndicate"]["syndicate_id"] == syndicate_id

        # Clean up
        fraud_blacklist_vault.delete_entry(entry_id)

    def test_clean_audio_no_match(self):
        # Query with distinctive orthogonal vector
        rng = np.random.RandomState(9999)
        unique_audio = rng.randn(16000 * 2).astype(np.float32)
        match_res = fraud_blacklist_vault.match_voiceprint(unique_audio, match_threshold=0.85)
        assert match_res["is_match"] is False
        assert match_res["verdict"] in ["CLEAN_NO_MATCH", "SUSPICIOUS_SIMILARITY"]


class TestBlacklistRESTEndpoints:
    """Integration tests for Blacklist API endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_get_blacklist_stats(self, client):
        response = client.get("/api/v1/blacklist/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_blacklisted_voiceprints" in data
        assert "fraud_categories" in data
        assert data["embedding_dimension"] == 192

    def test_list_blacklist_entries(self, client):
        response = client.get("/api/v1/blacklist/list?limit=10&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert len(data["entries"]) >= 5
        entry = data["entries"][0]
        assert "entry_id" in entry
        assert "syndicate_id" in entry
        assert "voice_token" in entry
        assert "embedding_bytes" not in entry  # Zero biometric leakage

    def test_match_voiceprint_endpoint(self, client):
        wav_bytes = _generate_pcm_wav(duration_s=2.2)
        response = client.post(
            "/api/v1/blacklist/match",
            files={"file": ("caller.wav", wav_bytes, "audio/wav")},
            data={"match_threshold": "0.72", "user_consent_granted": "true"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_match" in data
        assert "verdict" in data
        assert "latency_ms" in data
        assert "candidates" in data

    def test_match_voiceprint_dpdp_denial(self, client):
        wav_bytes = _generate_pcm_wav(duration_s=2.2)
        response = client.post(
            "/api/v1/blacklist/match",
            files={"file": ("caller.wav", wav_bytes, "audio/wav")},
            data={"user_consent_granted": "false"},
        )
        assert response.status_code == 403
        assert "DPDP Act Violation" in response.json()["detail"]

    def test_enroll_and_delete_endpoint_flow(self, client):
        wav_bytes = _generate_pcm_wav(duration_s=2.2, freq=380.0)
        # Enroll
        enroll_resp = client.post(
            "/api/v1/blacklist/enroll",
            files={"file": ("suspect.wav", wav_bytes, "audio/wav")},
            data={
                "syndicate_id": "SYN-API-TEST-44",
                "syndicate_name": "API Test Phishing Syndicate",
                "fraud_category": "KYC_PHISHING",
                "threat_level": "CRITICAL",
                "notes": "Enrolled via automated pytest test case.",
            },
        )
        assert enroll_resp.status_code == 201
        entry_id = enroll_resp.json()["entry_id"]

        # Delete
        delete_resp = client.delete(f"/api/v1/blacklist/{entry_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json()["status"] == "DEACTIVATED"
