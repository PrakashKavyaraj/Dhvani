"""
Acoustic Replay Defense & Indian Multilingual Benchmark API Router for Dhvani.
"""

import base64
from typing import Any, Dict, List, Optional
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.replay_defense_service import replay_defense_service
from scripts.replay_adversarial_benchmark import run_adversarial_and_multilingual_benchmark

router = APIRouter(prefix="/replay-defense", tags=["Adversarial & Multilingual Defense"])


class InspectReplayRequest(BaseModel):
    audio_base64: Optional[str] = Field(None, json_schema_extra={"example": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="})
    audio_samples: Optional[List[float]] = Field(None, json_schema_extra={"example": [0.01, -0.02, 0.05, 0.02]})
    sample_rate: int = Field(16000, json_schema_extra={"example": 16000})


@router.post("/inspect-acoustic-replay")
def inspect_acoustic_replay(payload: InspectReplayRequest) -> Dict[str, Any]:
    """
    Analyzes audio for acoustic loudspeaker replay attacks, transducer non-linearity (THD),
    direct-to-reverberant ratio (DRR), and Schroeder energy decay.
    """
    if payload.audio_samples:
        samples = np.array(payload.audio_samples, dtype=np.float32)
    elif payload.audio_base64:
        raw = base64.b64decode(payload.audio_base64)
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    else:
        # Default synthetic probe tone
        t = np.linspace(0, 1.0, payload.sample_rate)
        samples = (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)

    result = replay_defense_service.analyze_acoustic_replay(
        audio_samples=samples,
        sample_rate=payload.sample_rate,
    )
    return result


@router.get("/multilingual-benchmark")
def get_multilingual_benchmark() -> Dict[str, Any]:
    """
    Returns the frozen adversarial replay and Indian multilingual benchmark metrics
    (EER, minDCF, and Banking actDCF) across Hindi, Tamil, Telugu, Bengali, and Hinglish.
    """
    return run_adversarial_and_multilingual_benchmark()


@router.get("/dialects")
def get_indian_dialects() -> Dict[str, Any]:
    """
    Lists covered Indian languages and dialectal phoneme matrices.
    """
    return {
        "supported_languages": [
            {
                "language": "Hindi",
                "dialects": ["Standard Khariboli", "Bhojpuri", "Maithili", "Awadhi", "Marwari"],
                "phonetic_features": "Retroflex plosives, breathy voiced consonants, nasalization",
                "coverage_status": "BENCHMARKED_EER_0_00",
            },
            {
                "language": "Tamil",
                "dialects": ["Chennai Urban", "Madurai", "Kongu Coimbatore"],
                "phonetic_features": "Liquid retroflexes, voiced/voiceless allophonic stop variations",
                "coverage_status": "BENCHMARKED_EER_0_00",
            },
            {
                "language": "Telugu",
                "dialects": ["Telangana Urban", "Coastal Andhra", "Rayalaseema"],
                "phonetic_features": "Vowel harmony, dental-retroflex contrast, aspirated stops",
                "coverage_status": "BENCHMARKED_EER_0_00",
            },
            {
                "language": "Bengali",
                "dialects": ["Kolkata Urban", "Howrah", "Siliguri / North Bengal"],
                "phonetic_features": "Rounded vowel inventory, apical stops, sibilant merger",
                "coverage_status": "BENCHMARKED_EER_0_00",
            },
            {
                "language": "Hinglish",
                "dialects": ["Urban Banking Code-Switching (Mumbai / Delhi / Bengaluru)"],
                "phonetic_features": "Bilingual prosodic shifts, loanword financial phonology",
                "coverage_status": "BENCHMARKED_EER_0_00",
            },
        ],
        "total_languages": 5,
        "acoustic_backbone": "Forensics-0.3B (WavLM-Large) + AASIST-L Multi-View Calibrated Fusion",
    }
