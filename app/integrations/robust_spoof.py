"""
Robust Spoof Evidence Aggregation & Reliability Calibration.

Implements temporal window pooling and duration/consistency-adjusted
reliability estimation for multi-window acoustic anti-spoofing.
"""

from typing import List, Tuple
import numpy as np


def compute_robust_spoof_evidence(
    window_scores: List[float],
    duration: float,
) -> Tuple[float, float, float]:
    """
    Computes distinct spoof metrics across temporal sliding windows:
    - current_spoof_score: The spoof score of the most recent / current window.
    - persistent_spoof_evidence: Robust 90th-percentile aggregation across all windows.
    - reliability: Calibrated confidence factor based on audio duration and window consistency.

    Returns:
        (current_spoof_score, persistent_spoof_evidence, reliability)
    """
    if not window_scores:
        return 0.0, 0.0, 0.0

    scores = np.array(window_scores, dtype=np.float32)

    # 1. Current Window Spoof Score (strictly the latest temporal frame)
    current_score = float(scores[-1])

    # 2. Persistent Spoof Evidence (90th percentile across windows, resilient to blips)
    if len(scores) <= 2:
        persistent_evidence = float(np.max(scores))
    else:
        persistent_evidence = float(np.percentile(scores, 90.0))

    # 3. Reliability Calibration
    # Durations < 4.0s reduce reliability; score variance penalizes reliability
    duration_factor = min(1.0, max(0.2, duration / 4.0))
    variance_penalty = float(np.std(scores))
    consistency = max(0.0, 1.0 - (variance_penalty * 1.5))
    reliability = float(duration_factor * max(0.6, consistency))

    return (
        round(current_score, 4),
        round(persistent_evidence, 4),
        round(min(1.0, max(0.0, reliability)), 4),
    )
