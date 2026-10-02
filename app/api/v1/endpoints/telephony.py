"""
Carrier Telephony Resilience & Packet Loss Concealment (PLC) REST Endpoints for Dhvani.

Standards & Specifications:
- ITU-T G.107 E-Model: Transmission rating factor R and Mean Opinion Score (MOS).
- ITU-T G.711 Appendix I / G.729: Packet Loss Concealment pitch-repetition artifact detection.
- Gilbert-Elliott 2-State Markov Model: Bursty packet loss and jitter simulation.
- Degradation De-biasing: Compensates for packet loss to prevent false-positive deepfake alerts.
"""

import base64
import io
import math
import wave
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
import numpy as np

from app.core.telephony_resilience_engine import (
    CODEC_E_MODEL_PROFILES,
    telephony_resilience_engine,
)

router = APIRouter(prefix="/telephony", tags=["Telephony Resilience & Packet Loss Concealment"])


class AnalyzeChannelRequest(BaseModel):
    packet_loss_rate: float = Field(0.0, ge=0.0, le=1.0, description="Measured packet loss rate (0.0 to 1.0)")
    jitter_ms: float = Field(0.0, ge=0.0, description="Network jitter in milliseconds")
    codec: str = Field("G.711", description="Carrier codec (G.711, G.729, AMR, AMR-WB, OPUS)")
    one_way_delay_ms: float = Field(40.0, ge=0.0, description="One-way network latency in ms")


class SimulateDegradationRequest(BaseModel):
    target_loss_rate: float = Field(0.08, ge=0.0, le=0.40, description="Target packet loss rate (e.g. 0.08 = 8%)")
    jitter_ms: float = Field(30.0, ge=0.0, le=200.0, description="Network jitter in ms")
    burst_length_avg: float = Field(2.0, ge=1.0, le=10.0, description="Average burst drop length in 20ms frames")
    apply_plc: bool = Field(True, description="Apply G.711 Appendix I pitch extrapolation PLC")
    codec: str = Field("G.711", description="Carrier codec profile")


