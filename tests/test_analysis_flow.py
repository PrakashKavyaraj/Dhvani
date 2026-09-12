from app.core.config import settings
from app.services import analysis_service
from tests.conftest import wav_bytes


def submit(client, content):
    return client.post("/api/v1/analyses", files={"file": ("recording.wav", content, "audio/wav")})


def test_successful_end_to_end_flow_and_cleanup(client, valid_wav):
    accepted = submit(client, valid_wav)
    assert accepted.status_code == 202
    result = client.get(f"/api/v1/analyses/{accepted.json()['analysis_id']}")
    assert result.status_code == 200
    body = result.json()
    assert body["status"] == "completed"
    assert 0 <= body["risk_score"] <= 100
    assert body["disclaimer"].startswith("This is a probabilistic")
    assert list(settings.temp_audio_dir.glob("*.wav")) == []


def test_unknown_analysis_id(client):
    response = client.get("/api/v1/analyses/not-a-real-id")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ANALYSIS_NOT_FOUND"


def test_detector_failure_has_no_risk_score_and_cleans_up(client, valid_wav, monkeypatch):
    def broken_detector(_prepared):
        raise RuntimeError("model unavailable")
    monkeypatch.setattr(analysis_service, "predict", broken_detector)
    accepted = submit(client, valid_wav)
    result = client.get(f"/api/v1/analyses/{accepted.json()['analysis_id']}")
    body = result.json()
    assert body["status"] == "failed"
    assert body["error"]["code"] == "INFERENCE_FAILED"
    assert "risk_score" not in body
    assert list(settings.temp_audio_dir.glob("*.wav")) == []


def test_insufficient_speech_is_rejected(client):
    response = submit(client, wav_bytes(amplitude=0))
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INSUFFICIENT_SPEECH"
