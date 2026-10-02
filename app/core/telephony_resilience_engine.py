"""
Carrier Telephony Resilience Engine & Packet Loss Concealment (PLC) De-biasing for Dhvani.

Standards & Specifications:
1. ITU-T G.107 E-Model Computational Telephony QoS:
   Calculates Transmission Rating Factor R (0-100) and Mean Opinion Score (MOS 1.0-4.5)
   incorporating packet loss rate (Ppl), arrival jitter, and equipment impairment (Ie).
2. ITU-T G.711 Appendix I / G.729 / Opus Packet Loss Concealment (PLC) Disentanglement:
   Detects frame pitch-repetition extrapolation and decay envelopes typical of decoder
   loss-concealment algorithms, preventing false-positive synthetic speech alerts.
3. Gilbert-Elliott 2-State Markov Model Network Degradation Simulator:
   Simulates bursty packet losses (Good/Bad states) and jitter buffer underruns to benchmark
   acoustic model stability under adverse 2G/3G/4G/VoIP conditions.
4. Degradation-Aware Confidence Calibration & De-biasing:
   Calibrates acoustic synthetic probabilities when network packet loss or loss-concealment
   artifacts mimic synthetic speech periodicity.
"""

import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

logger = logging.getLogger("voice_integrity.telephony_resilience")

# ITU-T G.107 Codec Equipment Impairment (Ie) and Packet Loss Robustness (Bpl) parameters (with PLC)
CODEC_E_MODEL_PROFILES: Dict[str, Dict[str, float]] = {
    "g.711": {"ie": 0.0, "bpl": 25.1, "nominal_bitrate_kbps": 64.0},
    "g711": {"ie": 0.0, "bpl": 25.1, "nominal_bitrate_kbps": 64.0},
    "pcmu": {"ie": 0.0, "bpl": 25.1, "nominal_bitrate_kbps": 64.0},
    "pcma": {"ie": 0.0, "bpl": 25.1, "nominal_bitrate_kbps": 64.0},
    "g.729": {"ie": 11.0, "bpl": 19.0, "nominal_bitrate_kbps": 8.0},
    "g729": {"ie": 11.0, "bpl": 19.0, "nominal_bitrate_kbps": 8.0},
    "amr": {"ie": 10.0, "bpl": 16.0, "nominal_bitrate_kbps": 7.4},
    "amr-nb": {"ie": 10.0, "bpl": 16.0, "nominal_bitrate_kbps": 7.4},
    "amr-wb": {"ie": 5.0, "bpl": 20.0, "nominal_bitrate_kbps": 12.65},
    "g.722.2": {"ie": 5.0, "bpl": 20.0, "nominal_bitrate_kbps": 12.65},
    "opus": {"ie": 5.0, "bpl": 28.0, "nominal_bitrate_kbps": 16.0},
    "pcm": {"ie": 0.0, "bpl": 35.0, "nominal_bitrate_kbps": 128.0},
}


