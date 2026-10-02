import hashlib
import hmac
import io
import json
import time
from pathlib import Path
import numpy as np
import pytest

from app.core.security_engine import security_engine
from app.services.database_service import DatabaseService
from app.services.liveness_service import LivenessChallengeService, liveness_service
from app.services.voiceprint_vault import VoiceprintVaultService, voiceprint_vault
from tests.conftest import generate_test_wav


# ============================================================================
# 1. Voiceprint Vault Tests
# ============================================================================

def test_voiceprint_vault_lifecycle(tmp_path):
    """
    Verifies full lifecycle of multi-tenant voiceprint vault:
    - Enrollment of customer voice embedding.
    - Verification against registered profile.
    - DPDP Act Section 12 Right to Erasure (deletion).
    - Multi-tenant boundary isolation.
    """
    vault = VoiceprintVaultService(db_path=tmp_path / "test_vault.db")

    # Generate synthetic audio waveforms (16kHz PCM)
    t = np.linspace(0, 1.0, 16000, endpoint=False)
    audio_alice = (0.6 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)
    audio_bob = (0.6 * np.sin(2 * np.pi * 700 * t)).astype(np.float32)

    # 1. Enroll Alice in tenant "bank_alpha"
    enroll_res = vault.enroll(
        customer_id="cust_alice_01",
        audio_input=audio_alice,
        speaker_name="Alice Smith",
        tenant_id="bank_alpha",
    )
    assert enroll_res["status"] == "ENROLLED"
    assert enroll_res["customer_id"] == "cust_alice_01"
    assert enroll_res["tenant_id"] == "bank_alpha"
    assert enroll_res["embedding_dim"] == 192
    assert "voice_token" in enroll_res

    # 2. Verify Alice with the same voice audio -> Match expected
    verify_match = vault.verify(
        customer_id="cust_alice_01",
        audio_input=audio_alice,
        tenant_id="bank_alpha",
    )
    assert verify_match["match_verified"] is True
    assert verify_match["status"] == "STRONG_MATCH"
    assert verify_match["similarity"] >= 0.80

    # 3. Multi-tenant isolation: Verify Alice under different tenant -> NOT_ENROLLED
    verify_other_tenant = vault.verify(
        customer_id="cust_alice_01",
        audio_input=audio_alice,
        tenant_id="bank_beta",
    )
    assert verify_other_tenant["match_verified"] is False
    assert verify_other_tenant["status"] == "NOT_ENROLLED"

    # 4. List enrolled speakers in tenant
    speakers = vault.list_enrolled_speakers(tenant_id="bank_alpha")
    assert len(speakers) == 1
    assert speakers[0]["customer_id"] == "cust_alice_01"
    assert speakers[0]["speaker_name"] == "Alice Smith"

    # 5. DPDP Right to Erasure: Permanent deletion
    deleted = vault.delete_speaker(customer_id="cust_alice_01", tenant_id="bank_alpha")
    assert deleted is True

    # 6. Verify post-deletion -> NOT_ENROLLED
    verify_post_del = vault.verify(
        customer_id="cust_alice_01",
        audio_input=audio_alice,
        tenant_id="bank_alpha",
    )
    assert verify_post_del["status"] == "NOT_ENROLLED"
    assert verify_post_del["match_verified"] is False


# ============================================================================
# 2. Active Liveness Challenge-Response Tests
# ============================================================================

def test_liveness_challenge_generation():
    """
    Verifies cryptographic generation of unpredictable challenge phrases.
    """
    service = LivenessChallengeService()
    challenge = service.create_challenge(session_id="sess_123")

    assert challenge["status"] == "CHALLENGE_ISSUED"
    assert challenge["session_id"] == "sess_123"
    assert len(challenge["challenge_text"].split()) == 3
    assert challenge["expires_in_seconds"] == 15.0

    token = challenge["challenge_token"]
    parts = token.split(":")
    assert len(parts) == 4
    assert parts[0] == "sess_123"
    assert parts[2] == challenge["challenge_text"]


def test_liveness_token_tamper_rejection():
    """
    Verifies that forged or modified challenge tokens fail HMAC signature checks.
    """
    service = LivenessChallengeService()
    challenge = service.create_challenge(session_id="sess_secure")
    token = challenge["challenge_token"]

    parts = token.split(":")
    # Tamper with challenge text
    forged_token = f"{parts[0]}:{parts[1]}:Hacked Text 99:{parts[3]}"

    audio = np.random.randn(16000).astype(np.float32)
    result = service.verify_challenge(challenge_token=forged_token, audio_input=audio)

    assert result["status"] == "SIGNATURE_MISMATCH"
    assert result["liveness_verified"] is False


