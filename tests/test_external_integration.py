import math
import struct
import time
import wave
import pytest
from starlette.testclient import TestClient

from app.main import app


def generate_test_wav(duration: float = 2.5, freq: float = 440.0, sample_rate: int = 16000) -> bytes:
    """Generates a valid mono 16-bit PCM WAV in memory."""
    num_samples = int(duration * sample_rate)
    sine_samples = [
        int(16000 * math.sin(2 * math.pi * freq * i / sample_rate))
        for i in range(num_samples)
    ]
    raw_frames = struct.pack(f"<{len(sine_samples)}h", *sine_samples)

    import io
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(raw_frames)
    return bio.getvalue()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_cors_allows_institution_port_3001(client):
    """
    Verifies that requests from the third-party institution portal on port 3001
    are properly accepted by CORS headers.
    """
    for origin in ["http://localhost:3001", "http://127.0.0.1:3001"]:
        response = client.options(
            "/api/v1/analyses",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin


def test_external_audio_submission_lifecycle(client):
    """
    Simulates external institution submitting audio via POST /api/v1/analyses
    and polling GET /api/v1/analyses/{id} to receive the full AEGIS analysis result.
    """
    wav_bytes = generate_test_wav(duration=2.5, freq=440.0)

    # 1. Post from external origin
    create_res = client.post(
        "/api/v1/analyses",
        files={"file": ("institution_voice_sample.wav", wav_bytes, "audio/wav")},
        headers={"Origin": "http://localhost:3001"},
    )
    assert create_res.status_code == 202
    data = create_res.json()
    assert "analysis_id" in data
    analysis_id = data["analysis_id"]

    # 2. Poll until completed
    completed = False
    result = None
    for _ in range(30):
        time.sleep(0.15)
        poll_res = client.get(
            f"/api/v1/analyses/{analysis_id}",
            headers={"Origin": "http://localhost:3001"},
        )
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        if poll_data["status"] == "completed":
            completed = True
            result = poll_data
            break

    assert completed, "Analysis did not complete in time"

    # 3. Verify all necessary AEGIS result fields for full UI rendering
    assert result["risk_score"] is not None
    assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL", "MINIMAL")
    assert result["primary_risk_score"] is not None
    assert result["secondary_risk_score"] is not None
    assert result["voiceprint_sha256"] is not None
    assert len(result["voiceprint_sha256"]) == 64

    # Multimodal AEGIS details
    assert "aegis" in result
    aegis = result["aegis"]
    assert "decision" in aegis
    assert "voice_authenticity" in aegis
    assert "primary_detector" in aegis
    assert "channel" in aegis
    assert "speaker_identity" in aegis

    # DPDP Vault metadata
    assert "dpdpVault" in result
    vault = result["dpdpVault"]
    assert vault["voiceToken"] == result["voiceprint_sha256"]
    assert vault["auditHmac"] is not None


def test_same_audio_produces_identical_underlying_analysis(client):
    """
    Critical Requirement:
    Submitting the EXACT same audio sample from:
      a) Dhvani site (Origin: http://localhost:3000)
      b) Institution Demo (Origin: http://localhost:3001)
    MUST execute the same pipeline and produce identical underlying AEGIS analysis metrics.
    """
    wav_bytes = generate_test_wav(duration=2.8, freq=520.0)

    # Submission 1: Dhvani Site
    res_1 = client.post(
        "/api/v1/analyses",
        files={"file": ("dhvani_sample.wav", wav_bytes, "audio/wav")},
        headers={"Origin": "http://localhost:3000"},
    )
    assert res_1.status_code == 202
    id_1 = res_1.json()["analysis_id"]

    # Submission 2: Institution Portal
    res_2 = client.post(
        "/api/v1/analyses",
        files={"file": ("institution_sample.wav", wav_bytes, "audio/wav")},
        headers={"Origin": "http://localhost:3001"},
    )
    assert res_2.status_code == 202
    id_2 = res_2.json()["analysis_id"]

    # Wait for processing
    time.sleep(0.3)

    poll_1 = client.get(f"/api/v1/analyses/{id_1}").json()
    poll_2 = client.get(f"/api/v1/analyses/{id_2}").json()

    assert poll_1["status"] == "completed"
    assert poll_2["status"] == "completed"

    # Core scores must be identical
    assert poll_1["risk_score"] == poll_2["risk_score"], "Risk scores must match for identical audio"
    assert poll_1["risk_level"] == poll_2["risk_level"], "Risk levels must match for identical audio"
    assert poll_1["primary_risk_score"] == poll_2["primary_risk_score"], "Primary scores must match"
    assert poll_1["secondary_risk_score"] == poll_2["secondary_risk_score"], "Secondary scores must match"
    assert round(poll_1["synthetic_speech_probability"], 4) == round(poll_2["synthetic_speech_probability"], 4)

    # AEGIS decision and evidence must match
    aegis_1 = poll_1["aegis"]
    aegis_2 = poll_2["aegis"]
    assert aegis_1["decision"]["action"] == aegis_2["decision"]["action"]
    assert aegis_1["decision"]["severity"] == aegis_2["decision"]["severity"]
    assert aegis_1["voice_authenticity"]["raw_persistent_spoof_evidence"] == aegis_2["voice_authenticity"]["raw_persistent_spoof_evidence"]
    assert aegis_1["channel"]["status"] == aegis_2["channel"]["status"]
    assert aegis_1["channel"]["channel_reliability"] == aegis_2["channel"]["channel_reliability"]

    # Salts & SHA-256 hashes must be distinct due to cryptographic random salting
    assert poll_1["voiceprint_sha256"] != poll_2["voiceprint_sha256"], "Salts must ensure unique voiceprints"


def test_x_api_key_authentication_matrix(client):
    """
    Verifies that:
    1. External requests with X-API-Key are accepted.
    2. Local requests without X-API-Key are accepted for backward compatibility.
    3. Requests with an empty X-API-Key are rejected with 401.
    """
    wav_bytes = generate_test_wav(duration=2.5, freq=440.0)

    # 1. External request with valid API key
    res_valid = client.post(
        "/api/v1/analyses",
        files={"file": ("valid_key.wav", wav_bytes, "audio/wav")},
        headers={
            "Origin": "http://localhost:3001",
            "X-API-Key": "aegis_sec_live_994a2b1f8c3e",
        },
    )
    assert res_valid.status_code == 202
    assert "analysis_id" in res_valid.json()

    # 2. Local request without API key (backward compatible)
    res_no_key = client.post(
        "/api/v1/analyses",
        files={"file": ("no_key.wav", wav_bytes, "audio/wav")},
        headers={"Origin": "http://localhost:3000"},
    )
    assert res_no_key.status_code == 202
    assert "analysis_id" in res_no_key.json()

    # 3. Request with empty API key
    res_empty_key = client.post(
        "/api/v1/analyses",
        files={"file": ("empty_key.wav", wav_bytes, "audio/wav")},
        headers={
            "Origin": "http://localhost:3001",
            "X-API-Key": "   ",
        },
    )
    assert res_empty_key.status_code == 401
    assert "Invalid or empty AEGIS API Key" in res_empty_key.json()["detail"]