class TelephonyResilienceEngine:
    """
    Enterprise Telephony Degradation Normalizer, Packet Loss Concealment (PLC)
    Analyzer, and ITU-T G.107 E-Model Quality Estimator.
    """

    def __init__(self):
        self._default_codec = "g.711"

    def compute_e_model_qos(
        self,
        packet_loss_rate: float,
        jitter_ms: float = 0.0,
        codec: str = "G.711",
        one_way_delay_ms: float = 40.0,
        advantage_factor: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Computes ITU-T G.107 E-model transmission rating factor R and MOS.
        R = R0 - Is - Id - Ie_eff + A
        """
        codec_key = (codec or "g.711").strip().lower()
        profile = CODEC_E_MODEL_PROFILES.get(codec_key, CODEC_E_MODEL_PROFILES["g.711"])

        # 1. Base Signal-to-Noise Ratio Factor (R0)
        r0 = 93.2

        # 2. Simultaneous Impairment (Is) - voice quantization
        is_impairment = 1.4

        # 3. Total Effective Delay (including jitter buffer depth ~ 2 * jitter)
        effective_delay_ms = one_way_delay_ms + max(0.0, jitter_ms * 1.8)

        # Delay Impairment Factor (Id) per ITU-T G.107 Section 7
        if effective_delay_ms <= 177.3:
            id_impairment = 0.024 * effective_delay_ms
        else:
            id_impairment = 0.024 * effective_delay_ms + 0.11 * (effective_delay_ms - 177.3)

        # 4. Effective Equipment Impairment (Ie,eff)
        # Ie_eff = Ie + (95 - Ie) * (Ppl / (Ppl + Bpl))
        ie = profile["ie"]
        bpl = profile["bpl"]
        ppl_pct = min(100.0, max(0.0, packet_loss_rate * 100.0))
        ie_eff = ie + (95.0 - ie) * (ppl_pct / (ppl_pct + bpl + 1e-6))

        # 5. Transmission Rating Factor R
        r_factor = r0 - is_impairment - id_impairment - ie_eff + advantage_factor
        r_factor = max(0.0, min(100.0, r_factor))

        # 6. Mean Opinion Score (MOS) from R (ITU-T G.107 Eq. B-4)
        if r_factor <= 0.0:
            mos = 1.0
        elif r_factor >= 100.0:
            mos = 4.5
        else:
            mos = 1.0 + (0.035 * r_factor) + (7e-6 * r_factor * (r_factor - 60.0) * (100.0 - r_factor))
            mos = max(1.0, min(4.5, mos))

        # Category rating
        if r_factor >= 80.0:
            category = "EXCELLENT"
        elif r_factor >= 70.0:
            category = "GOOD_TELEPHONY"
        elif r_factor >= 60.0:
            category = "FAIR_CONGESTED"
        elif r_factor >= 50.0:
            category = "POOR_DEGRADED"
        else:
            category = "UNACCEPTABLE_PACKET_LOSS"

        return {
            "r_factor": round(r_factor, 2),
            "mos_score": round(mos, 2),
            "category": category,
            "codec": codec_key.upper(),
            "equipment_impairment_ie": round(ie_eff, 2),
            "delay_impairment_id": round(id_impairment, 2),
            "packet_loss_percent": round(ppl_pct, 2),
            "effective_delay_ms": round(effective_delay_ms, 2),
        }

    def detect_plc_artifacts(
        self,
        audio_samples: np.ndarray,
        sample_rate: int = 16000,
        frame_duration_ms: float = 20.0,
    ) -> Dict[str, Any]:
        """
        Detects Packet Loss Concealment (PLC) extrapolation signatures in audio.
        Identifies frame-to-frame pitch repetition with attenuation decay typical
        of ITU-T G.711 Appendix I / G.729 decoders.
        """
        if len(audio_samples) < int(sample_rate * 0.1):
            return {
                "plc_artifact_prob": 0.0,
                "plc_detected": False,
                "plc_frame_count": 0,
                "estimated_packet_loss_rate": 0.0,
                "burst_loss_detected": False,
                "disentanglement_verdict": "AUDIO_TOO_BRIEF",
            }

        frame_size = int(sample_rate * (frame_duration_ms / 1000.0))
        num_frames = len(audio_samples) // frame_size

        if num_frames < 3:
            return {
                "plc_artifact_prob": 0.0,
                "plc_detected": False,
                "plc_frame_count": 0,
                "estimated_packet_loss_rate": 0.0,
                "burst_loss_detected": False,
                "disentanglement_verdict": "INSUFFICIENT_FRAMES",
            }

        frames = [audio_samples[i * frame_size : (i + 1) * frame_size] for i in range(num_frames)]
        frame_energies = [float(np.sqrt(np.mean(f ** 2))) for f in frames]

        # Calculate cross-correlation and energy ratios between successive frames
        plc_flagged_frames = 0
        consecutive_drops = 0
        max_consecutive_drops = 0
        correlation_scores: List[float] = []

        for i in range(1, len(frames)):
            f_prev = frames[i - 1]
            f_curr = frames[i]
            e_prev = frame_energies[i - 1]
            e_curr = frame_energies[i]

            # Invoiced / active speech condition
            if e_prev > 0.01 and e_curr > 0.005:
                # Normalized correlation
                dot = float(np.dot(f_prev, f_curr))
                norm = float(np.linalg.norm(f_prev) * np.linalg.norm(f_curr))
                corr = (dot / (norm + 1e-8)) if norm > 0 else 0.0
                correlation_scores.append(corr)

                # Standard G.711 App I PLC signature:
                # 1. Very high correlation with preceding frame (> 0.82)
                # 2. Linear/exponential energy attenuation (0.50 <= e_curr / e_prev <= 0.95)
                energy_ratio = e_curr / (e_prev + 1e-6)
                if corr >= 0.82 and (0.45 <= energy_ratio <= 0.95):
                    plc_flagged_frames += 1
                    consecutive_drops += 1
                    max_consecutive_drops = max(max_consecutive_drops, consecutive_drops)
                else:
                    consecutive_drops = 0
            elif e_curr < 0.002 and e_prev > 0.02:
                # Abrupt zero-energy packet drop / frame loss
                consecutive_drops += 1
                max_consecutive_drops = max(max_consecutive_drops, consecutive_drops)
            else:
                consecutive_drops = 0

        total_active_comparisons = max(1, len(correlation_scores))
        plc_ratio = plc_flagged_frames / total_active_comparisons
        estimated_plr = min(0.35, plc_ratio * 1.25)
        plc_prob = float(np.clip(plc_ratio * 2.2, 0.0, 1.0))

        is_burst = max_consecutive_drops >= 2
        plc_detected = plc_prob >= 0.30 or (plc_flagged_frames >= 2 and is_burst)

        if plc_detected:
            verdict = "NETWORK_CONCEALMENT_ARTIFACT"
        elif np.mean(correlation_scores or [0.0]) > 0.90:
            verdict = "SYNTHETIC_PERIODICITY_SUSPECT"
        else:
            verdict = "NATURAL_ACOUSTIC_TRANSMISSION"

        return {
            "plc_artifact_prob": round(plc_prob, 3),
            "plc_detected": plc_detected,
            "plc_frame_count": plc_flagged_frames,
            "estimated_packet_loss_rate": round(estimated_plr, 3),
            "burst_loss_detected": is_burst,
            "max_consecutive_drops": max_consecutive_drops,
            "mean_frame_correlation": round(float(np.mean(correlation_scores or [0.0])), 3),
            "disentanglement_verdict": verdict,
        }

    def simulate_network_degradation(
        self,
        audio_samples: np.ndarray,
        sample_rate: int = 16000,
        target_loss_rate: float = 0.08,
        burst_length_avg: float = 2.0,
        jitter_ms: float = 30.0,
        apply_plc: bool = True,
    ) -> Dict[str, Any]:
        """
        Simulates realistic IP network degradation using a 2-State Gilbert-Elliott
        Markov Model (Good/Bad states) with optional G.711 Appendix I packet loss concealment.
        """
        frame_size = int(sample_rate * 0.020)  # 20ms standard RTP frame
        num_frames = len(audio_samples) // frame_size

        if num_frames == 0:
            return {
                "degraded_audio": audio_samples.copy(),
                "actual_loss_rate": 0.0,
                "dropped_frames": 0,
                "total_frames": 0,
                "qos": self.compute_e_model_qos(0.0),
            }

        # Gilbert-Elliott parameters:
        # P(Good -> Bad) = p, P(Bad -> Good) = q
        # Average burst length = 1 / q => q = 1 / burst_length_avg
        # Stationary loss rate PLR = p / (p + q) => p = (PLR * q) / (1 - PLR)
        target_plr = min(0.40, max(0.01, target_loss_rate))
        q_trans = 1.0 / max(1.1, burst_length_avg)
        p_trans = (target_plr * q_trans) / max(0.01, 1.0 - target_plr)

        state_is_bad = False
        dropped_indices: List[int] = []

        degraded = audio_samples.copy()
        last_good_frame = np.zeros(frame_size, dtype=np.float32)

        for i in range(num_frames):
            start = i * frame_size
            end = (i + 1) * frame_size

            # State transition
            if state_is_bad:
                if np.random.rand() < q_trans:
                    state_is_bad = False
            else:
                if np.random.rand() < p_trans:
                    state_is_bad = True

            if state_is_bad:
                dropped_indices.append(i)
                if apply_plc and i > 0 and len(last_good_frame) == frame_size:
                    # G.711 Appendix I style pitch extrapolation with 0.80 attenuation
                    attenuation = 0.80 ** (len(dropped_indices) % 4 + 1)
                    degraded[start:end] = last_good_frame * attenuation
                else:
                    # Hard silence frame drop
                    degraded[start:end] = 0.0
            else:
                last_good_frame = degraded[start:end].copy()

        # If stochastic walk yielded fewer drops than 75% of target, guarantee minimum drops
        min_drops = max(1, int(round(target_loss_rate * num_frames * 0.75))) if target_loss_rate > 0.0 else 0
        if len(dropped_indices) < min_drops and num_frames >= 2:
            needed = min_drops - len(dropped_indices)
            start_cand = max(1, num_frames // 4)
            for idx in range(start_cand, num_frames):
                if idx not in dropped_indices:
                    dropped_indices.append(idx)
                    f_s = idx * frame_size
                    f_e = (idx + 1) * frame_size
                    if apply_plc:
                        prev_s = (idx - 1) * frame_size
                        prev_e = idx * frame_size
                        prev_frame = degraded[prev_s:prev_e]
                        degraded[f_s:f_e] = prev_frame * 0.80
                    else:
                        degraded[f_s:f_e] = 0.0
                    needed -= 1
                    if needed <= 0:
                        break

        actual_loss_rate = len(dropped_indices) / num_frames
        qos = self.compute_e_model_qos(
            packet_loss_rate=actual_loss_rate,
            jitter_ms=jitter_ms,
            codec="G.711",
        )

        return {
            "degraded_audio": degraded,
            "actual_loss_rate": round(actual_loss_rate, 3),
            "dropped_frames": len(dropped_indices),
            "total_frames": num_frames,
            "target_loss_rate": target_loss_rate,
            "applied_plc": apply_plc,
            "qos": qos,
        }

    def restore_packet_loss(
        self,
        audio_samples: np.ndarray,
        sample_rate: int = 16000,
        frame_duration_ms: float = 20.0,
    ) -> Dict[str, Any]:
        """
        Compensates for packet loss and frame dropouts using pitch-synchronous
        linear predictive in-painting before acoustic feature extraction.
        """
        frame_size = int(sample_rate * (frame_duration_ms / 1000.0))
        num_frames = len(audio_samples) // frame_size

        if num_frames < 2:
            return {"restored_audio": audio_samples.copy(), "repaired_frames": 0}

        restored = audio_samples.copy()
        repaired_count = 0

        for i in range(1, num_frames - 1):
            curr_start = i * frame_size
            curr_end = (i + 1) * frame_size
            curr_frame = restored[curr_start:curr_end]

            curr_energy = np.sqrt(np.mean(curr_frame ** 2))
            prev_energy = np.sqrt(np.mean(restored[(i - 1) * frame_size : i * frame_size] ** 2))
            next_energy = np.sqrt(np.mean(restored[(i + 1) * frame_size : (i + 2) * frame_size] ** 2))

            # Detect dropped/corrupted zero-energy frame bounded by active speech
            if curr_energy < 0.001 and (prev_energy > 0.015 and next_energy > 0.015):
                # Linear interpolation between boundary frames
                prev_frame = restored[(i - 1) * frame_size : i * frame_size]
                next_frame = restored[(i + 1) * frame_size : (i + 2) * frame_size]
                in_painted = 0.5 * (prev_frame + next_frame)
                restored[curr_start:curr_end] = in_painted
                repaired_count += 1

        return {
            "restored_audio": restored,
            "repaired_frames": repaired_count,
            "restoration_applied": repaired_count > 0,
        }

    def calibrate_degradation_debiasing(
        self,
        acoustic_fake_prob: float,
        plc_artifact_prob: float,
        packet_loss_rate: float,
        mos_score: Optional[float] = None,
        codec: Optional[str] = None,
        snr_db: float = 20.0,
    ) -> Tuple[float, float, List[str]]:
        """
        Calibrates synthetic probability downward when network degradation or
        decoder PLC pitch repetition induces synthetic-like artifacts.
        Returns: (calibrated_fake_prob, applied_discount, explainability_reasons)
        """
        reasons: List[str] = []
        applied_discount = 0.0
        calibrated_prob = acoustic_fake_prob

        codec_clean = (codec or "").strip().lower()
        is_telephony_codec = codec_clean in CODEC_E_MODEL_PROFILES

        # 1. Base Telephony Codec + Low SNR (< 10 dB) Discount (Standard baseline)
        if is_telephony_codec and snr_db < 10.0:
            applied_discount = max(applied_discount, 0.35)
            reasons.append(
                f"Telephony codec ({codec_clean.upper() if codec_clean else 'TELEPHONY'}) with low SNR ({snr_db:.1f} dB) detected; "
                f"discounted synthetic confidence from {acoustic_fake_prob:.2f} to {acoustic_fake_prob * 0.65:.2f} to mitigate false positives."
            )

        # 2. Packet Loss Concealment (PLC) Pitch Repetition De-biasing
        if plc_artifact_prob >= 0.35 or packet_loss_rate >= 0.04:
            plc_discount = min(0.40, (plc_artifact_prob * 0.30) + (packet_loss_rate * 0.80))
            if plc_discount > applied_discount:
                applied_discount = plc_discount
                reasons.append(
                    f"Telephony Packet Loss Concealment (PLC: {plc_artifact_prob:.2f}, loss: {packet_loss_rate * 100:.1f}%) "
                    f"detected; adjusted synthetic score downward by {applied_discount * 100:.1f}% to disentangle transmission repetition from AI speech."
                )

        # 3. ITU-T G.107 Low MOS Impairment
        if mos_score is not None and mos_score < 3.2:
            mos_discount = min(0.30, (3.5 - mos_score) * 0.25)
            if mos_discount > applied_discount:
                applied_discount = mos_discount
                reasons.append(
                    f"Severe channel degradation (ITU-T G.107 MOS: {mos_score:.2f}) indicates transmission distortion; "
                    f"discounted synthetic confidence by {applied_discount * 100:.1f}%."
                )

        if applied_discount > 0.0:
            calibrated_prob = max(0.0, acoustic_fake_prob * (1.0 - applied_discount))

        return round(calibrated_prob, 4), round(applied_discount, 4), reasons


# Global singleton instance
telephony_resilience_engine = TelephonyResilienceEngine()
