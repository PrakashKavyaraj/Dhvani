"""
Forensic Audio Spectrogram & Splicing Heatmap REST Endpoints for Dhvani.

Provides:
- POST /api/v1/spectrogram/generate: Computes 2D Mel-Spectrogram and temporal splicing segments.
- GET /api/v1/spectrogram/info: Returns spectrogram dimension parameters and supported palettes.
"""

import io
import wave
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
import numpy as np

from app.services.spectrogram_service import spectrogram_service

router = APIRouter(prefix="/spectrogram", tags=["Forensic Spectrogram & Splicing Heatmap"])


def _extract_samples_from_wav(file_bytes: bytes) -> Tuple[np.ndarray, int]:
    """Extracts mono float32 samples and sample rate from WAV bytes."""
    with io.BytesIO(file_bytes) as bio:
        with wave.open(bio, "rb") as wf:
            sr = wf.getframerate()
            n_ch = wf.getnchannels()
            sw = wf.getsampwidth()
            n_f = wf.getnframes()
            raw = wf.readframes(n_f)

            if sw == 2:
                samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
            elif sw == 1:
                samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
            else:
                samples = np.frombuffer(raw, dtype=np.float32)

            if n_ch > 1 and len(samples) > 0:
                samples = samples.reshape(-1, n_ch).mean(axis=1)

            return samples, sr


@router.post(
    "/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate 2D Mel-Spectrogram and temporal splicing segmentation from WAV audio",
)
async def generate_spectrogram(
    file: Optional[UploadFile] = File(None),
    synthetic_prob: float = Form(0.50),
    target_time_bins: int = Form(80),
):
    if not file:
        # Generate synthetic benchmark audio (2 seconds)
        sr = 16000
        t = np.linspace(0, 2.0, int(sr * 2.0), endpoint=False)
        # Part 1: Natural human tone; Part 2: Artificial high-frequency injection
        p1 = (0.5 * np.sin(2 * np.pi * 200 * t[:sr])).astype(np.float32)
        p2 = (0.5 * np.sin(2 * np.pi * 600 * t[sr:]) + 0.3 * np.sin(2 * np.pi * 4200 * t[sr:])).astype(np.float32)
        samples = np.concatenate([p1, p2])
    else:
        file_bytes = await file.read()
        try:
            samples, sr = _extract_samples_from_wav(file_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to decode WAV audio: {exc}",
            )

    spec_res = spectrogram_service.compute_spectrogram(
        samples=samples,
        sample_rate=sr,
        target_time_bins=target_time_bins,
    )

    segments = spectrogram_service.detect_splicing_and_segments(
        samples=samples,
        sample_rate=sr,
        baseline_fake_prob=synthetic_prob,
    )

    return {
        "status": "SUCCESS",
        "spectrogram": spec_res,
        "splicing_segments": segments,
        "sample_rate": sr,
        "audio_duration_sec": spec_res["time_duration_sec"],
    }


@router.get(
    "/info",
    status_code=status.HTTP_200_OK,
    summary="Get configuration and palette metadata for forensic spectrogram viewer",
)
async def get_spectrogram_info():
    return {
        "engine": "Dhvani Forensic Spectrogram & CSI Splicing Engine v1.0",
        "n_mels": spectrogram_service.n_mels,
        "frequency_range_hz": [spectrogram_service.fmin, spectrogram_service.fmax],
        "color_palettes": ["cyber_plasma", "deep_navy_cyan", "thermal_flame", "monochrome_green"],
        "segment_categories": {
            "AUTHENTIC_HUMAN": "Natural vocal resonance (Emerald)",
            "SYNTHETIC_INJECTION": "AI voice clone splice (Rose)",
            "PLC_CONCEALMENT": "Decoder loss concealment extrapolation (Amber)",
            "SILENCE_PAUSE": "Sub-threshold acoustic pause (Slate)",
        },
    }