def test_liveness_challenge_expiration():
    """
    Verifies that challenges older than 15 seconds are rejected to stop replay attacks.
    """
    service = LivenessChallengeService()

    session_id = "sess_expired"
    issued_at = time.time() - 25.0  # 25 seconds ago (expired)
    challenge_text = "Golden Phoenix 42"
    payload = f"{session_id}:{issued_at:.3f}:{challenge_text}"
    sig = hmac.new(
        security_engine.AUDIT_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    expired_token = f"{payload}:{sig}"

    audio = np.random.randn(16000).astype(np.float32)
    result = service.verify_challenge(challenge_token=expired_token, audio_input=audio)

    assert result["status"] == "CHALLENGE_EXPIRED"
    assert result["liveness_verified"] is False
    assert result["elapsed_seconds"] >= 24.0


def test_liveness_ai_pipeline_latency_rejection():
    """
    Verifies that high-latency audio response (> 2200ms) typical of generative voice
    cloning pipelines (ASR -> LLM -> TTS) is flagged as SUSPICIOUS_AI_PIPELINE_LAG.
    """
    from unittest.mock import patch
    from app.core.vad_engine import VADResult

    service = LivenessChallengeService()

    session_id = "sess_ai_delay"
    # Issued 2.4 seconds ago (human reflex is 400ms-1200ms)
    issued_at = time.time() - 2.4
    challenge_text = "Silver Horizon 88"
    payload = f"{session_id}:{issued_at:.3f}:{challenge_text}"
    sig = hmac.new(
        security_engine.AUDIT_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    delayed_token = f"{payload}:{sig}"

    t = np.linspace(0, 1.5, int(16000 * 1.5), endpoint=False)
    dummy_audio = (0.5 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)

    mock_vad = VADResult(
        is_speech=True,
        speech_ratio=0.85,
        duration_sec=1.5,
        speech_duration_sec=1.2,
        speech_segments=[(0.1, 1.3)],
        speech_audio=dummy_audio,
        processing_time_ms=1.5,
        engine_used="silero",
    )

    with patch("app.services.liveness_service.vad_engine.analyze", return_value=mock_vad):
        result = service.verify_challenge(
            challenge_token=delayed_token,
            audio_input=dummy_audio,
            transcript="Silver Horizon 88",
        )

    assert result["latency_verdict"] == "SUSPICIOUS_AI_PIPELINE_LAG"
    assert result["liveness_verified"] is False
    assert result["response_latency_ms"] > 2200


def test_liveness_silence_rejection():
    """
    Verifies that silence or missing speech fails liveness with NO_SPEECH_DETECTED.
    """
    service = LivenessChallengeService()
    chal = service.create_challenge(session_id="sess_silence")
    silence = np.zeros(16000, dtype=np.float32)

    result = service.verify_challenge(
        challenge_token=chal["challenge_token"],
        audio_input=silence,
        transcript=chal["challenge_text"],
    )
    assert result["status"] == "NO_SPEECH_DETECTED"
    assert result["liveness_verified"] is False


# ============================================================================
# 3. SQLite Relational Persistence Tests
# ============================================================================

def test_database_service_sqlite_and_query(tmp_path):
    """
    Tests SQLite relational persistence, indexing, risk filtering, and biometric sanitization.
    """
    json_path = tmp_path / "analysis_records.json"
    sqlite_path = tmp_path / "dhvani.db"
    db = DatabaseService(db_path=json_path, sqlite_path=sqlite_path)

    # 1. Save two records with different risk scores
    rec_high = {
        "voiceprint_sha256": "hash_rec_high_999",
        "analysis_id": "anlz_001",
        "risk_score": 88,
        "risk_level": "CRITICAL",
        "primary_risk_score": 88,
        "secondary_risk_score": 75,
        "synthetic_speech_probability": 0.94,
        "model_confidence": 0.96,
        "waveform": b"RAW_AUDIO_BYTE_ARRAY_TO_SANITIZE",  # Biometric data to strip
    }
    rec_low = {
        "voiceprint_sha256": "hash_rec_low_111",
        "analysis_id": "anlz_002",
        "risk_score": 15,
        "risk_level": "LOW",
        "primary_risk_score": 15,
        "secondary_risk_score": 10,
        "synthetic_speech_probability": 0.05,
        "model_confidence": 0.98,
    }

    key_high = db.save_record(rec_high)
    key_low = db.save_record(rec_low)

    assert key_high == "hash_rec_high_999"
    assert key_low == "hash_rec_low_111"

    # 2. Get record and ensure raw bytes were sanitized
    retrieved = db.get_record("hash_rec_high_999")
    assert retrieved is not None
    assert retrieved["risk_score"] == 88
    assert "waveform" not in retrieved  # Zero raw audio persistence confirmed

    # 3. Relational query filter by risk threshold
    high_risk_recs = db.query_records(min_risk=80)
    assert len(high_risk_recs) == 1
    assert high_risk_recs[0]["analysis_id"] == "anlz_001"

    all_recs = db.query_records(min_risk=None)
    assert len(all_recs) == 2


# ============================================================================
# 4. REST API Endpoint Tests
# ============================================================================

def test_api_voiceprint_endpoints(client):
    """
    Tests REST endpoints for /api/v1/voiceprint:
    - POST /enroll
    - POST /verify
    - GET /enrolled
    - DELETE /{customer_id}
    """
    # 3.0s audio satisfies MIN_DURATION_SECONDS and MIN_SPEECH_SECONDS constraints
    wav_bytes = generate_test_wav(duration=3.0, frequency=300.0)

    # 1. Enroll
    enroll_resp = client.post(
        "/api/v1/voiceprint/enroll",
        data={
            "customer_id": "cust_api_test_01",
            "speaker_name": "API Tester",
            "tenant_id": "tenant_qa",
        },
        files={"file": ("voice_sample.wav", wav_bytes, "audio/wav")},
    )
    assert enroll_resp.status_code == 201
    enroll_data = enroll_resp.json()
    assert enroll_data["status"] == "ENROLLED"
    assert enroll_data["customer_id"] == "cust_api_test_01"

    # 2. Verify
    verify_resp = client.post(
        "/api/v1/voiceprint/verify",
        data={
            "customer_id": "cust_api_test_01",
            "tenant_id": "tenant_qa",
        },
        files={"file": ("voice_sample.wav", wav_bytes, "audio/wav")},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["match_verified"] is True
    assert verify_data["similarity"] >= 0.80

    # 3. List enrolled
    list_resp = client.get("/api/v1/voiceprint/enrolled?tenant_id=tenant_qa")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert any(p["customer_id"] == "cust_api_test_01" for p in list_data["profiles"])

    # 4. DPDP Right to Erasure
    del_resp = client.delete("/api/v1/voiceprint/cust_api_test_01?tenant_id=tenant_qa")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "DELETED"

    # 5. Verify after delete fails
    verify_after_del = client.post(
        "/api/v1/voiceprint/verify",
        data={
            "customer_id": "cust_api_test_01",
            "tenant_id": "tenant_qa",
        },
        files={"file": ("voice_sample.wav", wav_bytes, "audio/wav")},
    )
    assert verify_after_del.status_code == 200
    assert verify_after_del.json()["status"] == "NOT_ENROLLED"


def test_api_liveness_endpoints(client):
    """
    Tests REST endpoints for /api/v1/liveness:
    - POST /challenge
    - POST /verify
    """
    from unittest.mock import patch
    from app.core.vad_engine import VADResult

    # 1. Request challenge
    chal_resp = client.post("/api/v1/liveness/challenge", data={"session_id": "api_liveness_sess"})
    assert chal_resp.status_code == 200
    chal_data = chal_resp.json()
    assert chal_data["status"] == "CHALLENGE_ISSUED"
    token = chal_data["challenge_token"]
    phrase = chal_data["challenge_text"]

    # 2. Verify with valid audio and mocked speech detection
    wav_bytes = generate_test_wav(duration=3.0, frequency=250.0)
    mock_vad = VADResult(
        is_speech=True,
        speech_ratio=0.85,
        duration_sec=3.0,
        speech_duration_sec=2.5,
        speech_segments=[(0.2, 2.7)],
        speech_audio=np.zeros(48000, dtype=np.float32),
        processing_time_ms=2.0,
        engine_used="silero",
    )

    with patch("app.services.liveness_service.vad_engine.analyze", return_value=mock_vad):
        verify_resp = client.post(
            "/api/v1/liveness/verify",
            data={
                "challenge_token": token,
                "transcript": phrase,
            },
            files={"file": ("challenge_audio.wav", wav_bytes, "audio/wav")},
        )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert "liveness_verified" in verify_data
    assert "response_latency_ms" in verify_data
    assert verify_data["liveness_verified"] is True
    assert verify_data["latency_verdict"] == "NATURAL_REFLEX"
