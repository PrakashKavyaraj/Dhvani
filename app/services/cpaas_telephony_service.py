"""
Carrier CPaaS & SIPREC Real-Time Media Stream Ingestion Service for Dhvani.

Architecture & Industry Standards:
1. Dual-Carrier CPaaS Streaming Compatibility:
   - Exotel Voice Streaming API (Indian cloud telephony leader)
   - Twilio / Genesys Media Streams (Global contact center standard)
   - SIPREC (IETF RFC 7866) XML metadata & RTP media-forking parser.
2. In-Memory Streaming Ring Buffer:
   - Zero raw audio bytes written to disk (DPDP Act 2023 Section 8(7) compliance).
   - Ingests 8 kHz 20ms G.711 mu-law / A-law base64 chunks.
3. Fail-Open Circuit Breaker & Latency SLA Monitor:
   - Tracks rolling p95 latency against SLA budget (default 350 ms).
   - Fails OPEN with diagnostic telemetry flags if inference server is congested,
     preventing service disruption to genuine banking customers.
"""

import base64
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.core.calibration_engine import calibration_engine
from app.core.models_loader import run_streaming_inference
from app.core.security_engine import security_engine
from app.core.telephony_codecs import apply_g711_alaw, apply_g711_mulaw, resample_audio

logger = logging.getLogger("voice_integrity.cpaas_telephony")

# Max allowable latency before circuit breaker trips into fail-open mode
MAX_SLA_LATENCY_MS = 350.0


class CPaaSSession:
    """Represents an active in-memory carrier telephony stream."""

    def __init__(
        self,
        stream_sid: str,
        call_sid: str,
        caller_ani: str = "+91-Carrier-Stream",
        encoding: str = "audio/x-mulaw",
        sample_rate: int = 8000,
    ):
        self.stream_sid = stream_sid
        self.call_sid = call_sid
        self.caller_ani = caller_ani
        self.encoding = encoding.lower()
        self.sample_rate = sample_rate
        self.start_time = time.time()
        self.audio_chunks: List[np.ndarray] = []
        self.total_samples = 0
        self.turn_counter = 0
        self.latest_verdict: Optional[Dict[str, Any]] = None
        self.latencies_ms: List[float] = []
        self.fail_open_tripped = False
        self.fallback_action = "ALLOW_CALL_FLAGGED"


