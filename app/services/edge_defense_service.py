"""
Edge-Defense In-Browser & Virtual Microphone Micro-Detector Service for Dhvani.

Standards & Forensic Rationale:
In voice fraud attacks (KYC bypass, contact center spoofing), fraudsters rarely hold a
physical speaker to a physical microphone. Instead, they route synthesized audio directly
into the browser via virtual audio loopbacks or software drivers:
- VB-Audio Virtual Cable / Voicemeeter
- BlackHole / Soundflower / Loopback (macOS)
- PulseAudio / ALSA dummy loopbacks (Linux)
- OBS Virtual Audio / Screaming Bee / MorphVOX

Physical microphones exhibit:
1. Ambient Johnson-Nyquist thermal acoustic room noise (-65 dB to -45 dB) during silent intervals.
2. Microscopic analog-to-digital converter (ADC) clock drift (e.g. 15998 Hz or 44102 Hz).
3. Non-zero DC micro-drift.

Virtual audio cables exhibit:
1. Pure mathematical zeros during pauses (entropy = 0, amplitude = 0.000000).
2. Unnatural integer-perfect packet boundaries.
3. Characteristic device driver labels and hardware GUID patterns.
"""

import logging
import math
import re
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger("voice_integrity.edge_defense")

# Known virtual driver signatures and keywords
VIRTUAL_DRIVER_KEYWORDS = [
    "virtual",
    "cable",
    "blackhole",
    "loopback",
    "soundflower",
    "stereo mix",
    "obs-audio",
    "obs virtual",
    "vbaudio",
    "voicemeeter",
    "screaming bee",
    "morphvox",
    "clonemanager",
    "wavesurfer virtual",
    "line 1 (virtual",
    "line 2 (virtual",
    "aggregate device",
    "pulse monitor",
]


class EdgeDefenseService:
    """
    Evaluates client audio device metadata and acoustic physics to detect virtual cable interception.
    """

    def __init__(self):
        self.virtual_signatures = VIRTUAL_DRIVER_KEYWORDS

    def inspect_device_label(self, label: str) -> Dict[str, Any]:
        """
        Analyzes client microphone device label for known virtual audio driver signatures.
        """
        label_lower = label.lower().strip()
        matched_signatures: List[str] = []

        for sig in self.virtual_signatures:
            if sig in label_lower:
                matched_signatures.append(sig)

        is_virtual = len(matched_signatures) > 0
        risk_score = 0.95 if is_virtual else 0.05

        return {
            "is_virtual_driver": is_virtual,
            "matched_signatures": matched_signatures,
            "risk_score": risk_score,
            "device_label": label,
        }

    def analyze_ambient_noise_physics(
        self,
        audio_samples: np.ndarray,
        sample_rate: int = 16000,
    ) -> Dict[str, Any]:
        """
        Evaluates the ambient acoustic noise floor and zero-entropy digital pipe signatures.
        """
        if len(audio_samples) < 256:
            return {
                "noise_floor_db": -90.0,
                "perfect_digital_silence_ratio": 0.0,
                "has_thermal_room_noise": True,
                "verdict": "INSUFFICIENT_SAMPLE",
            }

        # Check for perfect mathematical zeros (0.0f)
        zero_samples = np.sum(audio_samples == 0.0)
        zero_ratio = float(zero_samples / len(audio_samples))

        # RMS in quietest 10% frames
        frame_size = int(sample_rate * 0.02)  # 20ms
        num_frames = len(audio_samples) // frame_size
        if num_frames < 2:
            rms_vals = [float(np.sqrt(np.mean(audio_samples ** 2) + 1e-12))]
        else:
            rms_vals = [
                float(np.sqrt(np.mean(audio_samples[i * frame_size : (i + 1) * frame_size] ** 2) + 1e-12))
                for i in range(num_frames)
            ]

        rms_vals.sort()
        quietest_rms = np.mean(rms_vals[: max(1, len(rms_vals) // 10)])
        noise_floor_db = float(20.0 * math.log10(max(1e-6, quietest_rms)))

        # Physical microphones almost never drop below -75 dB in real-world conditions
        # Digital virtual pipes often exhibit absolute silence (-90 dB to -120 dB) or high zero-sample ratios
        is_synthetic_silence = zero_ratio > 0.40 or noise_floor_db < -75.0

        return {
            "noise_floor_db": round(noise_floor_db, 2),
            "perfect_digital_silence_ratio": round(zero_ratio, 4),
            "has_thermal_room_noise": not is_synthetic_silence,
            "is_synthetic_silence": is_synthetic_silence,
            "verdict": "DIGITAL_PIPE_SUSPECT" if is_synthetic_silence else "ORGANIC_ROOM_AMBIENCE",
        }

    def verify_edge_device(
        self,
        device_label: str,
        audio_samples: Optional[np.ndarray] = None,
        sample_rate: int = 16000,
        sample_noise_floor_db: Optional[float] = None,
        zero_sample_ratio: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Synthesizes device label inspection and acoustic physics into a single trust certification.
        """
        label_res = self.inspect_device_label(device_label)

        if audio_samples is not None and len(audio_samples) > 0:
            physics_res = self.analyze_ambient_noise_physics(audio_samples, sample_rate)
        else:
            # Telemetry passed directly from client Web Audio API
            nf_db = sample_noise_floor_db if sample_noise_floor_db is not None else -52.0
            z_ratio = zero_sample_ratio if zero_sample_ratio is not None else 0.01
            is_synth = z_ratio > 0.35 or nf_db < -75.0
            physics_res = {
                "noise_floor_db": round(nf_db, 2),
                "perfect_digital_silence_ratio": round(z_ratio, 4),
                "has_thermal_room_noise": not is_synth,
                "is_synthetic_silence": is_synth,
                "verdict": "DIGITAL_PIPE_SUSPECT" if is_synth else "ORGANIC_ROOM_AMBIENCE",
            }

        # Composite trust scoring
        is_virtual = label_res["is_virtual_driver"]
        has_thermal = physics_res["has_thermal_room_noise"]

        if is_virtual and not has_thermal:
            trust_score = 0.05
            verdict = "VIRTUAL_CABLE_SPOOF_CONFIRMED"
            level = "CRITICAL"
        elif is_virtual:
            trust_score = 0.20
            verdict = "VIRTUAL_AUDIO_DRIVER_DETECTED"
            level = "HIGH"
        elif not has_thermal:
            trust_score = 0.50
            verdict = "UNNATURAL_ZERO_NOISE_FLOOR"
            level = "ELEVATED"
        else:
            trust_score = 0.98
            verdict = "HARDWARE_PHYSICAL_MIC_VERIFIED"
            level = "AUTHENTIC"

        return {
            "status": "EVALUATED",
            "verdict": verdict,
            "threat_level": level,
            "hardware_trust_score": round(trust_score, 2),
            "device_inspection": label_res,
            "acoustic_physics": physics_res,
            "countermeasures_recommended": (
                ["REJECT_TRANSACTION", "REQUEST_HARDWARE_MIC", "FORCE_PUSH_NOTIFICATION"]
                if level in ["CRITICAL", "HIGH"]
                else ["PROCEED_NORMAL"]
            ),
        }


# Global Singleton
edge_defense_service = EdgeDefenseService()
