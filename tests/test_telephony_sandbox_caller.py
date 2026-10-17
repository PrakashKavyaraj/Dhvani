"""
Unit & Integration Tests for Telephony Sandbox Caller.

Validates:
1. G.711 mu-law and A-law frame synthesis.
2. In-process carrier session execution (Exotel & Twilio).
3. 350ms SLA compliance verification.
4. DPDP memory wipe and zero-disk retention audit.
"""

import pytest
from scripts.telephony_sandbox_caller import (
    format_carrier_markdown_report,
    generate_audio_frame,
    run_in_process_sandbox_call,
)


class TestTelephonySandboxCaller:
    """Validates the live carrier sandbox caller pipeline."""

    def test_generate_audio_frame_mulaw_and_alaw(self):
        mulaw_chunk = generate_audio_frame(codec="audio/x-mulaw", num_samples=160)
        assert isinstance(mulaw_chunk, str)
        assert len(mulaw_chunk) > 0

        alaw_chunk = generate_audio_frame(codec="audio/x-alaw", num_samples=160)
        assert isinstance(alaw_chunk, str)
        assert len(alaw_chunk) > 0

    def test_run_in_process_exotel_call(self):
        result = run_in_process_sandbox_call(
            provider="exotel",
            turns=10,
            codec="audio/x-alaw",
            caller_ani="+919876543210",
        )

        assert result["provider"] == "exotel"
        assert result["codec"] == "audio/x-alaw"
        assert result["total_turns_streamed"] == 10
        assert result["handshake_latency_ms"] >= 0.0
        assert result["start_ack_latency_ms"] >= 0.0
        assert result["turn_latencies"]["p50_ms"] >= 0.0
        assert result["turn_latencies"]["p95_ms"] >= 0.0
        assert result["sla_compliance_pct"] == 100.0

        # Verify zero-disk and privacy cleanup
        summary = result["teardown_summary"]
        assert summary.get("status") == "SESSION_CLOSED"
        assert summary.get("raw_disk_bytes") == 0
        assert summary.get("dpdp_wiped_samples") > 0

        # Markdown report check
        md = format_carrier_markdown_report(result)
        assert "# Dhvani Carrier Integration: Sandbox Call Report" in md
        assert "EXOTEL" in md

    def test_run_in_process_twilio_call(self):
        result = run_in_process_sandbox_call(
            provider="twilio",
            turns=10,
            codec="audio/x-mulaw",
            caller_ani="+14155552671",
        )

        assert result["provider"] == "twilio"
        assert result["codec"] == "audio/x-mulaw"
        assert result["total_turns_streamed"] == 10
        assert result["sla_compliance_pct"] == 100.0
        assert result["teardown_summary"]["raw_disk_bytes"] == 0