def _read_wav_samples(file_bytes: bytes) -> Tuple[np.ndarray, int]:
    """Extracts normalized float32 mono samples from WAV bytes."""
    with io.BytesIO(file_bytes) as bio:
        with wave.open(bio, "rb") as wf:
            sample_rate = wf.getframerate()
            num_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            num_frames = wf.getnframes()
            raw_data = wf.readframes(num_frames)

            if sample_width == 2:
                samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32768.0
            elif sample_width == 1:
                samples = (np.frombuffer(raw_data, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
            else:
                samples = np.frombuffer(raw_data, dtype=np.float32)

            if num_channels > 1 and len(samples) > 0:
                samples = samples.reshape(-1, num_channels).mean(axis=1)

            return samples, sample_rate


@router.post(
    "/analyze-channel",
    status_code=status.HTTP_200_OK,
    summary="Analyze audio for Packet Loss Concealment (PLC) artifacts and ITU-T G.107 QoS",
)
async def analyze_channel(
    file: Optional[UploadFile] = File(None),
    packet_loss_rate: Optional[float] = Form(None),
    jitter_ms: Optional[float] = Form(None),
    codec: Optional[str] = Form("G.711"),
):
    samples = None
    sample_rate = 16000

    if file:
        file_bytes = await file.read()
        try:
            samples, sample_rate = _read_wav_samples(file_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid WAV audio file: {exc}",
            )

    if samples is not None and len(samples) > 0:
        plc_analysis = telephony_resilience_engine.detect_plc_artifacts(
            audio_samples=samples,
            sample_rate=sample_rate,
        )
        plr = plc_analysis["estimated_packet_loss_rate"] if packet_loss_rate is None else packet_loss_rate
        jitter = 25.0 if (jitter_ms is None and plc_analysis["burst_loss_detected"]) else (jitter_ms or 0.0)
    else:
        plr = packet_loss_rate or 0.0
        jitter = jitter_ms or 0.0
        plc_analysis = {
            "plc_artifact_prob": 0.0,
            "plc_detected": False,
            "plc_frame_count": 0,
            "estimated_packet_loss_rate": plr,
            "burst_loss_detected": False,
            "disentanglement_verdict": "SYNTHETIC_PERIODICITY_SUSPECT" if plr > 0.10 else "NATURAL_ACOUSTIC_TRANSMISSION",
        }

    qos = telephony_resilience_engine.compute_e_model_qos(
        packet_loss_rate=plr,
        jitter_ms=jitter,
        codec=codec or "G.711",
    )

    # Compute degradation de-biasing suggestion
    _, applied_discount, reasons = telephony_resilience_engine.calibrate_degradation_debiasing(
        acoustic_fake_prob=0.75,  # Benchmark test level
        plc_artifact_prob=plc_analysis["plc_artifact_prob"],
        packet_loss_rate=plr,
        mos_score=qos["mos_score"],
        codec=codec,
        snr_db=18.0,
    )

    return {
        "status": "SUCCESS",
        "plc_analysis": plc_analysis,
        "qos": qos,
        "degradation_discount": applied_discount,
        "explainability_reasons": reasons,
        "recommended_action": (
            "DISCOUNT_DEGRADATION" if applied_discount >= 0.20 else "MAINTAIN_STANDARD_ASSESSMENT"
        ),
    }


@router.post(
    "/simulate-degradation",
    status_code=status.HTTP_200_OK,
    summary="Simulate Gilbert-Elliott network packet loss, jitter, and G.711 PLC on audio",
)
async def simulate_degradation(
    file: Optional[UploadFile] = File(None),
    target_loss_rate: float = Form(0.08),
    jitter_ms: float = Form(30.0),
    burst_length_avg: float = Form(2.0),
    apply_plc: bool = Form(True),
    codec: str = Form("G.711"),
):
    if file:
        file_bytes = await file.read()
        try:
            samples, sample_rate = _read_wav_samples(file_bytes)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    else:
        # Generate synthetic 16kHz speech harmonic test tone (2 seconds)
        sample_rate = 16000
        duration = 2.0
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        samples = (0.4 * np.sin(2 * np.pi * 220 * t) + 0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

    sim_res = telephony_resilience_engine.simulate_network_degradation(
        audio_samples=samples,
        sample_rate=sample_rate,
        target_loss_rate=target_loss_rate,
        burst_length_avg=burst_length_avg,
        jitter_ms=jitter_ms,
        apply_plc=apply_plc,
    )

    # Perform PLC artifact detection on degraded audio
    plc_analysis = telephony_resilience_engine.detect_plc_artifacts(
        audio_samples=sim_res["degraded_audio"],
        sample_rate=sample_rate,
    )

    # Compute de-biasing
    _, discount, reasons = telephony_resilience_engine.calibrate_degradation_debiasing(
        acoustic_fake_prob=0.80,
        plc_artifact_prob=plc_analysis["plc_artifact_prob"],
        packet_loss_rate=sim_res["actual_loss_rate"],
        mos_score=sim_res["qos"]["mos_score"],
        codec=codec,
        snr_db=15.0,
    )

    return {
        "status": "SIMULATION_COMPLETED",
        "simulation_parameters": {
            "target_loss_rate": target_loss_rate,
            "jitter_ms": jitter_ms,
            "burst_length_avg": burst_length_avg,
            "applied_plc": apply_plc,
            "codec": codec.upper(),
        },
        "network_results": {
            "actual_loss_rate": sim_res["actual_loss_rate"],
            "dropped_frames": sim_res["dropped_frames"],
            "total_frames": sim_res["total_frames"],
            "qos": sim_res["qos"],
        },
        "plc_detection": plc_analysis,
        "debiasing_discount": discount,
        "explainability_reasons": reasons,
    }


@router.post(
    "/compensate-plc",
    status_code=status.HTTP_200_OK,
    summary="Restore dropped/corrupted frames in telephony audio via predictive in-painting",
)
async def compensate_plc(file: UploadFile = File(...)):
    file_bytes = await file.read()
    try:
        samples, sample_rate = _read_wav_samples(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    res = telephony_resilience_engine.restore_packet_loss(
        audio_samples=samples,
        sample_rate=sample_rate,
    )

    return {
        "status": "COMPENSATED",
        "repaired_frames": res["repaired_frames"],
        "restoration_applied": res["restoration_applied"],
        "sample_rate": sample_rate,
        "total_samples": len(samples),
    }


@router.get(
    "/codecs",
    status_code=status.HTTP_200_OK,
    summary="List carrier telephony codecs with ITU-T G.107 equipment impairment factors",
)
async def list_supported_codecs():
    return {
        "codecs": CODEC_E_MODEL_PROFILES,
        "standards": [
            "ITU-T Recommendation G.107 (The E-model)",
            "ITU-T Recommendation G.711 Appendix I (PLC)",
            "ITU-T Recommendation G.729 (CS-ACELP)",
            "3GPP TS 26.071 (AMR Speech Processing)",
            "IETF RFC 6716 (Opus Audio Codec)",
        ],
    }


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Aggregate telephony resilience capabilities and quality benchmarks",
)
async def get_telephony_stats():
    return {
        "engine": "Dhvani Carrier Telephony Degradation Normalizer v1.1.0",
        "supported_codecs_count": len(CODEC_E_MODEL_PROFILES),
        "standards_compliance": {
            "itu_t_g107": "COMPLIANT (E-Model R-factor & MOS 1.0-4.5)",
            "itu_t_g711_appendix_1": "COMPLIANT (PLC Pitch-Repetition Disentanglement)",
            "gilbert_elliott_simulation": "ACTIVE (2-State Markov Burst Loss)",
            "trai_qos_guidelines": "COMPLIANT (VoLTE/2G/3G Packet Loss Thresholds)",
        },
        "plc_artifact_detection": "ACTIVE",
        "network_jitter_compensation": "ACTIVE",
    }
