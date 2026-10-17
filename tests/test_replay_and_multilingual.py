"""
Test Suite for Acoustic Loudspeaker Replay Defense and Indian Multilingual Benchmarking.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.replay_defense_service import ReplayDefenseService, replay_defense_service
from scripts.replay_adversarial_benchmark import run_adversarial_and_multilingual_benchmark


@pytest.fixture
def replay_service():
    return ReplayDefenseService(sample_rate=16000)


@pytest.fixture
def client():
    return TestClient(app)


class TestReplayDefenseService:
    def test_near_field_clean_speech(self, replay_service):
        sr = 16000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        # Synthetic clean vocal fundamental (150Hz) with decaying harmonics (clean vocal tract)
        clean_voice = (
            0.6 * np.sin(2 * np.pi * 150 * t)
            + 0.2 * np.sin(2 * np.pi * 300 * t)
            + 0.05 * np.sin(2 * np.pi * 450 * t)
        )
        # Fast natural decay
        envelope = np.exp(-t * 8.0)
        clean_signal = (clean_voice * envelope).astype(np.float32)

        res = replay_service.analyze_acoustic_replay(clean_signal, sample_rate=sr)
        assert res["replay_detected"] is False
        assert res["replay_probability"] < 0.50
        assert res["channel_type"] in ["NEAR_FIELD_NATURAL_MOUTH", "MODERATE_REVERBERATION_PSTN"]
        assert res["drr_db"] > 6.0

    def test_loudspeaker_acoustic_replay_simulation(self, replay_service):
        sr = 16000
        t = np.linspace(0, 1.5, int(sr * 1.5), endpoint=False)
        # Base tone with strong loudspeaker odd-harmonic distortion & chassis resonance
        speaker_distorted = (
            0.4 * np.sin(2 * np.pi * 200 * t)
            + 0.35 * np.sin(2 * np.pi * 600 * t)   # 3rd harmonic saturation
            + 0.25 * np.sin(2 * np.pi * 1000 * t)  # 5th harmonic saturation
            + 0.20 * np.sin(2 * np.pi * 350 * t)   # 350 Hz chassis resonance
        )
        # Prolonged secondary room reverberation (slow decay) + diffuse late reflections
        reverb_tail = np.exp(-t * 1.5)
        diffuse_noise = np.random.normal(0, 0.08, len(t))
        replay_signal = ((speaker_distorted * reverb_tail) + diffuse_noise).astype(np.float32)

        res = replay_service.analyze_acoustic_replay(replay_signal, sample_rate=sr)
        assert res["thd_percentage"] > 4.0
        assert res["drr_db"] < 15.0
        assert "LOUDSPEAKER_ACOUSTIC_REPLAY" in res["channel_type"] or res["replay_probability"] > 0.45

    def test_short_audio_fallback(self, replay_service):
        sr = 16000
        short_samples = np.zeros(int(sr * 0.2), dtype=np.float32)
        res = replay_service.analyze_acoustic_replay(short_samples, sample_rate=sr)
        assert res["channel_type"] == "INSUFFICIENT_AUDIO_DURATION"
        assert res["replay_detected"] is False


class TestReplayAdversarialBenchmark:
    def test_benchmark_execution(self):
        report = run_adversarial_and_multilingual_benchmark()
        assert "attack_scenarios" in report
        assert "indian_languages" in report
        assert "summary" in report

        # Verify key scenarios exist
        scenarios = report["attack_scenarios"]
        assert "Direct Software-Injected Synthetic Clone" in scenarios
        assert "Acoustic Loudspeaker Replay (Unmitigated)" in scenarios
        assert "Acoustic Loudspeaker Replay (With Dhvani Replay Defense)" in scenarios

        # Verify improvement factor
        assert report["summary"]["replay_eer_improvement_factor"] >= 1.0

        # Verify all 5 Indian languages are represented
        languages = report["indian_languages"]
        assert "Hindi (Standard Khariboli)" in languages
        assert "Tamil (Chennai & Regional)" in languages
        assert "Telugu (Hyderabad & Coastal)" in languages
        assert "Bengali (Kolkata & Eastern)" in languages
        assert "Hinglish (Code-Switching Banking Speech)" in languages

        for l_name, l_data in languages.items():
            assert "eer_percent" in l_data
            assert "banking_profile" in l_data
            assert l_data["banking_profile"]["act_dcf"] >= 0.0


class TestReplayDefenseEndpoints:
    def test_inspect_replay_endpoint(self, client):
        payload = {
            "audio_samples": [0.05 * np.sin(i * 0.1) for i in range(16000)],
            "sample_rate": 16000,
        }
        resp = client.post("/api/v1/replay-defense/inspect-acoustic-replay", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "replay_detected" in data
        assert "replay_probability" in data
        assert "channel_type" in data
        assert "drr_db" in data
        assert "thd_percentage" in data

    def test_get_multilingual_benchmark_endpoint(self, client):
        resp = client.get("/api/v1/replay-defense/multilingual-benchmark")
        assert resp.status_code == 200
        data = resp.json()
        assert "attack_scenarios" in data
        assert "indian_languages" in data

    def test_get_dialects_endpoint(self, client):
        resp = client.get("/api/v1/replay-defense/dialects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_languages"] == 5
        assert len(data["supported_languages"]) == 5
