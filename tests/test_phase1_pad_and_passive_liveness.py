import io
import math
import wave
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.presentation_attack_detector import (
    PresentationAttackDetector,
    presentation_attack_detector,
)
from app.core.passive_liveness_engine import (
    PassiveLivenessEngine,
    passive_liveness_engine,
)
from app.core.security_engine import SecurityEngine
from app.schemas.risk_schema import (
    AudioSignalsIn,
    ContextSignalsIn,
    EvaluateRiskRequest,
)


def _generate_synthetic_pcm_wav(
    duration_s: float = 1.0,
    sample_rate: int = 16000,
    freq: float = 220.0,
    add_micro_tremor: bool = False,
    is_replay: bool = False,
) -> bytes:
    """Generates synthetic PCM WAV audio for deterministic testing."""
    n_samples = int(duration_s * sample_rate)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)

    if add_micro_tremor:
        # Physiological 10 Hz neurological micro-tremor modulating fundamental frequency
        f0_mod = freq + 3.0 * np.sin(2 * np.pi * 10.0 * t)
        phase = 2 * np.pi * np.cumsum(f0_mod) / sample_rate
        # Asymmetric pulse wave simulating glottal opening/closing
        signal = 0.5 * np.sin(phase) + 0.25 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase)
        # Add breath pause at 0.4s to 0.65s (250ms)
        pause_start = int(0.4 * sample_rate)
        pause_end = int(0.65 * sample_rate)
        signal[pause_start:pause_end] *= 0.01
    else:
        # Stationary synthetic tone without natural neurological tremor
        signal = 0.6 * np.sin(2 * np.pi * freq * t)

    if is_replay:
        # Simulate physical loudspeaker replay artifacts:
        # 1. Heavy low-pass roll-off (cutoff at 3500 Hz)
        # 2. Double reverberation echo (delayed copy at 60ms)
        # 3. Non-linear harmonic distortion
        echo_delay = int(0.060 * sample_rate)
        echo = np.zeros_like(signal)
        echo[echo_delay:] = signal[:-echo_delay] * 0.45
        signal = signal + echo
        # Non-linear clipping/distortion
        signal = np.clip(signal * 1.5, -0.7, 0.7)

    # Normalize to 16-bit integer range
    max_amp = np.max(np.abs(signal)) + 1e-8
    pcm_int16 = (signal / max_amp * 28000).astype(np.int16)

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_int16.tobytes())
    return wav_io.getvalue()


class TestPresentationAttackDetector:
    """Tests for ISO/IEC 30107-3 Presentation Attack Detection."""

    def test_detector_initialization(self):
        detector = PresentationAttackDetector(sample_rate=16000)
        assert detector.target_sr == 16000
        assert presentation_attack_detector is not None

    def test_brief_audio_graceful_handling(self):
        detector = PresentationAttackDetector()
        brief_pcm = np.zeros(800, dtype=np.float32)  # 50ms
        res = detector.analyze(brief_pcm)
        assert not res.is_presentation_attack
        assert res.apcer_risk_tier == "LOW"
        assert res.presentation_attack_probability == 0.0

    def test_replay_artifact_detection(self):
        wav_bytes = _generate_synthetic_pcm_wav(
            duration_s=1.2,
            is_replay=True,
        )
        res = presentation_attack_detector.analyze(wav_bytes)
        assert res.presentation_attack_probability >= 0.0
        assert res.apcer_risk_tier in ["LOW", "MEDIUM", "HIGH"]
        res_dict = res.to_dict()
        assert "metrics" in res_dict
        assert "early_to_late_ratio_db" in res_dict["metrics"]
        assert "spectral_rolloff_hz" in res_dict["metrics"]
        assert "harmonic_distortion_ratio" in res_dict["metrics"]
        assert "crest_factor_db" in res_dict["metrics"]
        assert "ISO/IEC 30107-3" in res_dict["standard"]


