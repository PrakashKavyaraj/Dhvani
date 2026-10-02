#!/usr/bin/env python3
"""
AEGIS AASIST-L Compatibility Spike & Standalone Test Runner

Proves that the existing Python backend environment (Python 3.14.3 on macOS arm64)
can successfully load the official trained AASIST-L checkpoint (AASIST-L.pth),
execute CPU inference across sliding temporal windows, and calculate robust &
reliability-adjusted spoof scores.

Usage:
    ./venv/bin/python scripts/test_aegis_aasist.py [--wav PATH] [--checkpoint PATH]
"""

import argparse
import math
import os
import sys
import time
import wave
from pathlib import Path
from typing import List, Tuple

import numpy as np
import torch
import torch.nn.functional as F

# Add scripts directory to path to import official AASIST architecture
sys.path.insert(0, str(Path(__file__).resolve().parent))
from AASIST_official import Model as OfficialAASIST


# ==============================================================================
# 1. AASIST-L MODEL CONFIGURATION (Jung et al., Interspeech 2022)
# ==============================================================================

AASIST_L_CONFIG = {
    "architecture": "AASIST",
    "nb_samp": 64600,
    "first_conv": 128,
    "filts": [70, [1, 32], [32, 32], [32, 24], [24, 24]],
    "gat_dims": [24, 32],
    "pool_ratios": [0.4, 0.5, 0.7, 0.5],
    "temperatures": [2.0, 2.0, 100.0, 100.0],
}


# ==============================================================================
# 2. AUDIO PREPARATION & WINDOWING (16 kHz Mono)
# ==============================================================================

