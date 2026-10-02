"""
Unit & Integration Test Suite for Neural Vocoder Architecture Attribution Fingerprinting.

Validates:
1. Feature extraction for checkerboard distortion, harmonic comb spikes, noise entropy, and phase jitter
2. Architecture classification (HiFi-GAN, BigVGAN, MelGAN, DiffWave, Neural Codec, Natural Human)
3. Threat intelligence catalog mapping to real-world synthesis engines
4. REST endpoints for file upload and telemetry-based attribution
"""

import io
import wave
import numpy as np
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.vocoder_attribution_service import (
    VOCODER_THREAT_CATALOG,
    VocoderAttributionService,
    vocoder_attribution_service,
)


def _generate_wav_bytes(samples: np.ndarray, sample_rate: int = 16000) -> bytes:
    """Generates 16-bit PCM WAV byte buffer."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        scaled = np.clip(samples * 32767.0, -32768.0, 32767.0).astype(np.int16)
        wf.writeframes(scaled.tobytes())
    return buf.getvalue()


@pytest.fixture
def client():
    return TestClient(app)


class TestVocoderAttributionService:
    def test_threat_catalog_integrity(self):
        service = VocoderAttributionService()
        catalog_info = service.get_threat_catalog()
        assert catalog_info["status"] == "CATALOG_ACTIVE"
        assert catalog_info["supported_families_count"] >= 6
        catalog = catalog_info["catalog"]
        assert "HIFI_GAN" in catalog
        assert "BIGVGAN" in catalog
        assert "MELGAN" in catalog
        assert "DIFFUSION_DENOISER" in catalog
        assert "NEURAL_CODEC_RVQ" in catalog
        assert "NATURAL_HUMAN" in catalog
        assert "ElevenLabs Standard" in catalog["HIFI_GAN"]["common_generators"]

    def test_extract_vocoder_features_synthetic_tone(self):
        service = VocoderAttributionService()
        sr = 16000
        t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        audio = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

        features = service.extract_vocoder_features(audio, sr)
        assert "checkerboard_metric" in features
        assert "harmonic_comb_ratio" in features
        assert "high_freq_rolloff_khz" in features
        assert "unvoiced_noise_entropy" in features
        assert "phase_coherence_jitter" in features
        assert "glottal_asymmetry_index" in features
        assert features["high_freq_rolloff_khz"] <= 8.0

    def test_attribute_vocoder_natural_voice(self):
        service = VocoderAttributionService()
        sr = 16000
        # Simulating random natural-like human harmonics
        t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        audio = (0.3 * np.sin(2 * np.pi * 180 * t) + 0.1 * np.sin(2 * np.pi * 360 * t)).astype(np.float32)

        res = service.attribute_vocoder(audio, sr, synthetic_prob=0.10)
        assert res["attributed_family"] == "NATURAL_HUMAN"
        assert res["threat_level"] == "BENIGN"
        assert res["attribution_confidence"] > 0.40

    def test_attribute_vocoder_synthetic_hifi_gan(self):
        service = VocoderAttributionService()
        sr = 16000
        t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        # Inject strong 2kHz, 4kHz, and 6kHz harmonic comb spikes
        comb_audio = (
            0.2 * np.sin(2 * np.pi * 2000 * t)
            + 0.2 * np.sin(2 * np.pi * 4000 * t)
            + 0.2 * np.sin(2 * np.pi * 6000 * t)
            + 0.3 * np.sin(2 * np.pi * 300 * t)
        ).astype(np.float32)

        res = service.attribute_vocoder(comb_audio, sr, synthetic_prob=0.92)
        assert res["threat_level"] in ["CRITICAL", "HIGH"]
        assert "architecture_probabilities" in res
        assert res["attributed_family"] in ["HIFI_GAN", "BIGVGAN"]


class TestVocoderRESTEndpoints:
    def test_get_catalog_endpoint(self, client):
        resp = client.get("/api/v1/vocoder/catalog")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "CATALOG_ACTIVE"
        assert "HIFI_GAN" in data["catalog"]

    def test_attribute_audio_endpoint(self, client):
        sr = 16000
        t = np.linspace(0, 0.4, int(sr * 0.4), endpoint=False)
        audio = (0.4 * np.sin(2 * np.pi * 500 * t)).astype(np.float32)
        wav_bytes = _generate_wav_bytes(audio, sample_rate=sr)

        resp = client.post(
            "/api/v1/vocoder/attribute",
            files={"file": ("vocoder_test.wav", wav_bytes, "audio/wav")},
            data={"synthetic_prob": "0.85"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "attributed_family" in data
        assert "attribution_confidence" in data
        assert "fingerprint_metrics" in data
        assert "common_generators" in data

    def test_attribute_from_metrics_endpoint(self, client):
        payload = {
            "synthetic_prob": 0.90,
            "checkerboard_metric": 0.58,
            "harmonic_comb_ratio": 0.22,
            "high_freq_rolloff_khz": 7.1,
        }
        resp = client.post("/api/v1/vocoder/attribute-from-metrics", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "attributed_family" in data
        assert data["threat_level"] in ["CRITICAL", "HIGH"]