class TestPassiveLivenessEngine:
    """Tests for passive continuous vocal tract physiology evaluation."""

    def test_passive_liveness_initialization(self):
        engine = PassiveLivenessEngine(sample_rate=16000)
        assert engine.target_sr == 16000
        assert passive_liveness_engine is not None

    def test_brief_audio_passive_liveness(self):
        brief_pcm = np.zeros(2000, dtype=np.float32)
        res = passive_liveness_engine.evaluate(brief_pcm)
        assert res.liveness_tier == "AMBIGUOUS_PASSIVE"
        assert res.liveness_score == 50.0

    def test_synthetic_vocoder_tone_detection(self):
        # Pure flat synthetic tone lacking 8-12 Hz micro-tremors
        wav_bytes = _generate_synthetic_pcm_wav(
            duration_s=1.2,
            add_micro_tremor=False,
        )
        res = passive_liveness_engine.evaluate(wav_bytes)
        assert res.liveness_score <= 75.0
        res_dict = res.to_dict()
        assert "micro_tremor_index" in res_dict["metrics"]
        assert "glottal_asymmetry_score" in res_dict["metrics"]
        assert "respiratory_rhythm_detected" in res_dict["metrics"]

    def test_human_physiological_simulation(self):
        # Audio with simulated 10 Hz neurological flutter and glottal asymmetry
        wav_bytes = _generate_synthetic_pcm_wav(
            duration_s=1.5,
            add_micro_tremor=True,
        )
        res = passive_liveness_engine.evaluate(wav_bytes)
        assert res.liveness_score >= 40.0
        assert isinstance(res.is_live_human, bool)


class TestSecurityEnginePADIntegration:
    """Tests for SecurityEngine factoring in PAD and Passive Liveness."""

    def test_pad_threat_boost_and_forensic_reasons(self):
        engine = SecurityEngine()
        req = EvaluateRiskRequest(
            audio_signals=AudioSignalsIn(
                acoustic_fake_prob=0.20,
                codec_compression_anomaly=0.10,
                spectral_discontinuity=0.10,
                snr_db=22.0,
                detected_codec="PCM",
                presentation_attack_prob=0.88,
                passive_liveness_anomaly=0.75,
            ),
            context_signals=ContextSignalsIn(
                session_id="test-pad-session-1",
                turn_index=0,
                transcript="Standard verification statement",
                caller_id_verified=True,
                user_consent_granted=True,
            ),
        )
        resp = engine.evaluate(req)
        # Threat score must be elevated due to PAD replay attack and passive liveness anomaly
        assert resp.threat_score >= 35
        # Must contain forensic explainability strings
        has_pad_reason = any("Physical loudspeaker replay attack detected" in r for r in resp.forensic_reasons)
        has_liveness_reason = any("vocal micro-tremors" in r for r in resp.forensic_reasons)
        assert has_pad_reason
        assert has_liveness_reason


class TestPADAndLivenessEndpoints:
    """Tests for FastAPI PAD evaluation endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_pad_evaluate_endpoint_success(self, client):
        wav_bytes = _generate_synthetic_pcm_wav(duration_s=2.2)
        response = client.post(
            "/api/v1/inference/pad-evaluate",
            files={"file": ("test_eval.wav", wav_bytes, "audio/wav")},
            data={"session_id": "test-pad-rest-1", "user_consent_granted": "true"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test-pad-rest-1"
        assert "latency_ms" in data
        assert "presentation_attack_detection" in data
        assert "passive_liveness" in data
        assert "compliance" in data
        assert data["compliance"]["standard"] == "ISO/IEC 30107-3:2017"
        assert data["compliance"]["dpdp_compliant"] is True

    def test_pad_evaluate_endpoint_dpdp_denial(self, client):
        wav_bytes = _generate_synthetic_pcm_wav(duration_s=0.5)
        response = client.post(
            "/api/v1/inference/pad-evaluate",
            files={"file": ("test_eval.wav", wav_bytes, "audio/wav")},
            data={"session_id": "test-pad-rest-2", "user_consent_granted": "false"},
        )
        assert response.status_code == 403
        assert "DPDP Act Violation" in response.json()["detail"]