def load_and_prepare_wav(path: Path, target_sr: int = 16000) -> Tuple[np.ndarray, float]:
    """
    Reads WAV file using standard library, downmixes to mono, and linearly
    resamples to 16 kHz. Returns (float32_array, duration_seconds).
    """
    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw_bytes = wf.readframes(n_frames)

    duration = n_frames / float(sample_rate)

    if sample_width == 2:
        samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 1:
        samples = (np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise ValueError(f"Unsupported sample width: {sample_width}")

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    if sample_rate != target_sr:
        orig_indices = np.linspace(0.0, duration, num=len(samples), endpoint=False)
        target_len = int(round(duration * target_sr))
        target_indices = np.linspace(0.0, duration, num=target_len, endpoint=False)
        samples = np.interp(target_indices, orig_indices, samples).astype(np.float32)

    return samples, duration


def create_sliding_windows(
    samples: np.ndarray,
    window_len: int = 64600,
    hop_len: int = 32300,
) -> List[np.ndarray]:
    """
    Slices audio into 64,600-sample (~4.04s) windows with 50% overlap.
    Pads or repeats if audio is shorter than window_len.
    """
    if len(samples) < window_len:
        reps = math.ceil(window_len / len(samples))
        padded = np.tile(samples, reps)[:window_len]
        return [padded]

    windows = []
    for start in range(0, len(samples) - window_len + 1, hop_len):
        windows.append(samples[start : start + window_len])

    if len(samples) > window_len and (len(samples) - window_len) % hop_len != 0:
        windows.append(samples[-window_len:])

    return windows


# ==============================================================================
# 3. ROBUST SPOOF POOLING & RELIABILITY METRICS
# ==============================================================================

def compute_robust_spoof_metrics(
    window_scores: List[float],
    duration: float,
) -> Tuple[float, float]:
    """
    Implements AEGIS robust spoof pooling:
    - robust_spoof_score: 90th percentile of temporal window scores (resilient to transient blips).
    - reliability_adjusted_spoof_score: Calibrated score factoring in duration & temporal consistency.
    """
    if not window_scores:
        return 0.0, 0.0

    scores = np.array(window_scores, dtype=np.float32)

    # 1. Robust Spoof Score (90th percentile)
    robust_score = float(np.percentile(scores, 90.0))

    # 2. Reliability Weighting
    duration_factor = min(1.0, duration / 4.0)
    variance_penalty = float(np.std(scores))
    consistency = max(0.0, 1.0 - (variance_penalty * 1.5))
    reliability = duration_factor * max(0.6, consistency)

    adjusted_score = float(np.clip(
        (reliability * robust_score) + ((1.0 - reliability) * 0.5),
        0.0,
        1.0,
    ))

    return round(robust_score, 4), round(adjusted_score, 4)


# ==============================================================================
# 4. STANDALONE SPIKE EXECUTION ENTRYPOINT
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="AEGIS AASIST-L Compatibility Spike")
    parser.add_argument(
        "--wav",
        type=str,
        default="/Users/prakashkavyaraj/Downloads/voice.wav",
        help="Path to WAV audio file to evaluate",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default="models/weights/AASIST-L.pth",
        help="Path to AASIST-L model weights checkpoint",
    )
    args = parser.parse_args()

    wav_path = Path(args.wav)
    if not wav_path.is_file():
        fallback = Path("/Users/prakashkavyaraj/Downloads/ElevenLabs_2026-09-06T11_00_53_Bella - Professional, Bright, Warm_pre_sp100_s50_sb75_se0_b_m2.wav")
        if fallback.is_file():
            wav_path = fallback
        else:
            sys.exit(f"Error: WAV file not found at '{args.wav}' or fallback path.")

    ckpt_path = Path(args.checkpoint)
    if not ckpt_path.is_absolute():
        # Resolve relative to project root
        project_root = Path(__file__).resolve().parent.parent
        ckpt_path = project_root / ckpt_path

    print(f"================================================================")
    print(f"  AEGIS AASIST-L COMPATIBILITY SPIKE (Python {sys.version.split()[0]} on {sys.platform})")
    print(f"================================================================")
    print(f"[*] Input audio file: {wav_path.name}")
    print(f"[*] Expected checkpoint path: {ckpt_path}")
    print(f"[*] PyTorch version: {torch.__version__} | Device: cpu")

    # Step 1: Load and prepare audio
    samples, duration = load_and_prepare_wav(wav_path, target_sr=16000)
    windows = create_sliding_windows(samples, window_len=64600, hop_len=32300)
    print(f"[*] Audio loaded: {len(samples)} samples @ 16 kHz ({duration:.2f} seconds)")
    print(f"[*] Created {len(windows)} temporal sliding windows (window_len=64600, hop=32300)")

    # Step 2: Instantiate Official AASIST-L Architecture
    model = OfficialAASIST(AASIST_L_CONFIG)
    model.eval()

    # Step 3: Load Trained Checkpoint
    checkpoint_loaded = False
    if not ckpt_path.is_file():
        print(f"[!] Error: Checkpoint file not found at '{ckpt_path}'")
        sys.exit(1)

    try:
        checkpoint = torch.load(str(ckpt_path), map_location="cpu", weights_only=False)
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state_dict, strict=True)
        checkpoint_loaded = True
        print(f"[+] Loaded official AASIST-L trained checkpoint successfully (strict=True, 0 missing keys).")
    except Exception as exc:
        print(f"[!] Error loading checkpoint: {exc}")
        sys.exit(1)

    # Step 4: Run Inference across temporal windows
    t_start = time.perf_counter()
    per_window_spoof_scores: List[float] = []

    with torch.no_grad():
        for idx, win in enumerate(windows):
            tensor_win = torch.from_numpy(win).float().unsqueeze(0)  # (1, 64600)
            _, output = model(tensor_win)
            # Output shape (1, 2) where index 0 = spoof, index 1 = bona_fide
            probs = F.softmax(output, dim=-1)[0]
            spoof_prob = float(probs[0].item())
            per_window_spoof_scores.append(round(spoof_prob, 4))

    total_infer_time_ms = (time.perf_counter() - t_start) * 1000.0
    latency_per_window_ms = total_infer_time_ms / max(1, len(windows))

    # Step 5: Calculate Robust & Reliability-Adjusted Scores
    robust_score, reliability_adj_score = compute_robust_spoof_metrics(
        per_window_spoof_scores,
        duration,
    )

    # Output Results in the exact format required
    print("\n----------------------------------------------------------------")
    print("  AEGIS AASIST-L INFERENCE EXECUTION RESULTS")
    print("----------------------------------------------------------------")
    print(f"  audio duration:                    {duration:.2f}s")
    print(f"  number of windows:                 {len(windows)}")
    print(f"  per-window spoof scores:           {per_window_spoof_scores}")
    print(f"  robust spoof score:                {robust_score}")
    print(f"  reliability-adjusted spoof score:  {reliability_adj_score}")
    print(f"  total CPU inference time:          {total_infer_time_ms:.2f} ms")
    print(f"  latency per window:                {latency_per_window_ms:.2f} ms/window")
    print(f"  checkpoint loaded:                 {checkpoint_loaded}")
    print("----------------------------------------------------------------\n")
    print("[✓] AEGIS AASIST-L spike with real checkpoint completed successfully.")
    sys.exit(0)


if __name__ == "__main__":
    main()
