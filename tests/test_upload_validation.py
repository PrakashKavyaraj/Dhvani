from app.core.config import settings
from tests.conftest import wav_bytes


def upload(client, content, name="recording.wav", mime="audio/wav"):
    return client.post("/api/v1/analyses", files={"file": (name, content, mime)})


def code(response):
    return response.json()["detail"]["code"]


def test_accepts_valid_wav(client, valid_wav):
    response = upload(client, valid_wav)
    assert response.status_code == 202
    assert response.json()["status"] == "queued"


def test_rejects_unsupported_extension(client, valid_wav):
    response = upload(client, valid_wav, "recording.mp3", "audio/mpeg")
    assert response.status_code == 422
    assert code(response) == "UNSUPPORTED_FORMAT"


def test_rejects_corrupted_wav(client):
    response = upload(client, b"not a wave file")
    assert response.status_code == 422
    assert code(response) == "INVALID_AUDIO"


def test_rejects_file_too_large(client, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size_mb", 0)  # property then permits no bytes
    response = upload(client, wav_bytes())
    assert response.status_code == 413
    assert code(response) == "FILE_TOO_LARGE"


def test_rejects_audio_too_short(client):
    response = upload(client, wav_bytes(seconds=0.5))
    assert response.status_code == 422
    assert code(response) == "AUDIO_TOO_SHORT"
