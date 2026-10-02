"""
Unit & Integration Tests for Phase 4:
Carrier Telephony Resilience, Packet Loss Concealment (PLC), and ITU-T G.107 E-Model QoS.
"""

import io
import wave
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.telephony_resilience_engine import (
    CODEC_E_MODEL_PROFILES,
    TelephonyResilienceEngine,
    telephony_resilience_engine,
)
from app.core.security_engine import security_engine
from app.schemas.risk_schema import (
    AudioSignalsIn,
    ContextSignalsIn,
    EvaluateRiskRequest,
)


def _generate_wav_bytes(samples: np.ndarray, sample_rate: int = 16000) -> bytes:
    """Helper to convert float32 numpy samples into valid 16-bit PCM WAV bytes."""
    int_samples = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_samples.tobytes())
    return bio.getvalue()


class TestTelephonyResilienceEngine:
    """Unit tests for ITU-T G.107 E-model calculations and PLC artifact detection."""

    def test_e_model_qos_calculation(self):
        engine = TelephonyResilienceEngine()

        # Pristine network link (0% packet loss, 0ms jitter)
        pristine = engine.compute_e_model_qos(packet_loss_rate=0.0, jitter_ms=0.0, codec="G.711")
        assert pristine["r_factor"] >= 90.0
        assert pristine["mos_score"] >= 4.2
        assert pristine["category"] == "EXCELLENT"

        # Moderate congestion (4% packet loss, 35ms jitter)
        moderate = engine.compute_e_model_qos(packet_loss_rate=0.04, jitter_ms=35.0, codec="G.711")
        assert moderate["r_factor"] < pristine["r_factor"]
        assert 3.0 <= moderate["mos_score"] <= 4.0

        # Severe degradation (18% packet loss, 80ms jitter)
        severe = engine.compute_e_model_qos(packet_loss_rate=0.18, jitter_ms=80.0, codec="G.711")
        assert severe["r_factor"] < 60.0
        assert severe["mos_score"] < 3.0
        assert severe["category"] in {"POOR_DEGRADED", "UNACCEPTABLE_PACKET_LOSS"}

    def test_detect_plc_artifacts_on_clean_speech(self):
        # Generate 2 seconds of natural human vocal harmonics with continuous variation
        sr = 16000
        t = np.linspace(0, 2.0, int(sr * 2.0), endpoint=False)
        clean_speech = (
            0.4 * np.sin(2 * np.pi * 180 * t)
            + 0.25 * np.sin(2 * np.pi * 360 * t + 0.3)
            + 0.15 * np.sin(2 * np.pi * 540 * t + 0.8)
        ).astype(np.float32)

        res = telephony_resilience_engine.detect_plc_artifacts(clean_speech, sample_rate=sr)
        assert res["plc_detected"] is False
        assert res["plc_artifact_prob"] < 0.30
        assert res["disentanglement_verdict"] == "NATURAL_ACOUSTIC_TRANSMISSION"

    def test_detect_plc_artifacts_on_concealed_speech(self):
        # Synthesize audio with repeated pitch frames typical of G.711 App I loss concealment
        sr = 16000
        frame_len = int(sr * 0.020)  # 20ms = 320 samples
        num_frames = 60
        frames = []

        for i in range(num_frames):
            if 15 <= i <= 20 or 35 <= i <= 40:
                # Repeated pitch extrapolation frame with 0.82 attenuation
                repeated = frames[-1] * 0.82
                frames.append(repeated)
            else:
                t = np.linspace(0, 0.020, frame_len, endpoint=False)
                f0 = 150 + (i % 5) * 10
                base_frame = (0.5 * np.sin(2 * np.pi * f0 * t) + 0.2 * np.sin(2 * np.pi * 2 * f0 * t)).astype(np.float32)
                frames.append(base_frame)

        concealed_audio = np.concatenate(frames)
        res = telephony_resilience_engine.detect_plc_artifacts(concealed_audio, sample_rate=sr)
        assert res["plc_detected"] is True
        assert res["plc_artifact_prob"] >= 0.30
        assert res["plc_frame_count"] >= 2
        assert res["disentanglement_verdict"] == "NETWORK_CONCEALMENT_ARTIFACT"

    def test_gilbert_elliott_simulation(self):
        sr = 16000
        t = np.linspace(0, 2.0, int(sr * 2.0), endpoint=False)
        audio = (0.5 * np.sin(2 * np.pi * 250 * t)).astype(np.float32)

        sim = telephony_resilience_engine.simulate_network_degradation(
            audio_samples=audio,
            sample_rate=sr,
            target_loss_rate=0.10,
            burst_length_avg=2.5,
            jitter_ms=40.0,
            apply_plc=True,
        )
        assert sim["actual_loss_rate"] > 0.0
        assert sim["dropped_frames"] > 0
        assert sim["qos"]["r_factor"] < 85.0
        assert sim["qos"]["mos_score"] < 4.2

    def test_packet_loss_restoration_inpainting(self):
        sr = 16000
        frame_len = int(sr * 0.020)
        t = np.linspace(0, 0.020, frame_len, endpoint=False)

        frame1 = (0.5 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
        frame2_corrupt = np.zeros(frame_len, dtype=np.float32)  # Corrupted zero-energy drop
        frame3 = (0.5 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)

        degraded = np.concatenate([frame1, frame2_corrupt, frame3])
        restored_res = telephony_resilience_engine.restore_packet_loss(degraded, sample_rate=sr)
        assert restored_res["repaired_frames"] == 1
        assert restored_res["restoration_applied"] is True

        # Center frame should now contain reconstructed speech energy
        center_samples = restored_res["restored_audio"][frame_len : 2 * frame_len]
        assert np.sqrt(np.mean(center_samples ** 2)) > 0.10

    def test_degradation_debiasing_discount(self):
        # Case A: Pristine link (no discount)
        calibrated, discount, reasons = telephony_resilience_engine.calibrate_degradation_debiasing(
            acoustic_fake_prob=0.80,
            plc_artifact_prob=0.05,
            packet_loss_rate=0.01,
            mos_score=4.3,
            codec="PCM",
            snr_db=25.0,
        )
        assert discount == 0.0
        assert calibrated == 0.80
        assert len(reasons) == 0

        # Case B: Significant PLC pitch repetition (discount applied)
        calibrated_plc, discount_plc, reasons_plc = telephony_resilience_engine.calibrate_degradation_debiasing(
            acoustic_fake_prob=0.80,
            plc_artifact_prob=0.65,
            packet_loss_rate=0.08,
            mos_score=3.1,
            codec="G.711",
            snr_db=14.0,
        )
        assert discount_plc >= 0.20
        assert calibrated_plc < 0.80
        assert any("packet loss concealment" in r.lower() for r in reasons_plc)


class TestTelephonySecurityEngineIntegration:
    """Tests that SecurityEngine properly ingests telephony signals and applies de-biasing."""

    def test_evaluate_applies_plc_debiasing(self):
        req = EvaluateRiskRequest(
            audio_signals=AudioSignalsIn(
                acoustic_fake_prob=0.68,
                codec_compression_anomaly=0.45,
                spectral_discontinuity=0.55,
                snr_db=15.0,
                detected_codec="G.711",
                packet_loss_rate=0.09,
                jitter_ms=45.0,
                plc_artifact_prob=0.60,
                transmission_rating_r=62.5,
                mos_score=3.15,
            ),
            context_signals=ContextSignalsIn(
                session_id="test-telephony-resilience-session",
                turn_index=0,
                transcript="Checking savings account balance over rural cellular link.",
                caller_id_verified=True,
                user_consent_granted=True,
            ),
        )
        resp = security_engine.evaluate(req)
        assert resp.telephony_degradation_discount is not None
        assert resp.telephony_degradation_discount > 0.0
        assert resp.threat_tier in {"LOW", "MEDIUM"}

        # Explainability audit
        reasons_text = " ".join(resp.forensic_reasons).lower()
        assert "packet loss" in reasons_text or "concealment" in reasons_text or "telephony" in reasons_text


class TestTelephonyRESTEndpoints:
    """Integration tests for Telephony REST API endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_get_codecs_and_stats(self, client):
        codecs_resp = client.get("/api/v1/telephony/codecs")
        assert codecs_resp.status_code == 200
        codecs_data = codecs_resp.json()
        assert "codecs" in codecs_data
        assert "g.711" in codecs_data["codecs"]
        assert "opus" in codecs_data["codecs"]

        stats_resp = client.get("/api/v1/telephony/stats")
        assert stats_resp.status_code == 200
        stats_data = stats_resp.json()
        assert stats_data["plc_artifact_detection"] == "ACTIVE"
        assert "itu_t_g107" in stats_data["standards_compliance"]

    def test_analyze_channel_form_parameters(self, client):
        resp = client.post(
            "/api/v1/telephony/analyze-channel",
            data={
                "packet_loss_rate": "0.06",
                "jitter_ms": "30.0",
                "codec": "G.711",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert "qos" in data
        assert data["qos"]["r_factor"] > 0
        assert "mos_score" in data["qos"]

    def test_simulate_degradation_endpoint(self, client):
        sr = 16000
        t = np.linspace(0, 1.0, int(sr * 1.0), endpoint=False)
        audio = (0.5 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)
        wav_bytes = _generate_wav_bytes(audio, sample_rate=sr)

        resp = client.post(
            "/api/v1/telephony/simulate-degradation",
            files={"file": ("test_tone.wav", wav_bytes, "audio/wav")},
            data={
                "target_loss_rate": "0.10",
                "jitter_ms": "40.0",
                "burst_length_avg": "2.0",
                "apply_plc": "true",
                "codec": "G.711",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SIMULATION_COMPLETED"
        assert data["network_results"]["dropped_frames"] > 0
        assert "plc_detection" in data

    def test_compensate_plc_endpoint(self, client):
        sr = 16000
        audio = np.zeros(int(sr * 0.5), dtype=np.float32)
        wav_bytes = _generate_wav_bytes(audio, sample_rate=sr)

        resp = client.post(
            "/api/v1/telephony/compensate-plc",
            files={"file": ("corrupt.wav", wav_bytes, "audio/wav")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "COMPENSATED"
        assert "repaired_frames" in data
