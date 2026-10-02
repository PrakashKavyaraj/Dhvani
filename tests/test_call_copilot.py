"""
Unit & Integration Test Suite for Dual-Channel Call Center Agent Co-Pilot.

Validates:
1. Dual-channel stream separation (Agent CH_1 vs Caller CH_2)
2. Response hesitation & TTS pipeline latency detection
3. Dynamic tiered security prompts (Standard, Elevated Nonce, Critical Freeze)
4. Rolling risk heat-strip calculations
5. Supervisor emergency escalation & transaction lockdown
6. REST endpoints for turn evaluation, audio processing, and session management
"""

import io
import wave
import numpy as np
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.call_copilot_service import (
    ChallengePrompt,
    CallCopilotService,
    call_copilot_service,
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


class TestCallCopilotService:
    def test_sample_session_initialization(self):
        service = CallCopilotService()
        demo = service.get_session("COPILOT-DEMO-SBI-8921")
        assert demo is not None
        assert demo["account_id"] == "SBI-PRIORITY-9104"
        assert len(demo["turns"]) == 6
        assert demo["current_risk_score"] >= 0.90
        assert demo["risk_status"] == "CRITICAL_FRAUD"
        assert len(demo["risk_heat_strip"]) == 6
        assert "caller_channel" in demo["channel_metrics"]

    def test_challenge_prompts_tier_scaling(self):
        low_prompts = ChallengePrompt.get_tier_prompts(0.15)
        assert any(p["tier"] == "STANDARD_ASSISTANCE" for p in low_prompts)

        elevated_prompts = ChallengePrompt.get_tier_prompts(0.55)
        assert any(p["tier"] == "ELEVATED_CHALLENGE" for p in elevated_prompts)

        critical_prompts = ChallengePrompt.get_tier_prompts(0.85)
        assert any(p["tier"] == "CRITICAL_CHALLENGE" for p in critical_prompts)
        assert any("Blue horizon" in p["script_text"] for p in critical_prompts)

    def test_evaluate_acoustic_features(self):
        service = CallCopilotService()
        sr = 16000
        t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        audio = (0.4 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

        # Agent voice should have minimal risk
        agent_eval = service.evaluate_acoustic_features(audio, sr, speaker="AGENT", latency_ms=150.0)
        assert agent_eval["synthetic_prob"] < 0.10

        # Caller voice with high latency
        caller_eval = service.evaluate_acoustic_features(audio, sr, speaker="CALLER", latency_ms=900.0)
        assert "HIGH_TTS_PIPELINE_LATENCY" in caller_eval["acoustic_flags"]
        assert caller_eval["synthetic_prob"] > 0.30

    def test_evaluate_turn_and_rolling_risk(self):
        service = CallCopilotService()
        session_id = "TEST-SESSION-001"

        # Turn 1: Agent speaking
        res1 = service.evaluate_turn(
            session_id=session_id,
            speaker="AGENT",
            text="Hello, how can I assist you?",
            latency_ms=100.0,
        )
        assert res1["turn"]["speaker"] == "AGENT"
        assert res1["turn"]["verdict"] == "AUTHENTIC_AGENT"

        # Turn 2: Caller speaking with high latency & high synthetic probability
        res2 = service.evaluate_turn(
            session_id=session_id,
            speaker="CALLER",
            text="I need to wire funds immediately.",
            latency_ms=950.0,
            forced_synthetic_prob=0.85,
        )
        assert res2["turn"]["speaker"] == "CALLER"
        assert res2["current_risk_score"] > 0.50
        assert res2["risk_status"] in ["ELEVATED", "CRITICAL_FRAUD"]
        assert len(res2["active_prompts"]) > 0

    def test_supervisor_escalation(self):
        service = CallCopilotService()
        session_id = "TEST-SESSION-ESC"
        service.get_or_create_session(session_id)

        escalation = service.trigger_supervisor_escalation(
            session_id=session_id,
            agent_id="AGENT-77",
            reason="Suspected automated clone voice",
        )
        assert escalation["status"] == "ESCALATION_CONFIRMED"
        assert escalation["escalation_id"].startswith("ESC-")
        assert "SUPERVISOR_BRIDGE_INITIALIZED" in escalation["actions_executed"]

        session = service.get_session(session_id)
        assert session["supervisor_escalated"] is True
        assert session["supervisor_escalation_id"] == escalation["escalation_id"]


class TestCallCopilotRESTEndpoints:
    def test_get_sample_session_endpoint(self, client):
        resp = client.get("/api/v1/copilot/sample-session")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "COPILOT-DEMO-SBI-8921"
        assert len(data["turns"]) >= 6
        assert data["current_risk_score"] > 0.80

    def test_get_active_prompts_endpoint(self, client):
        resp = client.get("/api/v1/copilot/active-prompts?risk_score=0.88")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tier"] == "CRITICAL"
        assert len(data["prompts"]) >= 2

    def test_evaluate_turn_endpoint(self, client):
        payload = {
            "session_id": "API-TEST-SESSION-01",
            "speaker": "CALLER",
            "text": "Transfer 50,000 immediately.",
            "latency_ms": 820.0,
            "forced_synthetic_prob": 0.78,
        }
        resp = client.post("/api/v1/copilot/evaluate-turn", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "API-TEST-SESSION-01"
        assert data["turn"]["verdict"] == "CONFIRMED_DEEPFAKE_ATTACK"
        assert data["current_risk_score"] > 0.40

    def test_evaluate_audio_turn_endpoint(self, client):
        sr = 16000
        t = np.linspace(0, 0.4, int(sr * 0.4), endpoint=False)
        audio = (0.3 * np.sin(2 * np.pi * 350 * t)).astype(np.float32)
        wav_bytes = _generate_wav_bytes(audio, sample_rate=sr)

        resp = client.post(
            "/api/v1/copilot/evaluate-audio-turn",
            files={"file": ("caller_turn.wav", wav_bytes, "audio/wav")},
            data={
                "session_id": "AUDIO-TEST-SESSION-01",
                "speaker": "CALLER",
                "text": "Audio verified phrase",
                "latency_ms": "600.0",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "AUDIO-TEST-SESSION-01"
        assert "turn" in data
        assert data["turn"]["duration_sec"] > 0.3

    def test_supervisor_escalate_endpoint(self, client):
        payload = {
            "session_id": "API-TEST-SESSION-01",
            "agent_id": "AGENT-007",
            "reason": "Vocoder freeze detected",
        }
        resp = client.post("/api/v1/copilot/supervisor-escalate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ESCALATION_CONFIRMED"
        assert "escalation_id" in data

    def test_reset_session_endpoint(self, client):
        resp = client.post(
            "/api/v1/copilot/reset-session",
            data={"session_id": "COPILOT-DEMO-SBI-8921"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "RESET_SAMPLE_SUCCESS"
