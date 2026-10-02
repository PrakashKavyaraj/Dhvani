"""
Unit & Integration Test Suite for Edge-Defense Virtual Mic Micro-Detector.

Validates:
1. Virtual audio driver signature detection (VB-Audio, BlackHole, Loopback, OBS)
2. Ambient Johnson-Nyquist thermal acoustic room noise physics vs mathematical zero pipes
3. Composite hardware trust certification
4. REST endpoints for browser device verification and live audio snippet evaluation
"""

import io
import wave
import numpy as np
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.edge_defense_service import (
    VIRTUAL_DRIVER_KEYWORDS,
    EdgeDefenseService,
    edge_defense_service,
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


class TestEdgeDefenseService:
    def test_inspect_device_label_physical(self):
        service = EdgeDefenseService()
        res = service.inspect_device_label("MacBook Pro Microphone (Built-in)")
        assert res["is_virtual_driver"] is False
        assert len(res["matched_signatures"]) == 0
        assert res["risk_score"] < 0.10

    def test_inspect_device_label_virtual(self):
        service = EdgeDefenseService()
        res1 = service.inspect_device_label("CABLE Output (VB-Audio Virtual Cable)")
        assert res1["is_virtual_driver"] is True
        assert "cable" in res1["matched_signatures"] or "virtual" in res1["matched_signatures"]
        assert res1["risk_score"] > 0.90

        res2 = service.inspect_device_label("BlackHole 16ch Audio Loopback")
        assert res2["is_virtual_driver"] is True
        assert res2["risk_score"] > 0.90

    def test_analyze_ambient_noise_physics(self):
        service = EdgeDefenseService()
        sr = 16000

        # Case 1: Organic physical room noise (Gaussian thermal noise around -50 dB)
        noise = (np.random.normal(0, 0.003, int(sr * 0.5))).astype(np.float32)
        res_real = service.analyze_ambient_noise_physics(noise, sr)
        assert res_real["has_thermal_room_noise"] is True
        assert res_real["is_synthetic_silence"] is False
        assert res_real["perfect_digital_silence_ratio"] < 0.05

        # Case 2: Synthetic digital zero pipe (all zeros)
        zeros = np.zeros(int(sr * 0.5), dtype=np.float32)
        res_pipe = service.analyze_ambient_noise_physics(zeros, sr)
        assert res_pipe["is_synthetic_silence"] is True
        assert res_pipe["perfect_digital_silence_ratio"] > 0.95

    def test_verify_edge_device_composite(self):
        service = EdgeDefenseService()

        # Real hardware device
        res_real = service.verify_edge_device(
            device_label="External USB Podcast Microphone",
            sample_noise_floor_db=-54.0,
            zero_sample_ratio=0.01,
        )
        assert res_real["verdict"] == "HARDWARE_PHYSICAL_MIC_VERIFIED"
        assert res_real["hardware_trust_score"] > 0.90

        # Virtual audio driver spoof
        res_spoof = service.verify_edge_device(
            device_label="VB-Audio VoiceMeeter VAIO Virtual Cable",
            sample_noise_floor_db=-92.0,
            zero_sample_ratio=0.60,
        )
        assert res_spoof["verdict"] == "VIRTUAL_CABLE_SPOOF_CONFIRMED"
        assert res_spoof["hardware_trust_score"] < 0.15
        assert "REJECT_TRANSACTION" in res_spoof["countermeasures_recommended"]


class TestEdgeDefenseRESTEndpoints:
    def test_get_signatures_endpoint(self, client):
        resp = client.get("/api/v1/edge/signatures")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SIGNATURES_ACTIVE"
        assert "blackhole" in data["blacklisted_keywords"]

    def test_verify_device_endpoint(self, client):
        payload = {
            "device_label": "Loopback Audio Driver",
            "sample_noise_floor_db": -88.0,
            "zero_sample_ratio": 0.55,
        }
        resp = client.post("/api/v1/edge/verify-device", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "EVALUATED"
        assert data["threat_level"] in ["CRITICAL", "HIGH"]
        assert data["device_inspection"]["is_virtual_driver"] is True

    def test_verify_device_audio_endpoint(self, client):
        sr = 16000
        t = np.linspace(0, 0.4, int(sr * 0.4), endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 400 * t) + np.random.normal(0, 0.005, int(sr * 0.4))).astype(np.float32)
        wav_bytes = _generate_wav_bytes(audio, sample_rate=sr)

        resp = client.post(
            "/api/v1/edge/verify-device-audio",
            files={"file": ("ambient.wav", wav_bytes, "audio/wav")},
            data={"device_label": "High Definition Audio Device (Realtek)"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "EVALUATED"
        assert "hardware_trust_score" in data
        assert "acoustic_physics" in data
