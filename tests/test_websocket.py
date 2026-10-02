"""
Unit and integration tests for real-time WebSocket live mic streaming endpoint (/ws/voice-detect).
"""

import numpy as np
import pytest
from app.main import app


def test_websocket_connection_and_handshake(client):
    """Verifies that client can connect to /ws/voice-detect and receives initial handshake."""
    with client.websocket_connect("/ws/voice-detect") as ws:
        handshake = ws.receive_json()
        assert handshake["status"] == "CONNECTED"
        assert "session_id" in handshake
        assert handshake["session_id"].startswith("live-")
        assert handshake["sample_rate"] == 16000
        assert handshake["stride_ms"] == 125
        assert handshake["window_ms"] == 250


def test_websocket_streaming_buffering_and_inference(client):
    """
    Simulates streaming 250ms chunks (4000 Int16 samples at 16kHz) over WebSocket.
    Verifies buffering phase then full inference prediction receipt.
    """
    with client.websocket_connect("/ws/voice-detect") as ws:
        handshake = ws.receive_json()
        assert handshake["status"] == "CONNECTED"

        # 1. Send first chunk (4000 samples = 0.25s) -> should report BUFFERING (<0.5s required)
        t = np.linspace(0, 0.25, 4000, endpoint=False)
        sine_wave = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
        ws.send_bytes(sine_wave.tobytes())

        resp1 = ws.receive_json()
        assert resp1["status"] == "BUFFERING"
        assert resp1["accumulated_seconds"] == 0.25

        # 2. Send second chunk (4000 samples = 0.25s more -> total 8000 samples = 0.5s)
        # Should now cross threshold (>= 8000 samples) and execute full model inference!
        ws.send_bytes(sine_wave.tobytes())

        resp2 = ws.receive_json()
        assert resp2["status"] == "STREAMING"
        assert "risk_score" in resp2
        assert 0 <= resp2["risk_score"] <= 100
        assert resp2["risk_level"] in ("LOW", "MODERATE", "HIGH")
        assert resp2["tier"] in ("GREEN_ZONE", "YELLOW_ZONE", "RED_ZONE")
        assert "aegis" in resp2
        assert "dpdpVault" in resp2
        assert resp2["dpdpVault"]["rawBytesPersisted"] == 0
        assert len(resp2["dpdpVault"]["voiceToken"]) == 64
        assert len(resp2["dpdpVault"]["auditHmac"]) == 64
