"""
Acoustic Loudspeaker Replay & Transducer Presentation Attack Detection Engine for Dhvani.

Scientific Forensic Basis:
1. Physical Transducer Non-Linearity (Total Harmonic Distortion - THD):
   When an attacker plays synthetic voice clones through a loudspeaker (phone, laptop, external monitor)
   into a telephone microphone, micro-speaker voice coils introduce non-linear harmonic distortion,
   spectral coloration, and low-frequency resonance (200 Hz to 450 Hz) absent from natural human glottal pulses.
2. Double Room Impulse Response (RIR) & Schroeder Energy Decay:
   Genuine near-field telephone speech has 1 direct acoustic channel.
   Acoustic replay introduces double convolution (the original synthesis room profile convolved with
   the physical playback environment), leading to secondary reverberant tail prolongation.
3. Direct-to-Reverberant Ratio (DRR):
   Natural human speech held 2-5 cm from a mobile microphone exhibits a high DRR (> 12 dB).
   Replayed audio from an external speaker across a desk exhibits elevated diffuse acoustic energy (DRR < 6 dB).
"""

import logging
import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np

logger = logging.getLogger("voice_integrity.replay_defense")


class ReplayDefenseService:
    """
    Forensic Replay & Loudspeaker Transducer Detection Engine.
    """

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate

    def analyze_acoustic_replay(
        self,
        audio_samples: Union[np.ndarray, List[float]],
        sample_rate: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Extracts physical transducer resonance, DRR, and reverberation decay to detect replay attacks.
        """
        sr = sample_rate or self.sample_rate
        audio = np.asarray(audio_samples, dtype=np.float32).flatten()

        if len(audio) < sr * 0.5:
            # Under 500ms, fallback to neutral
            return {
                "replay_detected": False,
                "replay_probability": 0.05,
                "confidence": 0.50,
                "channel_type": "INSUFFICIENT_AUDIO_DURATION",
                "drr_db": 15.0,
                "thd_percentage": 0.8,
                "t60_decay_ms": 120.0,
                "notes": ["Sample duration under 500ms, acoustic reverberation analysis deferred."],
            }

        # Normalize audio amplitude
        peak = float(np.max(np.abs(audio)))
        if peak > 1e-5:
            audio = audio / peak

        # 1. Estimate Direct-to-Reverberant Ratio (DRR) via Short-Time Autocorrelation
        drr_db = self._estimate_drr(audio, sr)

        # 2. Estimate Transducer Total Harmonic Distortion (THD)
        thd_pct, resonance_score = self._estimate_transducer_thd(audio, sr)

        # 3. Estimate Reverberation Decay Time (RT60 approximation via Schroeder backward integration)
        t60_ms = self._estimate_rt60_decay(audio, sr)

        # 4. Composite Replay Scoring
        # Low DRR (< 7 dB), elevated THD (> 4.5%), and elongated RT60 (> 280ms) indicate physical replay
        # 4. Composite Replay Scoring
        # Low DRR (< 16 dB), elevated high-order odd THD (> 3.0%), and elongated RT60 (> 250ms)
        drr_risk = max(0.0, min(1.0, (18.0 - drr_db) / 10.0))
        thd_risk = max(0.0, min(1.0, (thd_pct - 1.5) / 4.0))
        t60_risk = max(0.0, min(1.0, (t60_ms - 160.0) / 200.0))

        composite_replay_prob = float(
            0.40 * drr_risk + 0.40 * thd_risk + 0.20 * t60_risk
        )
        composite_replay_prob = max(0.02, min(0.98, composite_replay_prob))

        is_replay = composite_replay_prob >= 0.50

        if is_replay:
            channel_type = "LOUDSPEAKER_ACOUSTIC_REPLAY"
            explanation = (
                f"Acoustic replay detected: Elevated diffuse energy (DRR {drr_db:.1f} dB), "
                f"transducer voice coil distortion (THD {thd_pct:.1f}%), and secondary reverberation decay ({t60_ms:.0f} ms)."
            )
        elif drr_db > 14.0 and thd_pct < 2.5:
            channel_type = "NEAR_FIELD_NATURAL_MOUTH"
            explanation = (
                f"Authentic near-field vocal transmission: Strong direct path (DRR {drr_db:.1f} dB), "
                f"low harmonic coloration (THD {thd_pct:.1f}%), and expected room decay ({t60_ms:.0f} ms)."
            )
        else:
            channel_type = "MODERATE_REVERBERATION_PSTN"
            explanation = (
                f"Channel characteristics consistent with standard telephony acoustics "
                f"(DRR {drr_db:.1f} dB, THD {thd_pct:.1f}%)."
            )

        notes = [explanation]
        if thd_pct > 5.0:
            notes.append("Severe transducer voice coil saturation detected (characteristic of small mobile phone speaker).")
        if t60_ms > 300.0:
            notes.append("Secondary acoustic reverberation convolved over original speech.")

        return {
            "replay_detected": is_replay,
            "replay_probability": round(composite_replay_prob, 4),
            "confidence": round(float(np.clip(abs(composite_replay_prob - 0.50) * 2.0, 0.50, 0.99)), 3),
            "channel_type": channel_type,
            "drr_db": round(drr_db, 1),
            "thd_percentage": round(thd_pct, 2),
            "t60_decay_ms": round(t60_ms, 1),
            "transducer_resonance_score": round(resonance_score, 3),
            "notes": notes,
        }

    def _estimate_drr(self, audio: np.ndarray, sr: int) -> float:
        """
        Estimates Direct-to-Reverberant Ratio (DRR) in dB using short-time energy contrast.
        """
        frame_len = int(sr * 0.020)
        num_frames = len(audio) // frame_len
        if num_frames < 5:
            return 14.0

        frames = audio[:num_frames * frame_len].reshape(num_frames, frame_len)
        e = np.sum(frames ** 2, axis=1) + 1e-12
        p95 = float(np.percentile(e, 95))
        p05 = float(np.percentile(e, 5))
        drr = 10.0 * math.log10(p95 / (p05 + 1e-12))
        return float(np.clip(drr, -5.0, 35.0))

    def _estimate_transducer_thd(self, audio: np.ndarray, sr: int) -> Tuple[float, float]:
        """
        Estimates high-order odd harmonic distortion (THD %) and chassis resonance.
        Loudspeaker voice coils exhibit odd-harmonic saturation (5th, 7th, 9th) and 250-450 Hz resonance.
        """
        fft_len = min(4096, len(audio))
        window = np.hanning(fft_len)
        segment = audio[:fft_len] * window
        spectrum = np.abs(np.fft.rfft(segment))
        freqs = np.fft.rfftfreq(fft_len, 1.0 / sr)

        pitch_mask = (freqs >= 80) & (freqs <= 350)
        if not np.any(pitch_mask):
            return 1.2, 0.1

        pitch_freq = freqs[pitch_mask][np.argmax(spectrum[pitch_mask])]
        fundamental_power = float(np.max(spectrum[pitch_mask])) ** 2 + 1e-9

        # Measure high-order odd harmonics (h = 5, 7, 9) characteristic of transducer voice-coil saturation
        high_odd_powers = []
        for h in (5, 7, 9):
            target_f = pitch_freq * h
            if target_f < sr / 2:
                h_mask = (freqs >= target_f - 25) & (freqs <= target_f + 25)
                if np.any(h_mask):
                    high_odd_powers.append(float(np.max(spectrum[h_mask])) ** 2)
                else:
                    high_odd_powers.append(0.0)

        sum_odd = sum(high_odd_powers)
        thd = math.sqrt(sum_odd / fundamental_power) * 100.0

        # Measure chassis resonance in 250-450 Hz transducer range
        res_mask = (freqs >= 250) & (freqs <= 450)
        avg_overall = float(np.mean(spectrum)) + 1e-9
        avg_res = float(np.mean(spectrum[res_mask])) if np.any(res_mask) else avg_overall
        resonance_ratio = avg_res / avg_overall

        return float(np.clip(thd, 0.1, 25.0)), float(np.clip(resonance_ratio, 0.0, 5.0))

    def _estimate_rt60_decay(self, audio: np.ndarray, sr: int) -> float:
        """
        Estimates RT60 reverberation decay time (milliseconds) using energy decay curve.
        """
        frame_len = int(sr * 0.010)
        num_frames = len(audio) // frame_len
        if num_frames < 10:
            return 150.0

        frames = audio[: num_frames * frame_len].reshape(num_frames, frame_len)
        frame_energies = np.sum(frames ** 2, axis=1) + 1e-12

        peak_e = float(np.max(frame_energies))
        med_e = float(np.median(frame_energies))
        pause_ratio = med_e / (peak_e + 1e-9)

        # Schroeder reverse integration
        schroeder_curve = np.flip(np.cumsum(np.flip(frame_energies)))
        schroeder_db = 10.0 * np.log10(schroeder_curve / schroeder_curve[0] + 1e-12)

        t_5 = None
        t_25 = None
        times_ms = np.arange(len(schroeder_db)) * 10.0

        for t, db in zip(times_ms, schroeder_db):
            if db <= -5.0 and t_5 is None:
                t_5 = t
            if db <= -25.0 and t_25 is None:
                t_25 = t
                break

        if t_5 is not None and t_25 is not None and t_25 > t_5:
            t20 = t_25 - t_5
            rt60 = t20 * 3.0
        else:
            rt60 = 150.0

        if pause_ratio < 0.005:
            rt60 = min(rt60, 140.0)

        return float(np.clip(rt60, 50.0, 900.0))


# Global singleton instance
replay_defense_service = ReplayDefenseService()
