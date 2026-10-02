"""
Dual-Channel Call Center Agent Co-Pilot REST Endpoints for Dhvani.

Features:
- Live turn-by-turn dialogue evaluation across Agent (CH_1) and Caller (CH_2) streams
- Dynamic Out-of-Band Nonce & Cognitive Challenge Recommendation
- One-Click Supervisor Escalation & Fraud Desk Conference Bridge
- Real-Time Risk Heat-Strip & Conversational Latency Telemetry
"""

import io
import wave
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
import numpy as np

from app.services.call_copilot_service import (
    ChallengePrompt,
    call_copilot_service,
)

router = APIRouter(prefix="/copilot", tags=["Call Center Agent Co-Pilot"])


class EvaluateTurnRequest(BaseModel):
    session_id: str = Field(..., description="Unique call session ID")
    speaker: str = Field("CALLER", description="Speaker: 'AGENT' or 'CALLER'")
    text: str = Field(..., description="Transcribed or simulated turn speech")
    latency_ms: float = Field(250.0, ge=0.0, description="Response hesitation latency in ms")
    forced_synthetic_prob: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional manual override for synthetic probability")


class SupervisorEscalateRequest(BaseModel):
    session_id: str = Field(..., description="Unique call session ID")
    agent_id: str = Field("AGENT-DESK-01", description="Bank agent identifier")
    reason: str = Field("High-confidence synthetic voice clone detected on caller channel", description="Escalation rationale")


def _read_wav_samples(wav_bytes: bytes) -> tuple[np.ndarray, int]:
    """Decodes WAV bytes into a 1D float32 numpy array normalized to [-1.0, 1.0]."""
    with io.BytesIO(wav_bytes) as bio:
        with wave.open(bio, "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            raw_data = wf.readframes(n_frames)

            if sampwidth == 2:
                dtype = np.int16
                max_val = 32768.0
            elif sampwidth == 1:
                dtype = np.uint8
                max_val = 128.0
            elif sampwidth == 4:
                dtype = np.int32
                max_val = 2147483648.0
            else:
                dtype = np.int16
                max_val = 32768.0

            audio = np.frombuffer(raw_data, dtype=dtype).astype(np.float32) / max_val
            if n_channels > 1:
                audio = audio.reshape(-1, n_channels).mean(axis=1)

            return audio, framerate


@router.get(
    "/sample-session",
    status_code=status.HTTP_200_OK,
    summary="Get pre-configured canonical dual-channel contact center demonstration session",
)
async def get_sample_session():
    """Returns the SBI Priority Desk impersonation attack session with complete dual-channel history."""
    session = call_copilot_service.get_session("COPILOT-DEMO-SBI-8921")
    if not session:
        call_copilot_service._init_sample_session()
        session = call_copilot_service.get_session("COPILOT-DEMO-SBI-8921")
    return session


@router.get(
    "/session/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Get live co-pilot session details by ID",
)
async def get_session_details(session_id: str):
    """Retrieves session telemetry, dialogue history, and active challenge prompts."""
    session = call_copilot_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Co-pilot session '{session_id}' not found.",
        )
    return session


@router.get(
    "/active-prompts",
    status_code=status.HTTP_200_OK,
    summary="Get dynamic agent guidance prompts based on caller risk tier",
)
async def get_active_prompts(risk_score: float = 0.5):
    """Returns Tier 1, Tier 2, or Tier 3 challenge prompts matching the provided risk score."""
    prompts = ChallengePrompt.get_tier_prompts(risk_score)
    return {
        "risk_score": risk_score,
        "tier": "CRITICAL" if risk_score >= 0.70 else "ELEVATED" if risk_score >= 0.35 else "STANDARD",
        "prompts": prompts,
    }


@router.post(
    "/evaluate-turn",
    status_code=status.HTTP_200_OK,
    summary="Evaluate dialogue turn with optional text and latency parameters",
)
async def evaluate_turn(request: EvaluateTurnRequest):
    """Evaluates a dialogue turn on either the AGENT or CALLER channel."""
    result = call_copilot_service.evaluate_turn(
        session_id=request.session_id,
        speaker=request.speaker,
        text=request.text,
        audio_samples=None,
        sample_rate=16000,
        latency_ms=request.latency_ms,
        forced_synthetic_prob=request.forced_synthetic_prob,
    )
    return result


@router.post(
    "/evaluate-audio-turn",
    status_code=status.HTTP_200_OK,
    summary="Evaluate dialogue turn with uploaded WAV audio stream",
)
async def evaluate_audio_turn(
    session_id: str = Form(...),
    speaker: str = Form("CALLER"),
    text: str = Form(""),
    latency_ms: float = Form(250.0),
    file: UploadFile = File(...),
):
    """Evaluates live acoustic audio for synthetic vocoder features, pitch freezes, and latency."""
    audio_bytes = await file.read()
    try:
        samples, sr = _read_wav_samples(audio_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse audio stream: {str(exc)}",
        )

    result = call_copilot_service.evaluate_turn(
        session_id=session_id,
        speaker=speaker,
        text=text or "Live acoustic speech segment",
        audio_samples=samples,
        sample_rate=sr,
        latency_ms=latency_ms,
    )
    return result


@router.post(
    "/supervisor-escalate",
    status_code=status.HTTP_200_OK,
    summary="Emergency supervisor escalation and transaction freeze trigger",
)
async def supervisor_escalate(request: SupervisorEscalateRequest):
    """Triggers instant supervisor takeover, freezes transfers, and issues an escalation docket."""
    escalation = call_copilot_service.trigger_supervisor_escalation(
        session_id=request.session_id,
        agent_id=request.agent_id,
        reason=request.reason,
    )
    return escalation


@router.post(
    "/reset-session",
    status_code=status.HTTP_200_OK,
    summary="Reset session to fresh monitoring state",
)
async def reset_session(session_id: str = Form(...)):
    """Resets session turns and risk strip back to clean baseline."""
    if session_id == "COPILOT-DEMO-SBI-8921":
        call_copilot_service._init_sample_session()
        return {"status": "RESET_SAMPLE_SUCCESS", "session_id": session_id}

    session = call_copilot_service.get_or_create_session(session_id)
    session["turns"] = []
    session["current_risk_score"] = 0.10
    session["risk_status"] = "NORMAL"
    session["status"] = "ACTIVE_MONITORING"
    session["risk_heat_strip"] = [{"time_sec": 0.0, "score": 0.10, "level": "LOW"}]
    session["supervisor_escalated"] = False
    session["supervisor_escalation_id"] = None
    session["escalation_notes"] = None
    session["active_prompts"] = ChallengePrompt.get_tier_prompts(0.10)

    return {"status": "RESET_SUCCESS", "session": session}
