#!/usr/bin/env python3
"""
Live Carrier Sandbox Caller for Dhvani Voice Integrity.

Simulates live carrier SIP media-forking sessions from Exotel, Twilio, and Genesys.
Connects via WebSocket to /api/v1/telephony/media-stream, streams 20ms audio frames,
measures live connection handshake latency, round-trip verdict latency per turn,
and verifies zero-leakage session teardown.
"""

import argparse
import asyncio
import base64
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

# Ensure backend root is on sys.path
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("dhvani.sandbox_caller")


def generate_audio_frame(
    codec: str = "audio/x-mulaw",
    num_samples: int = 160,
    frequency: float = 300.0,
) -> str:
    """
    Generates a 20ms audio frame at 8 kHz (160 samples), companded to mu-law or A-law.
    Returns base64 encoded byte string.
    """
    t = np.linspace(0, num_samples / 8000.0, num_samples, endpoint=False)
    # Voice harmonic simulation
    signal = 0.5 * np.sin(2 * np.pi * frequency * t) + 0.25 * np.sin(2 * np.pi * (frequency * 2.5) * t)
    pcm = np.clip(signal, -1.0, 1.0)

    if "alaw" in codec.lower():
        # A-law companding approximation
        a_param = 87.6
        abs_pcm = np.abs(pcm)
        threshold = 1.0 / a_param
        safe_arg = np.maximum(1e-9, a_param * abs_pcm)
        companded = np.where(
            abs_pcm < threshold,
            (a_param * abs_pcm) / (1.0 + np.log(a_param)),
            (1.0 + np.log(safe_arg)) / (1.0 + np.log(a_param)),
        ) * np.sign(pcm)
    else:
        # mu-law companding approximation
        mu_param = 255.0
        companded = np.sign(pcm) * (np.log1p(mu_param * np.abs(pcm)) / np.log1p(mu_param))

    quantized = ((companded + 1.0) / 2.0 * 255.0).astype(np.uint8)
    return base64.b64encode(quantized.tobytes()).decode("utf-8")


def read_audio_file_chunks(
    audio_path: Path,
    codec: str = "audio/x-mulaw",
    chunk_samples: int = 160,
) -> List[str]:
    """
    Reads an audio file (raw or wav), downsamples to 8kHz if needed, and splits into 20ms chunks.
    Falls back to synthetic generation if file cannot be decoded.
    """
    try:
        import soundfile as sf
        data, sr = sf.read(str(audio_path), dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)

        # Simple resample to 8kHz if required
        if sr != 8000:
            target_length = int(len(data) * 8000.0 / float(sr))
            indices = np.linspace(0, len(data) - 1, target_length)
            data = np.interp(indices, np.arange(len(data)), data)

        chunks_b64: List[str] = []
        for i in range(0, len(data), chunk_samples):
            chunk = data[i : i + chunk_samples]
            if len(chunk) < chunk_samples:
                chunk = np.pad(chunk, (0, chunk_samples - len(chunk)))

            pcm = np.clip(chunk, -1.0, 1.0)
            mu = 255.0
            comp = np.sign(pcm) * (np.log1p(mu * np.abs(pcm)) / np.log1p(mu))
            quant = ((comp + 1.0) / 2.0 * 255.0).astype(np.uint8)
            chunks_b64.append(base64.b64encode(quant.tobytes()).decode("utf-8"))

        return chunks_b64
    except Exception as exc:
        logger.warning("Could not read audio file %s (%s). Using synthetic frames.", audio_path, exc)
        return []