class CPaaSTelephonyService:
    """
    Manages live carrier media-forking sessions, decodes streaming payloads,
    and applies calibrated inference with fail-open circuit breakers.
    """

    def __init__(self, sla_budget_ms: float = MAX_SLA_LATENCY_MS):
        self.sla_budget_ms = sla_budget_ms
        self._active_sessions: Dict[str, CPaaSSession] = {}

    def start_session(
        self,
        stream_sid: str,
        call_sid: str,
        caller_ani: str = "+91-Carrier-Stream",
        encoding: str = "audio/x-mulaw",
        sample_rate: int = 8000,
        fallback_action: str = "ALLOW_CALL_FLAGGED",
    ) -> CPaaSSession:
        """Registers a new inbound CPaaS stream."""
        session = CPaaSSession(
            stream_sid=stream_sid,
            call_sid=call_sid,
            caller_ani=caller_ani,
            encoding=encoding,
            sample_rate=sample_rate,
        )
        session.fallback_action = fallback_action
        self._active_sessions[stream_sid] = session
        logger.info(
            "CPaaS Stream started | StreamSID=%s | CallSID=%s | Encoding=%s | FallbackAction=%s",
            stream_sid,
            call_sid,
            encoding,
            fallback_action,
        )
        return session

    def get_session(self, stream_sid: str) -> Optional[CPaaSSession]:
        return self._active_sessions.get(stream_sid)

    def end_session(self, stream_sid: str) -> Optional[Dict[str, Any]]:
        """Terminates session and wipes volatile audio buffers."""
        session = self._active_sessions.pop(stream_sid, None)
        if not session:
            return None

        # Wipe memory buffer
        wiped_samples = 0
        for chunk in session.audio_chunks:
            wiped_samples += len(chunk)
            security_engine.secure_zero_memory(chunk)

        session.audio_chunks.clear()
        duration = round(time.time() - session.start_time, 2)
        p95_lat = float(np.percentile(session.latencies_ms, 95)) if session.latencies_ms else 0.0

        logger.info(
            "CPaaS Stream ended | StreamSID=%s | Duration=%.1fs | WipedSamples=%d | LatencyP95=%.1fms",
            stream_sid,
            duration,
            wiped_samples,
            p95_lat,
        )

        return {
            "status": "SESSION_CLOSED",
            "stream_sid": stream_sid,
            "call_sid": session.call_sid,
            "duration_seconds": duration,
            "total_turns_analyzed": session.turn_counter,
            "latency_p95_ms": round(p95_lat, 2),
            "fail_open_triggered": session.fail_open_tripped,
            "dpdp_wiped_samples": wiped_samples,
            "raw_disk_bytes": 0,
        }

    def decode_cpaas_media_chunk(
        self,
        base64_payload: str,
        encoding: str = "audio/x-mulaw",
    ) -> np.ndarray:
        """
        Decodes base64 telephony audio chunk to normalized 16kHz float32 PCM.
        Handles G.711 mu-law, A-law, and raw 8kHz PCM.
        """
        raw_bytes = base64.b64decode(base64_payload)
        enc = encoding.lower()

        if "mulaw" in enc or "pcmu" in enc:
            # G.711 mu-law 8-bit unsigned
            samples_uint8 = np.frombuffer(raw_bytes, dtype=np.uint8)
            norm_signed = (samples_uint8.astype(np.float32) - 128.0) / 128.0
            expanded_8k = apply_g711_mulaw(norm_signed)
        elif "alaw" in enc or "pcma" in enc:
            # G.711 A-law 8-bit unsigned
            samples_uint8 = np.frombuffer(raw_bytes, dtype=np.uint8)
            norm_signed = (samples_uint8.astype(np.float32) - 128.0) / 128.0
            expanded_8k = apply_g711_alaw(norm_signed)
        else:
            # Linear 16-bit PCM
            samples_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
            expanded_8k = (samples_int16.astype(np.float32) / 32768.0)

        # Resample from 8 kHz telephony up to 16 kHz for model inference
        pcm_16k = resample_audio(expanded_8k, orig_sr=8000, target_sr=16000)
        return pcm_16k

    def process_media_event(
        self,
        stream_sid: str,
        base64_payload: str,
        sequence_number: int = 0,
    ) -> Dict[str, Any]:
        """
        Processes an incoming telephony media frame, buffers chunks,
        and triggers calibrated inference when window reaches capacity.
        """
        session = self._active_sessions.get(stream_sid)
        if not session:
            # Auto-register if start event was skipped in testing
            session = self.start_session(stream_sid=stream_sid, call_sid=f"CALL-{stream_sid[:8]}")

        t_start = time.perf_counter()

        # Decode frame
        chunk_pcm = self.decode_cpaas_media_chunk(base64_payload, encoding=session.encoding)
        session.audio_chunks.append(chunk_pcm)
        session.total_samples += len(chunk_pcm)

        # Run inference once we have at least 1.5 seconds (24,000 samples at 16kHz)
        min_window_samples = 24000
        total_buffered = sum(len(c) for c in session.audio_chunks)

        if total_buffered < min_window_samples:
            return {
                "status": "BUFFERING",
                "stream_sid": stream_sid,
                "buffered_samples": total_buffered,
                "buffered_seconds": round(total_buffered / 16000.0, 3),
                "action": "CONTINUE_STREAM",
            }

        # Concatenate rolling 3-second buffer (48,000 samples)
        full_buffer = np.concatenate(session.audio_chunks)
        if len(full_buffer) > 48000:
            full_buffer = full_buffer[-48000:]

        session.turn_counter += 1

        # Check circuit breaker before inference
        if session.latencies_ms and len(session.latencies_ms) >= 3:
            recent_p95 = float(np.percentile(session.latencies_ms[-5:], 95))
            if recent_p95 > self.sla_budget_ms:
                session.fail_open_tripped = True
                action = session.fallback_action or "ALLOW_CALL_FLAGGED"
                reason = (
                    "Inference latency exceeded bank SLA budget (350ms). Fallback to STEP_UP verification to prevent DoS authentication bypass."
                    if action == "STEP_UP"
                    else "Inference latency exceeded bank SLA budget. System failed open to protect call continuity per retail policy."
                )
                logger.warning(
                    "CIRCUIT BREAKER TRIPPED (FAIL-SAFE) | StreamSID=%s | LatencyP95=%.1fms > SLA=%.1fms | Action=%s",
                    stream_sid,
                    recent_p95,
                    self.sla_budget_ms,
                    action,
                )
                return {
                    "status": "CIRCUIT_BREAKER_FAIL_OPEN",
                    "stream_sid": stream_sid,
                    "action": action,
                    "circuit_breaker_active": True,
                    "latency_violation_ms": recent_p95,
                    "reason": reason,
                }

        # Execute streaming inference
        try:
            verdict = run_streaming_inference(
                audio_buffer=full_buffer,
                session_id=stream_sid,
                turn_index=session.turn_counter,
            )
            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            session.latencies_ms.append(elapsed_ms)
            session.latest_verdict = verdict

            # Add carrier telephony metadata
            verdict["cpaas_telemetry"] = {
                "stream_sid": stream_sid,
                "call_sid": session.call_sid,
                "encoding": session.encoding,
                "latency_turn_ms": round(elapsed_ms, 2),
                "circuit_breaker_status": "NORMAL_OPERATION",
                "sla_budget_ms": self.sla_budget_ms,
            }
            return verdict
        except Exception as exc:
            logger.error("Inference error in CPaaS stream %s: %s; failing open.", stream_sid, exc)
            session.fail_open_tripped = True
            return {
                "status": "ERROR_FAIL_OPEN",
                "stream_sid": stream_sid,
                "action": "ALLOW_CALL_FLAGGED",
                "error": str(exc),
                "reason": "Model evaluation error. Failing open under bank high-availability policy.",
            }

    def get_cpaas_integration_config(self, host: str = "127.0.0.1:8000") -> Dict[str, Any]:
        """
        Returns ready-to-use SIPREC and CPaaS integration templates
        for Indian and international cloud telephony stacks.
        """
        ws_url = f"ws://{host}/api/v1/telephony/media-stream"

        return {
            "status": "INTEGRATION_TEMPLATES_READY",
            "websocket_endpoint": ws_url,
            "supported_codecs": ["audio/x-mulaw (PCMU 8kHz)", "audio/x-alaw (PCMA 8kHz)", "audio/l16 (Linear PCM 8kHz)"],
            "supported_providers": {
                "Exotel": {
                    "provider_type": "Indian Cloud Telephony Leader",
                    "webhook_applet": "Voice Streaming Applet",
                    "stream_target_url": ws_url,
                    "payload_format": "Exotel WebSocket Stream JSON (base64 mu-law)",
                },
                "Twilio": {
                    "provider_type": "Global CPaaS",
                    "twiml_snippet": f'<Response><Connect><Stream url="{ws_url}" /></Connect></Response>',
                },
                "Genesys_Cloud": {
                    "provider_type": "Enterprise Contact Center",
                    "integration_method": "AudioHook WebSocket Protocol",
                    "stream_target_url": ws_url,
                },
                "Asterisk_FreePBX": {
                    "provider_type": "On-Premises Banking PBX",
                    "module": "res_speech_fork / ExternalMedia",
                    "siprec_supported": True,
                },
            },
            "sla_configuration": {
                "max_latency_budget_ms": self.sla_budget_ms,
                "fail_open_policy": "ALLOW_STREAM_AND_FLAG_AUDIT",
                "dpdp_compliance": "Zero raw voice recording on disk",
            },
        }


# Module singleton
cpaas_telephony_service = CPaaSTelephonyService()
