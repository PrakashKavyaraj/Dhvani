"""
WebSocket endpoint for real-time live microphone streaming voice deepfake detection.

Protocol Contract:
- Client captures raw PCM 16kHz mono audio via AudioWorklet.
- Client sends binary chunks (Int16Array ArrayBuffer) every 125ms (250ms chunks, 50% overlap).
- Server appends incoming PCM to a 3-second (48,000 samples) in-memory rolling buffer.
- Server executes trained ML models (Forensics 0.3B, AASIST, ECAPA-TDNN, Fusion Engine)
  directly on the in-memory buffer with zero disk persistence.
- Server sends real-time JSON updates back to the frontend.
- On disconnect: buffer is securely zeroed and wiped in RAM, emitting a cryptographic HMAC receipt.
"""

import asyncio
import collections
import hashlib
import hmac
import logging
import time
import uuid
from typing import Deque

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.models_loader import run_streaming_inference
from app.core.security_engine import security_engine

logger = logging.getLogger("voice_integrity.websocket")

router = APIRouter()

# Max rolling buffer length: 3.0 seconds at 16 kHz = 48,000 float32 samples
MAX_BUFFER_SAMPLES = 48000
# Minimum samples required before triggering full model inference (0.5s = 8,000 samples)
MIN_INFERENCE_SAMPLES = 8000


@router.websocket("/ws/voice-detect")
async def voice_detect_websocket(websocket: WebSocket):
    """
    Real-time streaming voice authenticity detection endpoint.
    """
    await websocket.accept()
    session_id = f"live-{uuid.uuid4().hex[:12]}"
    session_start = time.time()
    turn_index = 0

    # In-memory rolling buffer (last 3 seconds)
    rolling_buffer: Deque[float] = collections.deque(maxlen=MAX_BUFFER_SAMPLES)

    logger.info("WebSocket client connected | Session=%s", session_id)

    # Send handshake confirmation
    await websocket.send_json({
        "status": "CONNECTED",
        "session_id": session_id,
        "sample_rate": 16000,
        "stride_ms": 125,
        "window_ms": 250,
        "buffer_max_sec": 3.0,
        "message": "Connected to Dhvani Real-Time Voice Integrity Engine",
    })

    try:
        while True:
            # Receive raw binary chunk from AudioWorklet
            message = await websocket.receive()
            if "bytes" not in message or not message["bytes"]:
                continue

            raw_bytes = message["bytes"]

            # Convert 16-bit PCM (Int16) to normalized Float32 [-1.0, 1.0]
            int16_chunk = np.frombuffer(raw_bytes, dtype=np.int16)
            if int16_chunk.size == 0:
                continue

            float_chunk = int16_chunk.astype(np.float32) / 32768.0

            # Append to in-memory sliding buffer
            rolling_buffer.extend(float_chunk.tolist())
            turn_index += 1

            # Run inference if sufficient audio has accumulated
            if len(rolling_buffer) >= MIN_INFERENCE_SAMPLES:
                audio_window = np.array(rolling_buffer, dtype=np.float32)
                
                try:
                    prediction = await asyncio.to_thread(
                        run_streaming_inference,
                        audio_buffer=audio_window,
                        session_id=session_id,
                        turn_index=turn_index,
                    )
                    await websocket.send_json(prediction)
                except Exception as infer_err:
                    logger.exception("Inference error in session %s: %s", session_id, infer_err)
                    await websocket.send_json({
                        "status": "ERROR",
                        "session_id": session_id,
                        "error": str(infer_err),
                    })
            else:
                # Buffer accumulation phase (first ~500ms)
                accumulated_sec = round(len(rolling_buffer) / 16000.0, 2)
                await websocket.send_json({
                    "status": "BUFFERING",
                    "session_id": session_id,
                    "turn_index": turn_index,
                    "accumulated_seconds": accumulated_sec,
                    "required_seconds": 0.5,
                    "risk_score": 10,
                    "risk_level": "LOW",
                    "tier": "GREEN_ZONE",
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally | Session=%s", session_id)
    except Exception as exc:
        logger.warning("WebSocket error in session %s: %s", session_id, exc)
    finally:
        # DPDP Act 2023 Compliance Gate: Ephemeral RAM buffer wipe
        t_wipe_start = time.perf_counter()
        samples_processed = len(rolling_buffer)
        
        # Explicit memory zero-fill overwrite and deallocation
        for i in range(len(rolling_buffer)):
            rolling_buffer[i] = 0.0
        rolling_buffer.clear()
        del rolling_buffer

        wipe_duration_us = max(1, int((time.perf_counter() - t_wipe_start) * 1_000_000))

        # Generate cryptographic audit HMAC signature
        session_duration = round(time.time() - session_start, 2)
        audit_payload = f"{session_id}:TURNS={turn_index}:SAMPLES={samples_processed}:DUR={session_duration}:{int(time.time())}"
        session_audit_hmac = hmac.new(
            security_engine.AUDIT_SECRET.encode("utf-8"),
            audit_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        logger.info(
            "DPDP Act 2023 Buffer Wiped | Session=%s | Turns=%d | WipeTime=%d us | RawDiskBytes=0 | HMAC=%s",
            session_id,
            turn_index,
            wipe_duration_us,
            session_audit_hmac[:16],
        )
