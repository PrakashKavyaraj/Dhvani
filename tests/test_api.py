import io
import time
from pathlib import Path
from unittest.mock import patch
from tests.conftest import generate_test_wav


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model" in data["versions"]
    assert "preprocessing" in data["versions"]
    assert "risk_policy" in data["versions"]


def test_valid_wav_upload_acceptance(client):
    wav_bytes = generate_test_wav(duration=3.0, silent=False)
    files = {"file": ("test_recording.wav", wav_bytes, "audio/wav")}

    response = client.post("/api/v1/analyses", files=files)
    assert response.status_code == 202
    data = response.json()
    assert "analysis_id" in data
    assert data["status"] == "queued"
    assert "Audio accepted" in data["message"]


def test_unsupported_extension_rejection(client):
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("recording.mp3", b"FAKE_MP3_DATA", "audio/mpeg")},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "UNSUPPORTED_FORMAT"


def test_unsupported_mime_hint_rejection(client):
    wav_bytes = generate_test_wav(duration=3.0)
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("audio.wav", wav_bytes, "text/plain")},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "UNSUPPORTED_FORMAT"


def test_corrupt_wav_rejection(client):
    corrupt_bytes = b"RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00NOT_A_VALID_HEADER"
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("corrupt.wav", corrupt_bytes, "audio/wav")},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "INVALID_AUDIO"


def test_audio_too_short_rejection(client):
    # Duration = 1.0s, which is below default MIN_DURATION_SECONDS (2.0s)
    short_wav = generate_test_wav(duration=1.0, silent=False)
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("short.wav", short_wav, "audio/wav")},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "AUDIO_TOO_SHORT"


def test_insufficient_speech_rejection(client):
    # 3.0s duration but completely silent -> 0.0s speech
    silent_wav = generate_test_wav(duration=3.0, silent=True)
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("silent.wav", silent_wav, "audio/wav")},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["code"] == "INSUFFICIENT_SPEECH"


def test_file_too_large_rejection(client):
    wav_bytes = generate_test_wav(duration=3.0)
    # Mock max_upload_size_bytes to be smaller than the audio payload
    with patch("app.core.config.Settings.max_upload_size_bytes", 1024):
        response = client.post(
            "/api/v1/analyses",
            files={"file": ("large.wav", wav_bytes, "audio/wav")},
        )
        assert response.status_code == 413
        data = response.json()
        assert data["detail"]["code"] == "FILE_TOO_LARGE"


def test_unknown_analysis_id_returns_404(client):
    response = client.get("/api/v1/analyses/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "ANALYSIS_NOT_FOUND"


def test_end_to_end_analysis_completion(client):
    wav_bytes = generate_test_wav(duration=3.0, silent=False)
    create_res = client.post(
        "/api/v1/analyses",
        files={"file": ("speech.wav", wav_bytes, "audio/wav")},
        data={"experiment_id": "exp-101", "language": "en"},
    )
    assert create_res.status_code == 202
    analysis_id = create_res.json()["analysis_id"]

    # Allow FastAPI BackgroundTasks to process
    time.sleep(0.15)

    status_res = client.get(f"/api/v1/analyses/{analysis_id}")
    assert status_res.status_code == 200
    res_data = status_res.json()

    assert res_data["analysis_id"] == analysis_id
    assert res_data["status"] == "completed"
    assert 0 <= res_data["risk_score"] <= 100
    assert res_data["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL", "MINIMAL")
    assert 0.0 <= res_data["synthetic_speech_probability"] <= 1.0
    assert res_data["audio_quality"]["status"] == "suitable"
    assert res_data["audio_quality"]["speech_seconds"] > 1.0
    assert "disclaimer" in res_data
    assert "Elevated-risk results require independent secondary verification" in res_data["disclaimer"]
    assert "aegis" in res_data
    assert "voiceprint_sha256" in res_data
    assert len(res_data["voiceprint_sha256"]) == 64
    assert res_data["voiceprint_sha256"] != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert "primary_risk_score" in res_data
    assert isinstance(res_data["primary_risk_score"], int)
    assert 0 <= res_data["primary_risk_score"] <= 100
    assert "secondary_risk_score" in res_data
    assert isinstance(res_data["secondary_risk_score"], int)
    assert 0 <= res_data["secondary_risk_score"] <= 100
    assert "salt_base64" in res_data
    assert "dpdpVault" in res_data


def test_detector_failure_produces_safe_failed_response(client):
    wav_bytes = generate_test_wav(duration=3.0)

    # Patch M1 detector to simulate an unexpected inference error
    with patch("app.services.analysis_service.predict", side_effect=RuntimeError("GPU OOM")):
        create_res = client.post(
            "/api/v1/analyses",
            files={"file": ("speech.wav", wav_bytes, "audio/wav")},
        )
        assert create_res.status_code == 202
        analysis_id = create_res.json()["analysis_id"]

        time.sleep(0.15)

        status_res = client.get(f"/api/v1/analyses/{analysis_id}")
        assert status_res.status_code == 200
        res_data = status_res.json()

        assert res_data["status"] == "failed"
        assert res_data["error"]["code"] == "INFERENCE_FAILED"
        # Verify no risk score or probability is returned
        assert "risk_score" not in res_data or res_data["risk_score"] is None
        assert "synthetic_speech_probability" not in res_data or res_data["synthetic_speech_probability"] is None


def test_temporary_file_cleanup_on_validation_failure(client, tmp_path):
    # Corrupt WAV should not leave residual temporary files
    corrupt_bytes = b"RIFF1234WAVENOTVALID"
    temp_dir = Path("data/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    initial_files = set(temp_dir.glob("*.wav"))

    res = client.post(
        "/api/v1/analyses",
        files={"file": ("bad.wav", corrupt_bytes, "audio/wav")},
    )
    assert res.status_code == 422

    remaining_files = set(temp_dir.glob("*.wav"))
    new_files = remaining_files - initial_files
    assert len(new_files) == 0, f"Temporary file leak detected: {new_files}"