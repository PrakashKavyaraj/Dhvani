"""
Carrier CPaaS & SIP Telephony Media-Stream Router for Dhvani.

Exposes:
1. WebSocket `/api/v1/telephony/media-stream`:
   Compatible with Exotel Audio Streaming, Twilio Media Streams, and Genesys AudioHook.
2. GET `/api/v1/telephony/cpaas-config`:
   Configuration payloads and TwiML / Exotel applet integration snippets.
3. POST `/api/v1/telephony/simulate-call-turn`:
   REST endpoint for automated carrier simulation and testing.
"""

import json
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel, Field

from app.services.cpaas_telephony_service import cpaas_telephony_service

router = APIRouter(prefix="/telephony", tags=["Telephony Carrier Ingestion"])
logger = logging.getLogger("voice_integrity.telephony_router")


class CPaaSSimulateTurnRequest(BaseModel):
    stream_sid: str = Field(..., description="Unique carrier media stream identifier")
    call_sid: str = Field(default="CALL-SIM-991", description="Carrier call SID")
    caller_ani: str = Field(default="+91-98201-XXXXX", description="Caller phone number (ANI)")
    encoding: str = Field(default="audio/x-mulaw", description="Audio encoding (mulaw, alaw, pcm)")
    base64_payload: str = Field(..., description="Base64-encoded telephony audio payload chunk")
    sequence_number: int = Field(default=1, description="Frame sequence counter")


@router.websocket("/media-stream")
async def cpaas_media_stream_websocket(websocket: WebSocket):
    """
    WebSocket endpoint ingesting real-time media streams from carrier PBXs and CPaaS providers.
    Supports Exotel, Twilio, and Genesys Cloud media streaming protocols.
    """
    await websocket.accept()
    stream_sid: Optional[str] = None
    call_sid: Optional[str] = None

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "INVALID_JSON_PAYLOAD"}))
                continue

            event_type = data.get("event")

            # 1. Connection Handshake
            if event_type == "start":
                start_data = data.get("start", {})
                stream_sid = start_data.get("streamSid") or data.get("streamSid") or f"STRM-{id(websocket)}"
                call_sid = start_data.get("callSid") or data.get("callSid") or f"CALL-{id(websocket)}"
                media_format = start_data.get("mediaFormat", {})
                encoding = media_format.get("encoding", "audio/x-mulaw")
                sample_rate = int(media_format.get("sampleRate", 8000))

                cpaas_telephony_service.start_session(
                    stream_sid=stream_sid,
                    call_sid=call_sid,
                    encoding=encoding,
                    sample_rate=sample_rate,
                )
                await websocket.send_text(
                    json.dumps(
                        {
                            "event": "connected",
                            "streamSid": stream_sid,
                            "status": "MEDIA_STREAM_ACTIVE",
                            "codec_registered": encoding,
                        }
                    )
                )

            # 2. Audio Media Frame Chunk
            elif event_type == "media":
                media_info = data.get("media", {})
                payload = media_info.get("payload") or data.get("payload")
                seq = int(data.get("sequenceNumber", 0))

                if not stream_sid:
                    stream_sid = data.get("streamSid", f"STRM-{id(websocket)}")

                if payload:
                    verdict = cpaas_telephony_service.process_media_event(
                        stream_sid=stream_sid,
                        base64_payload=payload,
                        sequence_number=seq,
                    )

                    # Send verdict event back to carrier gateway
                    response_event = {
                        "event": "verdict",
                        "streamSid": stream_sid,
                        "turn": verdict.get("turn_index", seq),
                        "status": verdict.get("status"),
                        "action": verdict.get("action", "CONTINUE_STREAM"),
                        "risk_score": verdict.get("risk_score", 0),
                        "calibrated_probability": verdict.get("calibrated_probability", 0.0),
                    }

                    # If risk is critical, dispatch automated line intervention alert
                    if verdict.get("action") == "BLOCK" or verdict.get("risk_score", 0) >= 71:
                        response_event["alert"] = {
                            "type": "HIGH_CONFIDENCE_SPOOF_INTERCEPT",
                            "directive": "TERMINATE_CALL_OR_DIVERT",
                            "averted_fraud_alert": True,
                        }

                    await websocket.send_text(json.dumps(response_event))

            # 3. Stream Termination Event
            elif event_type == "stop":
                if stream_sid:
                    summary = cpaas_telephony_service.end_session(stream_sid)
                    await websocket.send_text(json.dumps({"event": "closed", "summary": summary}))
                break

    except WebSocketDisconnect:
        logger.info("Carrier WebSocket disconnected | StreamSID=%s", stream_sid)
    except Exception as exc:
        logger.error("Carrier WebSocket error | StreamSID=%s: %s", stream_sid, exc)
    finally:
        if stream_sid:
            cpaas_telephony_service.end_session(stream_sid)


@router.get("/cpaas-config")
async def get_cpaas_integration_config(request: Request):
    """
    Returns deployment snippets and webhook configurations for Exotel, Twilio, and Genesys.
    """
    host = request.headers.get("host", "127.0.0.1:8000")
    return cpaas_telephony_service.get_cpaas_integration_config(host=host)


@router.post("/simulate-call-turn")
async def simulate_call_turn(payload: CPaaSSimulateTurnRequest):
    """
    Synchronous REST endpoint for testing carrier media payload ingestion.
    """
    # Ensure session is registered
    session = cpaas_telephony_service.get_session(payload.stream_sid)
    if not session:
        cpaas_telephony_service.start_session(
            stream_sid=payload.stream_sid,
            call_sid=payload.call_sid,
            caller_ani=payload.caller_ani,
            encoding=payload.encoding,
        )

    verdict = cpaas_telephony_service.process_media_event(
        stream_sid=payload.stream_sid,
        base64_payload=payload.base64_payload,
        sequence_number=payload.sequence_number,
    )
    return {
        "status": "TURN_EVALUATED",
        "stream_sid": payload.stream_sid,
        "verdict": verdict,
    }
