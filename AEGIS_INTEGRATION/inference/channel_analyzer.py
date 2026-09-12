"""
Channel Domain Analyzer for AEGIS.

Analyzes acoustic channel properties to identify telephony, narrow-band,
or lossy codec constraints that induce false positives in sinc-convolution
and spectro-temporal graph anti-spoofing models (e.g. AASIST-L).

Provides continuous channel reliability estimation based on multi-indicator
corroboration. Never relies on a single feature as a hard classifier.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import librosa
from scipy.signal import welch
import soundfile as sf


class ChannelAnalyzer:
    """
    Evaluates acoustic channel fidelity using lightweight spectral features.
    
    Primary acoustic indicators:
      1. Upper-band power ratio above 6.8 kHz (Welch PSD)
      2. 95% spectral energy rolloff frequency
      3. Spectral bandwidth
      
    Soft secondary indicators:
      4. Native sample rate / container metadata
    """

    TARGET_SR = 16000
    UPPER_BAND_CUTOFF = 6800.0  # Hz

    def __init__(self, target_sr: int = 16000):
        self.target_sr = target_sr

    def analyze(
        self,
        audio_input: Union[str, Path, np.ndarray],
        sr: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Analyze audio input for telephony/channel constraint.

        Args:
            audio_input: Path to audio file or raw 1D numpy array.
            sr: Sample rate if audio_input is a numpy array.

        Returns:
            Dict containing:
              - channel_status: "HIGH_FIDELITY" | "CHANNEL_CONSTRAINED" | "TELEPHONY"
              - channel_reliability: float in [0.25, 1.0]
              - indicators: dict of raw feature values
              - active_indicators: list of indicators exceeding thresholds
              - reason: explainable justification
        """
        native_sr: Optional[int] = None
        y: np.ndarray

        if isinstance(audio_input, (str, Path)):
            audio_path = Path(audio_input)
            try:
                info = sf.info(str(audio_path))
                native_sr = info.samplerate
            except Exception:
                native_sr = None

            y, file_sr = librosa.load(str(audio_path), sr=self.target_sr, mono=True)
        elif isinstance(audio_input, np.ndarray):
            y = audio_input.astype(np.float32)
            if y.ndim > 1:
                y = np.mean(y, axis=0)
            if sr is not None and sr != self.target_sr:
                y = librosa.resample(y, orig_sr=sr, target_sr=self.target_sr)
            native_sr = sr
        else:
            raise ValueError(f"Unsupported audio input type: {type(audio_input)}")

        if len(y) == 0:
            return {
                "channel_status": "UNKNOWN",
                "channel_reliability": 0.50,
                "indicators": {
                    "upper_band_power_ratio": 0.0,
                    "spectral_rolloff_95": 0.0,
                    "spectral_bandwidth": 0.0,
                    "native_sample_rate": native_sr,
                },
                "active_indicators": [],
                "reason": "Empty audio buffer",
            }

        # Ensure non-trivial amplitude
        rms = float(np.sqrt(np.mean(y ** 2)))
        if rms < 1e-6:
            return {
                "channel_status": "SILENCE",
                "channel_reliability": 0.50,
                "indicators": {
                    "upper_band_power_ratio": 0.0,
                    "spectral_rolloff_95": 0.0,
                    "spectral_bandwidth": 0.0,
                    "native_sample_rate": native_sr,
                },
                "active_indicators": [],
                "reason": "Silent audio signal",
            }

        # -------------------------------------------------------------
        # 1. Feature Extraction
        # -------------------------------------------------------------
        nperseg = min(1024, len(y))
        freqs, psd = welch(y, fs=self.target_sr, nperseg=nperseg)
        total_power = float(np.sum(psd))

        if total_power > 1e-12:
            upper_band_power = float(np.sum(psd[freqs >= self.UPPER_BAND_CUTOFF]))
            upper_band_ratio = upper_band_power / total_power
        else:
            upper_band_ratio = 0.0

        rolloff_frames = librosa.feature.spectral_rolloff(
            y=y, sr=self.target_sr, roll_percent=0.95
        )
        rolloff_95 = float(np.mean(rolloff_frames))

        bandwidth_frames = librosa.feature.spectral_bandwidth(
            y=y, sr=self.target_sr
        )
        bandwidth = float(np.mean(bandwidth_frames))

        # -------------------------------------------------------------
        # 2. Indicator Scoring (continuous constraint degree [0, 1])
        # -------------------------------------------------------------
        active_indicators: List[str] = []

        # Indicator 1: Upper-band power ratio above 6.8 kHz
        # Telephony codecs have near-zero energy above 6.8 kHz (< 0.00005)
        # Studio/AI speech typically has >= 0.00025 (0.025%) to several percent.
        if upper_band_ratio <= 0.00005:
            deg_upper_band = 1.0
            active_indicators.append(
                f"upper_band_deficiency ({upper_band_ratio * 100:.4f}% < 0.005%)"
            )
        elif upper_band_ratio < 0.00025:
            deg_upper_band = (0.00025 - upper_band_ratio) / 0.00020
            if deg_upper_band >= 0.20:
                active_indicators.append(
                    f"upper_band_attenuation ({upper_band_ratio * 100:.4f}% < 0.025%)"
                )
        else:
            deg_upper_band = 0.0

        # Indicator 2: 95% spectral energy rolloff
        # Telephony rolls off <= 4300 Hz. AI speech typically >= 5000 Hz.
        if rolloff_95 <= 3400.0:
            deg_rolloff = 1.0
            active_indicators.append(
                f"brickwall_rolloff ({rolloff_95:.0f}Hz <= 3400Hz)"
            )
        elif rolloff_95 < 4800.0:
            deg_rolloff = (4800.0 - rolloff_95) / 1400.0
            if deg_rolloff >= 0.20:
                active_indicators.append(
                    f"truncated_rolloff ({rolloff_95:.0f}Hz < 4800Hz)"
                )
        else:
            deg_rolloff = 0.0

        # Indicator 3: Spectral bandwidth
        # Telephony bandwidth is compressed (<= 1360 Hz). AI speech > 1500 Hz.
        if bandwidth <= 1000.0:
            deg_bandwidth = 1.0
            active_indicators.append(
                f"narrow_bandwidth ({bandwidth:.0f}Hz <= 1000Hz)"
            )
        elif bandwidth < 1450.0:
            deg_bandwidth = (1450.0 - bandwidth) / 450.0
            if deg_bandwidth >= 0.20:
                active_indicators.append(
                    f"constrained_bandwidth ({bandwidth:.0f}Hz < 1450Hz)"
                )
        else:
            deg_bandwidth = 0.0

        # Indicator 4: Native container sample rate (soft indicator only)
        deg_native_sr = 0.0
        if native_sr is not None and native_sr <= 8000:
            deg_native_sr = 0.50
            active_indicators.append(f"narrowband_container ({native_sr}Hz)")

        # -------------------------------------------------------------
        # 3. Multi-Indicator Corroboration & Reliability Computation
        # -------------------------------------------------------------
        # Multi-indicator rule: Requires >= 2 acoustic indicators for strong constraint penalty
        acoustic_degrees = [deg_upper_band, deg_rolloff, deg_bandwidth]
        active_acoustic_count = sum(1 for d in acoustic_degrees if d >= 0.20)

        if active_acoustic_count >= 2:
            sorted_degs = sorted(acoustic_degrees, reverse=True)
            # Weighted combination of two strongest indicators + soft container boost
            corroborated_constraint = (
                0.60 * sorted_degs[0] + 0.40 * sorted_degs[1]
            )
            if deg_native_sr > 0.0:
                corroborated_constraint = min(1.0, corroborated_constraint + 0.15)

            channel_constraint = float(np.clip(corroborated_constraint, 0.0, 1.0))
            # Reliability drops proportionally; floor at 0.25
            channel_reliability = float(np.clip(1.0 - 0.75 * channel_constraint, 0.25, 1.0))

            if channel_constraint >= 0.70:
                status = "TELEPHONY"
                reason = (
                    f"Acoustic channel matches narrow/wideband telephony profile "
                    f"({len(active_indicators)} indicators corroborated). "
                    f"AASIST confidence reduced to account for lossy codec cutoff."
                )
            else:
                status = "CHANNEL_CONSTRAINED"
                reason = (
                    f"Acoustic channel shows moderate bandwidth constraint "
                    f"({len(active_indicators)} indicators active). "
                    f"AASIST confidence moderately adjusted."
                )

        elif active_acoustic_count == 1:
            # Single indicator alone never triggers full telephony classification
            strongest = max(acoustic_degrees)
            channel_constraint = float(0.20 * strongest)
            channel_reliability = float(np.clip(1.0 - 0.75 * channel_constraint, 0.85, 1.0))
            status = "HIGH_FIDELITY"
            reason = (
                f"Isolated acoustic anomaly ({active_indicators[0]}); "
                f"insufficient corroboration for channel constraint."
            )
        else:
            channel_constraint = 0.0
            channel_reliability = 1.0
            status = "HIGH_FIDELITY"
            reason = "Full-bandwidth acoustic signal with high spectral fidelity."

        return {
            "channel_status": status,
            "channel_reliability": round(channel_reliability, 4),
            "indicators": {
                "upper_band_power_ratio": round(upper_band_ratio, 6),
                "spectral_rolloff_95": round(rolloff_95, 1),
                "spectral_bandwidth": round(bandwidth, 1),
                "native_sample_rate": native_sr,
            },
            "active_indicators": active_indicators,
            "reason": reason,
        }
