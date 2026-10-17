"""
Unit & Integration Test Suite for Carrier CPaaS & SIPREC Telephony Streaming.

Validates:
1. Base64 G.711 mu-law / A-law telephony media chunk decoding.
2. Session lifecycle, turn accumulation, and zero-disk memory wiping.
3. Fail-open circuit breaker operation under latency SLA violations.
4. REST endpoint for CPaaS configuration and integration templates.
5. Simulated carrier turn evaluation.
6. WebSocket real-time carrier media streaming lifecycle.
"""

import base64
import json
import numpy as np
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.cpaas_telephony_service import (
    CPaaSSession,
    CPaaSTelephonyService,
    cpaas_telephony_service,
)


@pytest.fixture
def client():
    return TestClient(app)


def generate_dummy_mulaw_base64(num_samples: int = 160) -> str:
    """Generates synthetic 8kHz mu-law audio chunk (160 samples = 20ms frame)."""
    t = np.linspace(0, 0.02, num_samples, endpoint=False)
    pcm = (0.5 * np.sin(2 * np.pi * 1000 * t)).astype(np.float32)
    # Convert to 8-bit unsigned mu-law approximation
    pcm_uint8 = np.clip((pcm * 127.0 + 128.0), 0, 255).astype(np.uint8)
    return base64.b64encode(pcm_uint8.tobytes()).decode("utf-8")


class TestCPaaSTelephonyService:
    def test_session_start_and_end_lifecycle(self):
        service = CPaaSTelephonyService()
        stream_sid = "STRM-EXOTEL-001"
        call_sid = "CALL-EXOTEL-001"

        session = service.start_session(
            stream_sid=stream_sid,
            call_sid=call_sid,
            encoding="audio/x-mulaw",
            sample_rate=8000,
        )
        assert session.stream_sid == stream_sid
        assert session.call_sid == call_sid
        assert service.get_session(stream_sid) is not None

        # Terminate session
        summary = service.end_session(stream_sid)
        assert summary is not None
        assert summary["status"] == "SESSION_CLOSED"
        assert summary["raw_disk_bytes"] == 0
        assert service.get_session(stream_sid) is None

    def test_decode_cpaas_media_chunk(self):
        service = CPaaSTelephonyService()
        b64 = generate_dummy_mulaw_base64(160)
        pcm_16k = service.decode_cpaas_media_chunk(b64, encoding="audio/x-mulaw")

        # 160 samples at 8kHz resamples to 320 samples at 16kHz
        assert len(pcm_16k) == 320
        assert pcm_16k.dtype == np.float32
        assert np.max(np.abs(pcm_16k)) <= 1.0

    def test_buffering_and_turn_inference(self):
        service = CPaaSTelephonyService()
        stream_sid = "STRM-BUFFER-TEST"
        service.start_session(stream_sid=stream_sid, call_sid="CALL-BUF-1")

        b64 = generate_dummy_mulaw_base64(160)
        # Feed 10 chunks (3200 samples at 16kHz < 24000 required for inference)
        for i in range(10):
            res = service.process_media_event(stream_sid, b64, sequence_number=i)
            assert res["status"] == "BUFFERING"
            assert res["action"] == "CONTINUE_STREAM"

        # Feed enough chunks to cross 24,000 samples
        final_res = None
        for i in range(10, 80):
            final_res = service.process_media_event(stream_sid, b64, sequence_number=i)
            if final_res.get("status") == "STREAMING":
                break

        assert final_res is not None
        assert final_res.get("status") == "STREAMING"
        assert "risk_score" in final_res
        assert "calibrated_probability" in final_res

    def test_circuit_breaker_fail_open(self):
        # Create service with very tight SLA budget (1.0 ms)
        tight_service = CPaaSTelephonyService(sla_budget_ms=1.0)
        stream_sid = "STRM-CIRCUIT-FAIL"
        session = tight_service.start_session(stream_sid=stream_sid, call_sid="CALL-SLA-FAIL")

        # Inject simulated high latencies exceeding SLA
        session.latencies_ms = [50.0, 65.0, 80.0, 95.0]

        # Feed enough audio to trigger inference check
        b64_large = base64.b64encode(np.zeros(16000, dtype=np.uint8).tobytes()).decode("utf-8")
        tight_service.decode_cpaas_media_chunk(b64_large)
        session.audio_chunks = [np.zeros(25000, dtype=np.float32)]

        res = tight_service.process_media_event(stream_sid, b64_large, sequence_number=5)
        assert res["status"] == "CIRCUIT_BREAKER_FAIL_OPEN"
        assert res["action"] == "ALLOW_CALL_FLAGGED"
        assert res["circuit_breaker_active"] is True
        assert session.fail_open_tripped is True

    def test_circuit_breaker_high_risk_step_up_fallback(self):
        """Verifies high-risk transactions (e.g. Treasury RTGS) fall back to STEP_UP rather than ALLOW."""
        tight_service = CPaaSTelephonyService(sla_budget_ms=1.0)
        stream_sid = "STRM-HIGH-RISK-FAIL"
        session = tight_service.start_session(
            stream_sid=stream_sid,
            call_sid="CALL-TREASURY-RTGS",
            fallback_action="STEP_UP",
        )
        session.latencies_ms = [50.0, 65.0, 80.0, 95.0]

        b64_large = base64.b64encode(np.zeros(16000, dtype=np.uint8).tobytes()).decode("utf-8")
        tight_service.decode_cpaas_media_chunk(b64_large)
        session.audio_chunks = [np.zeros(25000, dtype=np.float32)]

        res = tight_service.process_media_event(stream_sid, b64_large, sequence_number=5)
        assert res["status"] == "CIRCUIT_BREAKER_FAIL_OPEN"
        assert res["action"] == "STEP_UP"
        assert "prevent DoS authentication bypass" in res["reason"]


