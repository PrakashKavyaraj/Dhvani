
from typing import Dict, List, Any
import numpy as np


def robust_spoof_evidence(
    window_scores: List[float],
    audio_quality: float = 1.0,
    channel_reliability: float = 1.0,
) -> Dict[str, Any]:
    """
    Convert window-level AASIST scores into robust call-level
    spoof evidence.

    This is an evidence aggregation layer, NOT a classifier.

    Inputs:
        window_scores:
            AASIST spoof probability for each temporal window.

        audio_quality:
            Reliability estimate of the audio signal [0, 1].

        channel_reliability:
            Acoustic channel reliability estimate [0, 1], accounting
            for telephony or codec bandpass constraints.

    Outputs:
        Robust statistics and reliability-adjusted evidence.

    Design goals:
        - resist isolated spikes
        - reward persistent evidence
        - account for signal quality and channel constraints
        - preserve raw model evidence for auditability
        - avoid arbitrary threshold hacking
    """

    if not window_scores:
        chan_rel = float(np.clip(channel_reliability, 0.0, 1.0))
        return {
            "median": 0.5,
            "mean": 0.5,
            "maximum": 0.5,
            "minimum": 0.5,
            "std": 0.0,
            "high_score_ratio": 0.0,
            "stability": 0.0,
            "persistence": 0.0,
            "robust_score": 0.5,
            "reliability": 0.0,
            "reliable_score": 0.5,
            "channel_reliability": chan_rel,
            "raw_persistent_spoof_evidence": 0.5,
            "reliability_adjusted_spoof_evidence": 0.5,
            "windows_analyzed": 0,
        }

    scores = np.asarray(
        window_scores,
        dtype=np.float32,
    )

    scores = np.nan_to_num(
        scores,
        nan=0.5,
        posinf=1.0,
        neginf=0.0,
    )

    scores = np.clip(
        scores,
        0.0,
        1.0,
    )

    quality = float(
        np.clip(audio_quality, 0.0, 1.0)
    )

    median = float(np.median(scores))
    mean = float(np.mean(scores))
    maximum = float(np.max(scores))
    minimum = float(np.min(scores))
    std = float(np.std(scores))

    # Fraction of windows with strong spoof evidence.
    high_score_ratio = float(
        np.mean(scores >= 0.80)
    )

    # Stability:
    # low variance -> stable evidence.
    stability = float(
        np.clip(
            1.0 - (std / 0.30),
            0.0,
            1.0,
        )
    )

    # Persistence rewards evidence that is both:
    #   1. present across many windows
    #   2. meaningfully above the neutral midpoint
    persistence = (
        0.70 * high_score_ratio
        +
        0.30 * np.clip(
            (median - 0.50) / 0.50,
            0.0,
            1.0,
        )
    )

    # Robust call-level evidence.
    #
    # Median receives the strongest weight because it is
    # resistant to isolated anomalous windows.
    robust_score = (
        0.70 * median
        +
        0.15 * mean
        +
        0.05 * maximum
        +
        0.10 * persistence
    )

    robust_score = float(
        np.clip(
            robust_score,
            0.0,
            1.0,
        )
    )

    chan_rel = float(
        np.clip(channel_reliability, 0.0, 1.0)
    )

    # Compound reliability combines signal audio quality and channel domain reliability.
    effective_reliability = float(
        np.clip(quality * chan_rel, 0.0, 1.0)
    )

    # Reliability adjustment.
    #
    # When audio quality is poor or channel constraints (e.g. telephony) are present,
    # pull the evidence toward neutral (0.50) rather than pretending the detector is certain.
    reliable_score = (
        effective_reliability * robust_score
        +
        (1.0 - effective_reliability) * 0.50
    )

    reliable_score = float(
        np.clip(
            reliable_score,
            0.0,
            1.0,
        )
    )

    return {
        "median": median,
        "mean": mean,
        "maximum": maximum,
        "minimum": minimum,
        "std": std,
        "high_score_ratio": high_score_ratio,
        "stability": stability,
        "persistence": float(
            np.clip(persistence, 0.0, 1.0)
        ),
        "robust_score": robust_score,
        "reliability": effective_reliability,
        "reliable_score": reliable_score,
        "channel_reliability": chan_rel,
        "raw_persistent_spoof_evidence": robust_score,
        "reliability_adjusted_spoof_evidence": reliable_score,
        "windows_analyzed": len(scores),
    }
