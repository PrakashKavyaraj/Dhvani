import pytest
from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.main import app
from tests.conftest import generate_test_wav


@pytest.fixture
def client():
    settings = get_settings()
    settings.DETECTOR_BACKEND = "dummy"
    with TestClient(app) as test_client:
        yield test_client


def test_dpdp_consent_rejection(client):
    """
    DPDP Act Compliance: Rejects evaluation with HTTP 403 Forbidden
    when explicit user consent is not granted.
    """
    payload = {
        "audio_signals": {
            "acoustic_fake_prob": 0.15,
            "codec_compression_anomaly": 0.05,
            "spectral_discontinuity": 0.05,
            "snr_db": 24.0,
            "detected_codec": "PCM",
        },
        "context_signals": {
            "session_id": "sess-dpdp-refusal-001",
            "turn_index": 0,
            "transcript": "Hello, I want to check my account balance.",
            "caller_id_verified": True,
            "user_consent_granted": False,  # DPDP refusal
        },
    }

    response = client.post("/api/v1/risk/evaluate", json=payload)
    assert response.status_code == 403
    data = response.json()
    assert "DPDP Act Violation" in data["detail"]
    assert "consent" in data["detail"].lower()


def test_legitimate_human_call_low_risk(client):
    """
    Legitimate Call: Natural acoustic signals and benign transcript
    should map to LOW threat tier with ALLOW_STREAM action.
    """
    payload = {
        "audio_signals": {
            "acoustic_fake_prob": 0.08,
            "codec_compression_anomaly": 0.02,
            "spectral_discontinuity": 0.04,
            "snr_db": 25.0,
            "detected_codec": "PCM",
        },
        "context_signals": {
            "session_id": "sess-human-clean-002",
            "turn_index": 0,
            "transcript": "Good morning, I would like to schedule an appointment for tomorrow.",
            "caller_id_verified": True,
            "user_consent_granted": True,
        },
    }

    response = client.post("/api/v1/risk/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["threat_tier"] == "LOW"
    assert data["threat_score"] <= 35
    assert data["recommended_action"] == "ALLOW_STREAM"
    assert data["challenge_required"] is False
    assert data["drift_detected"] is False

    # Verify audit log cryptographic tokens
    audit = data["audit_log"]
    assert len(audit["voice_token"]) == 64  # SHA-256 hex length
    assert len(audit["signature"]) == 64    # HMAC-SHA-256 hex length


def test_urgent_otp_scam_high_risk(client):
    """
    Urgent OTP Scam: High ML synthetic probability combined with coercive
    urgency and financial phishing patterns triggers HIGH threat tier and
    TERMINATE_AND_ALERT_FRAUD_DESK.
    """
    payload = {
        "audio_signals": {
            "acoustic_fake_prob": 0.88,
            "codec_compression_anomaly": 0.65,
            "spectral_discontinuity": 0.70,
            "snr_db": 18.0,
            "detected_codec": "OPUS",
        },
        "context_signals": {
            "session_id": "sess-scam-cbi-otp-003",
            "turn_index": 0,
            "transcript": (
                "This is emergency officer from police and CBI headquarters! Your bank account "
                "is suspended and you will be arrested immediately unless you share your OTP "
                "and UPI transfer pin right now for verification!"
            ),
            "caller_id_verified": False,
            "user_consent_granted": True,
        },
    }

    response = client.post("/api/v1/risk/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["threat_tier"] == "HIGH"
    assert data["threat_score"] >= 71
    assert data["recommended_action"] == "TERMINATE_AND_ALERT_FRAUD_DESK"
    assert data["challenge_required"] is True

    # Explainability checks
    reasons_text = " ".join(data["forensic_reasons"])
    assert "social engineering" in reasons_text.lower() or "urgency" in reasons_text.lower()
    assert "synthetic" in reasons_text.lower() or "acoustic" in reasons_text.lower()


def test_telephony_codec_resilience_discount(client):
    """
    Codec Resilience: When lossy telephony codecs (e.g. AMR) operate at low SNR (< 10 dB),
    synthetic probability is calibrated downward to prevent false alarms.
    """
    payload = {
        "audio_signals": {
            "acoustic_fake_prob": 0.60,
            "codec_compression_anomaly": 0.40,
            "spectral_discontinuity": 0.30,
            "snr_db": 6.5,  # Low SNR below 10 dB
            "detected_codec": "AMR",
        },
        "context_signals": {
            "session_id": "sess-amr-telephony-004",
            "turn_index": 0,
            "transcript": "Checking flight status from noisy train station.",
            "caller_id_verified": True,
            "user_consent_granted": True,
        },
    }

    response = client.post("/api/v1/risk/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # The 0.60 raw ML prob should be discounted by ~35% -> ~0.39, preventing HIGH score
    assert data["threat_score"] < 50
    reasons_text = " ".join(data["forensic_reasons"])
    assert "telephony codec" in reasons_text.lower()
    assert "discounted" in reasons_text.lower()


def test_session_drift_voice_injection(client):
    """
    Session Drift: A sharp surge in synthetic probability across conversation
    turns flags a mid-call voice injection attack.
    """
    session_id = "sess-injection-drift-005"

    # Turn 0: Legitimate human speaker
    turn_0 = {
        "audio_signals": {
            "acoustic_fake_prob": 0.10,
            "codec_compression_anomaly": 0.05,
            "spectral_discontinuity": 0.05,
            "snr_db": 22.0,
            "detected_codec": "PCM",
        },
        "context_signals": {
            "session_id": session_id,
            "turn_index": 0,
            "transcript": "Yes, I am calling about loan eligibility.",
            "caller_id_verified": True,
            "user_consent_granted": True,
        },
    }
    res_0 = client.post("/api/v1/risk/evaluate", json=turn_0)
    assert res_0.status_code == 200
    assert res_0.json()["drift_detected"] is False

    # Turn 1: Injected synthetic voice attack
    turn_1 = {
        "audio_signals": {
            "acoustic_fake_prob": 0.85,  # +0.75 surge
            "codec_compression_anomaly": 0.20,
            "spectral_discontinuity": 0.25,
            "snr_db": 22.0,
            "detected_codec": "PCM",
        },
        "context_signals": {
            "session_id": session_id,
            "turn_index": 1,
            "transcript": "Please authorize the funds transfer now.",
            "caller_id_verified": True,
            "user_consent_granted": True,
        },
    }
    res_1 = client.post("/api/v1/risk/evaluate", json=turn_1)
    assert res_1.status_code == 200
    data_1 = res_1.json()

    assert data_1["drift_detected"] is True
    reasons_text = " ".join(data_1["forensic_reasons"])
    assert "injection" in reasons_text.lower() or "drift" in reasons_text.lower()

    # Session cleanup
    del_res = client.delete(f"/api/v1/risk/session/{session_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "cleared"


def test_end_to_end_inference_audio_pipeline(client):
    """
    Validates the integrated /api/v1/inference/analyze route combining
    Member 2 (DSP), Member 1 (ML), and Member 5 (Security Engine).
    """
    wav_bytes = generate_test_wav(duration=3.0, silent=False)
    files = {"file": ("test_call.wav", wav_bytes, "audio/wav")}
    data = {
        "session_id": "sess-pipeline-e2e-006",
        "turn_index": "0",
        "transcript": "Checking standard transaction balance.",
        "user_consent_granted": "true",
        "caller_id_verified": "true",
        "detected_codec": "PCM",
    }

    response = client.post("/api/v1/inference/analyze", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["session_id"] == "sess-pipeline-e2e-006"
    assert "pipeline_summary" in res_data
    assert "ml_detector" in res_data["pipeline_summary"]
    assert "dsp_features" in res_data["pipeline_summary"]
    assert "risk_evaluation" in res_data
    assert res_data["risk_evaluation"]["threat_tier"] in ("LOW", "MEDIUM", "HIGH")