class TestCPaaSTelephonyEndpoints:
    def test_get_cpaas_config_endpoint(self, client):
        resp = client.get("/api/v1/telephony/cpaas-config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "INTEGRATION_TEMPLATES_READY"
        assert "Exotel" in data["supported_providers"]
        assert "Twilio" in data["supported_providers"]
        assert "Genesys_Cloud" in data["supported_providers"]
        assert "sla_configuration" in data

    def test_simulate_call_turn_endpoint(self, client):
        b64 = generate_dummy_mulaw_base64(160)
        payload = {
            "stream_sid": "SIM-REST-TEST-001",
            "call_sid": "CALL-REST-991",
            "caller_ani": "+91-98201-99881",
            "encoding": "audio/x-mulaw",
            "base64_payload": b64,
            "sequence_number": 1,
        }
        resp = client.post("/api/v1/telephony/simulate-call-turn", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "TURN_EVALUATED"
        assert "verdict" in data
        assert data["verdict"]["status"] in ("BUFFERING", "STREAMING")

    def test_websocket_cpaas_media_stream_lifecycle(self, client):
        with client.websocket_connect("/api/v1/telephony/media-stream") as ws:
            # 1. Start event
            start_event = {
                "event": "start",
                "start": {
                    "streamSid": "WS-TEST-STRM-01",
                    "callSid": "WS-TEST-CALL-01",
                    "mediaFormat": {
                        "encoding": "audio/x-mulaw",
                        "sampleRate": 8000,
                        "channels": 1,
                    },
                },
            }
            ws.send_text(json.dumps(start_event))
            resp = json.loads(ws.receive_text())
            assert resp["event"] == "connected"
            assert resp["streamSid"] == "WS-TEST-STRM-01"

            # 2. Media event
            b64 = generate_dummy_mulaw_base64(160)
            media_event = {
                "event": "media",
                "sequenceNumber": 1,
                "media": {
                    "payload": b64,
                    "timestamp": "1000",
                },
            }
            ws.send_text(json.dumps(media_event))
            resp_media = json.loads(ws.receive_text())
            assert resp_media["event"] == "verdict"
            assert resp_media["streamSid"] == "WS-TEST-STRM-01"

            # 3. Stop event
            stop_event = {
                "event": "stop",
                "stop": {
                    "callSid": "WS-TEST-CALL-01",
                },
            }
            ws.send_text(json.dumps(stop_event))
            resp_close = json.loads(ws.receive_text())
            assert resp_close["event"] == "closed"
            assert resp_close["summary"]["status"] == "SESSION_CLOSED"
