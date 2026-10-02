"""
Unit & Integration Tests for Forensic Audio Spectrogram & Splicing Heatmap Service.
"""

import io
import wave
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.spectrogram_service import (
    SpectrogramService,
    spectrogram_service,
)


def _create_test_wav(samples: np.ndarray, sr: int = 16000) -> bytes:
    """Helper to encode float32 samples to 16-bit PCM WAV bytes."""
    int_samples = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(int_samples.tobytes())
    return bio.getvalue()


class TestSpectrogramService:
    """Unit tests for 2D Mel spectrogram generation and temporal splicing segmentation."""

    def test_compute_spectrogram_dimensions(self):
        sr = 16000
        duration = 2.0
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = (0.5 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)

        res = spectrogram_service.compute_spectrogram(
            samples=audio,
            sample_rate=sr,
            target_time_bins=60,
        )

        assert res["time_duration_sec"] == 2.0
        assert res["n_mels"] == 40
        assert len(res["mel_matrix"]) == 40  # 40 Mel frequency rows
        assert len(res["mel_matrix"][0]) == 60  # 60 time columns
        assert len(res["frequencies_hz"]) == 40
        assert len(res["time_labels_sec"]) == 60

        # Diagnostics check
        diag = res["diagnostics"]
        assert diag["spectral_centroid_hz"] > 0
        assert 0.0 <= diag["spectral_flatness"] <= 1.0
        assert diag["spectral_rolloff_85_hz"] > 0

    def test_detect_splicing_segments(self):
        sr = 16000
        # 1s natural tone + 1s high-frequency synthetic tone
        t1 = np.linspace(0, 1.0, sr, endpoint=False)
        t2 = np.linspace(0, 1.0, sr, endpoint=False)
        part1 = (0.5 * np.sin(2 * np.pi * 200 * t1)).astype(np.float32)
        part2 = (0.5 * np.sin(2 * np.pi * 4500 * t2)).astype(np.float32)  # High frequency
        audio = np.concatenate([part1, part2])

        segments = spectrogram_service.detect_splicing_and_segments(
            samples=audio,
            sample_rate=sr,
            baseline_fake_prob=0.85,
        )

        assert len(segments) >= 1
        labels = [s["label"] for s in segments]
        assert "SYNTHETIC_INJECTION" in labels
        first_seg = segments[0]
        assert "start_sec" in first_seg
        assert "end_sec" in first_seg
        assert "color" in first_seg

    def test_silence_segment_detection(self):
        sr = 16000
        # Pure silence (zeros)
        silent_audio = np.zeros(int(sr * 1.5), dtype=np.float32)
        segments = spectrogram_service.detect_splicing_and_segments(
            samples=silent_audio,
            sample_rate=sr,
        )
        assert len(segments) == 1
        assert segments[0]["label"] == "SILENCE_PAUSE"
        assert segments[0]["color"] == "slate"


class TestSpectrogramRESTEndpoints:
    """Integration tests for Spectrogram REST API endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_spectrogram_info_endpoint(self, client):
        resp = client.get("/api/v1/spectrogram/info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["n_mels"] == 40
        assert "cyber_plasma" in data["color_palettes"]
        assert "SYNTHETIC_INJECTION" in data["segment_categories"]

    def test_generate_spectrogram_endpoint(self, client):
        sr = 16000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        audio = (0.4 * np.sin(2 * np.pi * 400 * t)).astype(np.float32)
        wav_bytes = _create_test_wav(audio, sr=sr)

        resp = client.post(
            "/api/v1/spectrogram/generate",
            files={"file": ("tone.wav", wav_bytes, "audio/wav")},
            data={"synthetic_prob": "0.75", "target_time_bins": "50"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert "spectrogram" in data
        assert len(data["spectrogram"]["mel_matrix"]) == 40
        assert "splicing_segments" in data
        assert len(data["splicing_segments"]) > 0
