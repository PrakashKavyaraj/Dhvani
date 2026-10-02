"""
Production-grade Acoustic Prosody & Pitch Contour Analysis Engine.

Extracts fundamental frequency (F0) using the gold-standard YIN algorithm
(De Cheveigné & Kawahara, 2002) and evaluates multi-dimensional phonetic prosody
metrics to detect synthetic voice artifacts, unnatural pitch flatness, and cadence anomalies.
"""

import math
from typing import Any, Dict, Tuple
import numpy as np
from app.core.logging import logger
from app.models.domain import PreparedAudio


def extract_f0_yin(
    samples: np.ndarray,
    sr: int,
    frame_len: int = 480,
    hop_len: int = 160,
    fmin: float = 50.0,
    fmax: float = 500.0,
    threshold: float = 0.15,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Gold-standard YIN Fundamental Frequency (F0) Estimator.
    Computes frame-wise fundamental frequency with sub-sample parabolic interpolation
    and cumulative mean normalized difference function (CMNDF) dip thresholding.
    """
    if len(samples) < frame_len:
        return np.array([], dtype=np.float32), np.array([], dtype=bool)

    tau_min = max(2, int(sr / fmax))
    tau_max = min(frame_len - 1, int(sr / fmin))
    ref_len = frame_len - tau_max

    num_frames = (len(samples) - frame_len) // hop_len + 1
    indices = np.arange(frame_len)[None, :] + np.arange(num_frames)[:, None] * hop_len
    frames = samples[indices]

    f0_list = []
    voiced_list = []

    for frame in frames:
        ref = frame[:ref_len]
        diffs = np.zeros(tau_max + 1, dtype=np.float32)
        for tau in range(1, tau_max + 1):
            comp = frame[tau : tau + ref_len]
            diffs[tau] = np.sum((ref - comp) ** 2)

        # Cumulative mean normalized difference
        cmndf = np.ones(tau_max + 1, dtype=np.float32)
        cum_sum = 0.0
        for tau in range(1, tau_max + 1):
            cum_sum += diffs[tau]
            cmndf[tau] = diffs[tau] / (cum_sum / tau) if cum_sum > 0 else 1.0

        # Absolute thresholding: select first minimum below threshold
        tau_chosen = None
        for tau in range(tau_min, tau_max):
            if cmndf[tau] < threshold:
                while tau + 1 <= tau_max and cmndf[tau + 1] < cmndf[tau]:
                    tau += 1
                tau_chosen = tau
                break

        if tau_chosen is None:
            # Fallback to global minimum in search band
            tau_chosen = tau_min + int(np.argmin(cmndf[tau_min : tau_max + 1]))
            is_voiced = bool(cmndf[tau_chosen] < 0.35)
        else:
            is_voiced = True

        # Parabolic interpolation for sub-sample accuracy
        if 0 < tau_chosen < tau_max:
            alpha = float(cmndf[tau_chosen - 1])
            beta = float(cmndf[tau_chosen])
            gamma = float(cmndf[tau_chosen + 1])
            denom = 2.0 * (alpha - 2.0 * beta + gamma)
            delta = (alpha - gamma) / denom if abs(denom) > 1e-6 else 0.0
            tau_refined = float(tau_chosen) + delta
        else:
            tau_refined = float(tau_chosen)

        f0 = sr / tau_refined if tau_refined > 0 else 0.0
        if not is_voiced or f0 < fmin or f0 > fmax:
            f0 = 0.0
            is_voiced = False

        f0_list.append(f0)
        voiced_list.append(is_voiced)

    return np.array(f0_list, dtype=np.float32), np.array(voiced_list, dtype=bool)


def analyze_prosody_features(
    samples: np.ndarray,
    sr: int = 16000,
    hop_len: int = 160,
) -> Tuple[str, float, Dict[str, Any]]:
    """
    Evaluates acoustic prosody features against physiological human speech bounds.

    Returns:
        anomaly_level (str): "natural", "low", "moderate", or "high"
        anomaly_score (float): Composite anomaly index [0.0 - 100.0]
        telemetry (dict): Detailed phonetic metrics
    """
    f0s, voiced = extract_f0_yin(samples, sr=sr, hop_len=hop_len)
    voiced_f0 = f0s[voiced]

    # Boundary check: minimum voiced frames needed for statistical significance
    if len(voiced_f0) < 15:
        return (
            "low",
            10.0,
            {
                "reason": "Insufficient voiced speech detected for deep prosodic modeling",
                "voiced_frames": int(len(voiced_f0)),
            },
        )

    dt = hop_len / float(sr)

    # 1. Pitch Dynamics on Semitone Scale (ST = 12 * log2(F0 / 440) + 69)
    st = 12.0 * np.log2(np.maximum(1e-3, voiced_f0) / 440.0) + 69.0
    st_std = float(np.std(st))
    st_range = float(np.ptp(st))
    mean_f0 = float(np.mean(voiced_f0))

    # 2. Pitch Velocity & Discontinuity Rate on Continuous Voiced Chunks
    voiced_indices = np.where(voiced)[0]
    is_consecutive = (voiced_indices[1:] - voiced_indices[:-1]) == 1

    jump_ratio = 0.0
    jitter = 0.0
    if len(is_consecutive) > 0 and np.any(is_consecutive):
        consec_f0_diff = np.abs(voiced_f0[1:][is_consecutive] - voiced_f0[:-1][is_consecutive])
        consec_st_diff = np.abs(st[1:][is_consecutive] - st[:-1][is_consecutive])
        velocities = consec_st_diff / dt

        # Physiological vocal tract limit: natural speech rarely exceeds 100 semitones/sec
        jumps = np.sum(velocities > 100.0)
        total_consec = len(velocities)
        jump_ratio = float(jumps / total_consec) if total_consec > 0 else 0.0

        # Local cycle-to-cycle relative perturbation (Jitter)
        if mean_f0 > 0:
            jitter = float(np.mean(consec_f0_diff) / mean_f0)

    # 3. Voiced Segment Duration Dynamics (nPVI Rhythm / Cadence)
    voiced_runs = []
    current_run = 0
    for v in voiced:
        if v:
            current_run += 1
        else:
            if current_run > 0:
                voiced_runs.append(current_run * dt)
                current_run = 0
    if current_run > 0:
        voiced_runs.append(current_run * dt)

    runs = np.array(voiced_runs)
    if len(runs) >= 2:
        diffs = np.abs(runs[1:] - runs[:-1])
        means = (runs[1:] + runs[:-1]) / 2.0
        # Protect against div by zero
        means = np.maximum(1e-4, means)
        npvi = float(100.0 * np.mean(diffs / means))
    else:
        npvi = 50.0  # Neutral baseline

    # 4. Composite Phonetic Anomaly Scoring
    anomaly_points = 0.0

    # (a) Unnatural Monotone Flatness (typical human is 2.0 - 5.0 semitones)
    if st_std < 1.4:
        # Penalize robotic pitch flatness
        flatness_penalty = 35.0 * ((1.4 - st_std) / 1.4)
        anomaly_points += flatness_penalty
    elif st_std > 5.5:
        # Penalize hyper-erratic pitch instability
        anomaly_points += 20.0 * min(1.0, (st_std - 5.5) / 3.0)

    # (b) Unnatural Vocoder Pitch Discontinuities / Glitches
    if jump_ratio > 0.04:
        anomaly_points += 35.0 * min(1.0, (jump_ratio - 0.04) / 0.15)

    # (c) Jitter Anomalies: Overly-smooth neural vocoding vs phase jitter
    if jitter < 0.003:
        # Over-smoothed artificial vocoder
        anomaly_points += 20.0 * ((0.003 - jitter) / 0.003)
    elif jitter > 0.035:
        # Noisy or corrupted vocoder artifacts
        anomaly_points += 20.0 * min(1.0, (jitter - 0.035) / 0.035)

    # (d) Cadence / Rhythm Metronomic Regularity
    if npvi < 25.0:
        anomaly_points += 15.0 * ((25.0 - npvi) / 25.0)

    anomaly_score = float(min(100.0, max(0.0, anomaly_points)))

    # Classification Tier
    if anomaly_score < 25.0:
        anomaly_level = "natural"
    elif anomaly_score < 50.0:
        anomaly_level = "low"
    elif anomaly_score < 75.0:
        anomaly_level = "moderate"
    else:
        anomaly_level = "high"

    telemetry = {
        "mean_f0_hz": round(mean_f0, 1),
        "f0_std_semitones": round(st_std, 2),
        "f0_range_semitones": round(st_range, 2),
        "pitch_jump_ratio": round(jump_ratio, 4),
        "jitter_rap": round(jitter, 4),
        "cadence_npvi": round(npvi, 1),
        "anomaly_score": round(anomaly_score, 1),
        "voiced_frames_ratio": round(float(np.mean(voiced)), 3),
    }

    return anomaly_level, anomaly_score, telemetry


def evaluate_prepared_audio_prosody(prepared_audio: PreparedAudio) -> Tuple[str, Dict[str, Any]]:
    """
    Entrypoint to evaluate prosody directly from a PreparedAudio container.
    """
    if not prepared_audio.raw_data or len(prepared_audio.raw_data) == 0:
        return "low", {}

    # Unpack PCM bytes to normalized float32
    if prepared_audio.sample_width == 2:
        samples = np.frombuffer(prepared_audio.raw_data, dtype=np.int16).astype(np.float32) / 32768.0
    elif prepared_audio.sample_width == 1:
        samples = (np.frombuffer(prepared_audio.raw_data, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        return "low", {}

    # Downmix stereo to mono
    if prepared_audio.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)

    # Resample to 16000 Hz if necessary
    target_sr = 16000
    if prepared_audio.sample_rate != target_sr and prepared_audio.sample_rate > 0:
        duration = len(samples) / float(prepared_audio.sample_rate)
        target_len = int(round(duration * target_sr))
        orig_indices = np.linspace(0.0, duration, num=len(samples), endpoint=False)
        target_indices = np.linspace(0.0, duration, num=target_len, endpoint=False)
        samples = np.interp(target_indices, orig_indices, samples).astype(np.float32)

    level, score, telemetry = analyze_prosody_features(samples, sr=target_sr)
    return level, telemetry
