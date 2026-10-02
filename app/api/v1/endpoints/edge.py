"""
Edge-Defense Virtual Microphone & In-Browser Audio Detector REST Endpoints for Dhvani.

Features:
- Verifies physical hardware microphone authenticity
- Detects software loopbacks, virtual audio cables (VB-Audio, BlackHole, Loopback)
- Analyzes thermal Johnson-Nyquist room noise floor vs synthetic zero-entropy digital pipes
"""

import io
import wave
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
import numpy as np

from app.services.edge_defense_service import (
    VIRTUAL_DRIVER_KEYWORDS,
    edge_defense_service,
)

router = APIRouter(prefix="/edge", tags=["Edge-Defense & Virtual Mic Micro-Detector"])


class VerifyDeviceRequest(BaseModel):
    device_label: str = Field(..., description="Browser MediaDeviceInfo.label or driver identifier")
    sample_noise_floor_db: Optional[float] = Field(None, description="Measured ambient noise floor in dB")
    zero_sample_ratio: Optional[float] = Field(None, ge=0.0, le=1.0, description="Ratio of exact 0.0f mathematical silent samples")


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
    "/signatures",
    status_code=status.HTTP_200_OK,
    summary="Get known virtual audio driver detection signatures",
)
async def get_signatures():
    """Returns the blacklisted virtual driver keyword dictionary and detection heuristics."""
    return {
        "status": "SIGNATURES_ACTIVE",
        "total_signatures": len(VIRTUAL_DRIVER_KEYWORDS),
        "blacklisted_keywords": VIRTUAL_DRIVER_KEYWORDS,
    }


@router.post(
    "/verify-device",
    status_code=status.HTTP_200_OK,
    summary="Verify client audio device metadata and ambient noise telemetry",
)
async def verify_device(request: VerifyDeviceRequest):
    """Evaluates device label and noise floor telemetry for virtual cable interception."""
    res = edge_defense_service.verify_edge_device(
        device_label=request.device_label,
        audio_samples=None,
        sample_noise_floor_db=request.sample_noise_floor_db,
        zero_sample_ratio=request.zero_sample_ratio,
    )
    return res


@router.post(
    "/verify-device-audio",
    status_code=status.HTTP_200_OK,
    summary="Verify physical hardware authenticity using uploaded live ambient mic snippet",
)
async def verify_device_audio(
    device_label: str = Form(...),
    file: UploadFile = File(...),
):
    """Decodes live audio snippet to analyze Johnson-Nyquist thermal room noise and zero ratios."""
    audio_bytes = await file.read()
    try:
        samples, sr = _read_wav_samples(audio_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse audio stream: {str(exc)}",
        )

    res = edge_defense_service.verify_edge_device(
        device_label=device_label,
        audio_samples=samples,
        sample_rate=sr,
    )
    return res