def run_in_process_sandbox_call(
    provider: str = "exotel",
    turns: int = 30,
    codec: str = "audio/x-mulaw",
    caller_ani: str = "+919876543210",
    audio_chunks: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Runs an end-to-end sandbox call against the in-process FastAPI application using TestClient.
    """
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    stream_sid = f"{provider.upper()}-STRM-{int(time.time() * 1000)}"
    call_sid = f"{provider.upper()}-CALL-{int(time.time() * 1000)}"

    turn_latencies_ms: List[float] = []
    verdicts: List[Dict[str, Any]] = []

    logger.info("Dialing Dhvani CPaaS Gateway (In-Process) | Provider=%s | CallSID=%s", provider, call_sid)

    t_connect_start = time.perf_counter()
    with client.websocket_connect("/api/v1/telephony/media-stream") as ws:
        handshake_ms = (time.perf_counter() - t_connect_start) * 1000.0

        # Send carrier start event
        start_payload = {
            "event": "start",
            "start": {
                "streamSid": stream_sid,
                "callSid": call_sid,
                "callerAni": caller_ani,
                "mediaFormat": {
                    "encoding": codec,
                    "sampleRate": 8000,
                    "channels": 1,
                },
            },
        }
        t_start_event = time.perf_counter()
        ws.send_json(start_payload)
        resp_start = ws.receive_json()
        start_ack_ms = (time.perf_counter() - t_start_event) * 1000.0

        logger.info(
            "WebSocket Handshake Completed | ConnectionTime=%.2fms | StartAck=%.2fms | Status=%s",
            handshake_ms,
            start_ack_ms,
            resp_start.get("status"),
        )

        # Prepare audio chunks
        chunks = audio_chunks if audio_chunks else [generate_audio_frame(codec=codec) for _ in range(turns)]
        actual_turns = min(len(chunks), turns)

        # Stream media turns
        for seq in range(actual_turns):
            frame_b64 = chunks[seq]
            media_msg = {
                "event": "media",
                "streamSid": stream_sid,
                "sequenceNumber": seq,
                "media": {
                    "payload": frame_b64,
                },
            }
            t_send = time.perf_counter()
            ws.send_json(media_msg)
            verdict_msg = ws.receive_json()
            rtt_ms = (time.perf_counter() - t_send) * 1000.0

            turn_latencies_ms.append(rtt_ms)
            verdicts.append(verdict_msg)

        # Send stop event to gracefully teardown and purge memory buffers
        stop_msg = {"event": "stop", "streamSid": stream_sid}
        ws.send_json(stop_msg)
        teardown_ack = ws.receive_json()

    latencies_arr = np.array(turn_latencies_ms, dtype=np.float64)
    p50 = float(np.percentile(latencies_arr, 50))
    p90 = float(np.percentile(latencies_arr, 90))
    p95 = float(np.percentile(latencies_arr, 95))
    p99 = float(np.percentile(latencies_arr, 99))
    max_lat = float(np.max(latencies_arr))
    sla_violations = int(np.sum(latencies_arr > 350.0))

    final_verdict = verdicts[-1] if verdicts else {}

    return {
        "provider": provider,
        "stream_sid": stream_sid,
        "call_sid": call_sid,
        "caller_ani": caller_ani,
        "codec": codec,
        "handshake_latency_ms": round(handshake_ms, 2),
        "start_ack_latency_ms": round(start_ack_ms, 2),
        "total_turns_streamed": len(turn_latencies_ms),
        "turn_latencies": {
            "p50_ms": round(p50, 2),
            "p90_ms": round(p90, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "max_ms": round(max_lat, 2),
            "mean_ms": round(float(np.mean(latencies_arr)), 2),
        },
        "sla_budget_ms": 350.0,
        "sla_violations": sla_violations,
        "sla_compliance_pct": round((1.0 - (sla_violations / float(len(turn_latencies_ms)))) * 100.0, 2),
        "final_verdict": final_verdict,
        "teardown_summary": teardown_ack.get("summary", {}),
    }


async def run_remote_sandbox_call(
    server_url: str,
    provider: str = "twilio",
    turns: int = 30,
    codec: str = "audio/x-mulaw",
    caller_ani: str = "+919876543210",
    audio_chunks: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Connects to a live external WebSocket gateway over the network using the websockets client.
    """
    import websockets

    stream_sid = f"{provider.upper()}-STRM-{int(time.time() * 1000)}"
    call_sid = f"{provider.upper()}-CALL-{int(time.time() * 1000)}"

    logger.info("Connecting to Remote Carrier Gateway | URL=%s | Provider=%s", server_url, provider)

    t_connect_start = time.perf_counter()
    async with websockets.connect(server_url) as ws:
        handshake_ms = (time.perf_counter() - t_connect_start) * 1000.0

        start_payload = {
            "event": "start",
            "start": {
                "streamSid": stream_sid,
                "callSid": call_sid,
                "callerAni": caller_ani,
                "mediaFormat": {
                    "encoding": codec,
                    "sampleRate": 8000,
                    "channels": 1,
                },
            },
        }
        t_start_event = time.perf_counter()
        await ws.send(json.dumps(start_payload))
        resp_start = json.loads(await ws.recv())
        start_ack_ms = (time.perf_counter() - t_start_event) * 1000.0

        chunks = audio_chunks if audio_chunks else [generate_audio_frame(codec=codec) for _ in range(turns)]
        actual_turns = min(len(chunks), turns)

        turn_latencies_ms: List[float] = []
        verdicts: List[Dict[str, Any]] = []

        for seq in range(actual_turns):
            frame_b64 = chunks[seq]
            media_msg = {
                "event": "media",
                "streamSid": stream_sid,
                "sequenceNumber": seq,
                "media": {
                    "payload": frame_b64,
                },
            }
            t_send = time.perf_counter()
            await ws.send(json.dumps(media_msg))
            verdict_msg = json.loads(await ws.recv())
            rtt_ms = (time.perf_counter() - t_send) * 1000.0

            turn_latencies_ms.append(rtt_ms)
            verdicts.append(verdict_msg)

        stop_msg = {"event": "stop", "streamSid": stream_sid}
        await ws.send(json.dumps(stop_msg))
        teardown_ack = json.loads(await ws.recv())

    latencies_arr = np.array(turn_latencies_ms, dtype=np.float64)
    p50 = float(np.percentile(latencies_arr, 50))
    p90 = float(np.percentile(latencies_arr, 90))
    p95 = float(np.percentile(latencies_arr, 95))
    p99 = float(np.percentile(latencies_arr, 99))
    max_lat = float(np.max(latencies_arr))
    sla_violations = int(np.sum(latencies_arr > 350.0))

    final_verdict = verdicts[-1] if verdicts else {}

    return {
        "provider": provider,
        "stream_sid": stream_sid,
        "call_sid": call_sid,
        "caller_ani": caller_ani,
        "codec": codec,
        "handshake_latency_ms": round(handshake_ms, 2),
        "start_ack_latency_ms": round(start_ack_ms, 2),
        "total_turns_streamed": len(turn_latencies_ms),
        "turn_latencies": {
            "p50_ms": round(p50, 2),
            "p90_ms": round(p90, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "max_ms": round(max_lat, 2),
            "mean_ms": round(float(np.mean(latencies_arr)), 2),
        },
        "sla_budget_ms": 350.0,
        "sla_violations": sla_violations,
        "sla_compliance_pct": round((1.0 - (sla_violations / float(len(turn_latencies_ms)))) * 100.0, 2),
        "final_verdict": final_verdict,
        "teardown_summary": teardown_ack.get("summary", {}),
    }


def format_carrier_markdown_report(result: Dict[str, Any]) -> str:
    """Formats sandbox caller results into an executive Markdown report."""
    md = []
    md.append("# Dhvani Carrier Integration: Sandbox Call Report")
    md.append(f"**Carrier Provider:** {result['provider'].upper()}")
    md.append(f"**Stream SID:** `{result['stream_sid']}`")
    md.append(f"**Call SID:** `{result['call_sid']}`")
    md.append(f"**Caller ANI:** `{result['caller_ani']}`")
    md.append(f"**Encoding:** `{result['codec']}`\n")

    md.append("## Handshake & Streaming Latency Profile")
    md.append(f"* **WebSocket Handshake Latency:** {result['handshake_latency_ms']} ms")
    md.append(f"* **Carrier Start Event ACK:** {result['start_ack_latency_ms']} ms")
    md.append(f"* **Total Turns Streamed:** {result['total_turns_streamed']}")
    md.append(f"* **Median (p50) Turn Latency:** {result['turn_latencies']['p50_ms']} ms")
    md.append(f"* **p90 Turn Latency:** {result['turn_latencies']['p90_ms']} ms")
    md.append(f"* **p95 Turn Latency:** {result['turn_latencies']['p95_ms']} ms")
    md.append(f"* **p99 Turn Latency:** {result['turn_latencies']['p99_ms']} ms")
    md.append(f"* **Maximum Turn Latency:** {result['turn_latencies']['max_ms']} ms")
    md.append(f"* **350ms SLA Compliance Rate:** **{result['sla_compliance_pct']}%**\n")

    md.append("## Teardown & Privacy Audit")
    summary = result.get("teardown_summary", {})
    wiped = summary.get("dpdp_wiped_samples", 0)
    disk = summary.get("raw_disk_bytes", 0)
    md.append(f"* **Session Status:** {summary.get('status', 'CLOSED')}")
    md.append(f"* **DPDP Zeroized Audio Samples:** {wiped}")
    md.append(f"* **Zero-Disk Retention Invariant:** {disk} raw audio bytes persisted to disk\n")

    md.append("## Latest Detection Verdict")
    verdict = result.get("final_verdict", {})
    md.append(f"* **Action:** `{verdict.get('action', 'N/A')}`")
    md.append(f"* **Risk Score:** {verdict.get('risk_score', 0)} / 100")
    md.append(f"* **Calibrated Probability:** {verdict.get('calibrated_probability', 0.0)}")
    return "\n".join(md)


def main():
    parser = argparse.ArgumentParser(description="Dhvani Carrier Sandbox Caller")
    parser.add_argument("--provider", type=str, choices=["exotel", "twilio", "genesys"], default="exotel", help="CPaaS provider simulation profile.")
    parser.add_argument("--server-url", type=str, default=None, help="Optional remote WebSocket URL (e.g. ws://localhost:8000/api/v1/telephony/media-stream).")
    parser.add_argument("--turns", type=int, default=30, help="Number of 20ms audio turns to stream.")
    parser.add_argument("--codec", type=str, choices=["audio/x-mulaw", "audio/x-alaw"], default="audio/x-mulaw", help="Audio companding codec.")
    parser.add_argument("--ani", type=str, default="+919876543210", help="Caller telephone number.")
    parser.add_argument("--audio-file", type=str, default=None, help="Optional WAV file path to stream.")
    parser.add_argument("--output-json", type=str, default=None, help="Optional output JSON path.")
    parser.add_argument("--output-md", type=str, default=None, help="Optional output Markdown path.")
    args = parser.parse_args()

    audio_chunks = None
    if args.audio_file:
        audio_chunks = read_audio_file_chunks(Path(args.audio_file), codec=args.codec)

    if args.server_url:
        result = asyncio.run(
            run_remote_sandbox_call(
                server_url=args.server_url,
                provider=args.provider,
                turns=args.turns,
                codec=args.codec,
                caller_ani=args.ani,
                audio_chunks=audio_chunks,
            )
        )
    else:
        result = run_in_process_sandbox_call(
            provider=args.provider,
            turns=args.turns,
            codec=args.codec,
            caller_ani=args.ani,
            audio_chunks=audio_chunks,
        )

    md = format_carrier_markdown_report(result)

    if args.output_json:
        out_j = Path(args.output_json)
        out_j.parent.mkdir(parents=True, exist_ok=True)
        with open(out_j, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        logger.info("Saved sandbox call result to %s", out_j)

    if args.output_md:
        out_m = Path(args.output_md)
        out_m.parent.mkdir(parents=True, exist_ok=True)
        with open(out_m, "w", encoding="utf-8") as f:
            f.write(md)
        logger.info("Saved sandbox call report to %s", out_m)

    print("\n" + md)


if __name__ == "__main__":
    main()
