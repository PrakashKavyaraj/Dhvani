#!/usr/bin/env python3
"""
AEGIS ECAPA Speaker Verification Compatibility Spike

Standalone isolated test validating:
1. Environment and dependency inspection (Python, PyTorch, SpeechBrain, torchaudio)
2. Enrolled speaker profile loading (speaker_profile.pt)
3. ECAPA-TDNN speaker encoder loading (speechbrain/spkrec-ecapa-voxceleb)
4. Safe temporal chunking (4s chunks, 2s hop)
5. Test embedding generation, cosine similarity against enrolled profile, and CPU latency.

Usage:
    ./venv/bin/python scripts/test_aegis_ecapa.py [--wav PATH] [--profile PATH]
"""

import argparse
import math
import os
import sys
import time
import wave
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F


# ==============================================================================
# 1. AUDIO CHUNKING & PREPARATION (16 kHz Mono, 4s chunk, 2s hop)
# ==============================================================================

def load_and_prepare_wav(path: Path, target_sr: int = 16000) -> Tuple[np.ndarray, float]:
    """Reads WAV file, downmixes to mono, and resamples to 16 kHz."""
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


def create_safe_chunks(
    samples: np.ndarray,
    chunk_samples: int = 64000,  # 4.0s @ 16 kHz
    hop_samples: int = 32000,    # 2.0s hop @ 16 kHz
) -> List[np.ndarray]:
    """Safe chunking strategy: slices into ~4s chunks with ~2s hop."""
    if len(samples) < chunk_samples:
        reps = math.ceil(chunk_samples / len(samples))
        padded = np.tile(samples, reps)[:chunk_samples]
        return [padded]

    chunks = []
    for start in range(0, len(samples) - chunk_samples + 1, hop_samples):
        chunks.append(samples[start : start + chunk_samples])

    if len(samples) > chunk_samples and (len(samples) - chunk_samples) % hop_samples != 0:
        chunks.append(samples[-chunk_samples:])

    return chunks


# ==============================================================================
# 2. MAIN COMPATIBILITY SPIKE RUNNER
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="AEGIS ECAPA Speaker Verification Compatibility Spike")
    parser.add_argument(
        "--wav",
        type=str,
        default="/Users/prakashkavyaraj/Downloads/voice.wav",
        help="Path to WAV audio file to evaluate",
    )
    parser.add_argument(
        "--profile",
        type=str,
        default="models/weights/speaker_profile.pt",
        help="Path to enrolled speaker profile checkpoint (speaker_profile.pt)",
    )
    args = parser.parse_args()

    # Step 1: Environment & Dependency Inspection
    python_ver = sys.version.split()[0]
    torch_ver = torch.__version__
    device = "cpu"

    torchaudio_ver = "NOT INSTALLED"
    try:
        import torchaudio
        torchaudio_ver = torchaudio.__version__
    except ImportError:
        pass

    speechbrain_ver = "NOT INSTALLED"
    speechbrain_available = False
    try:
        import speechbrain
        speechbrain_ver = speechbrain.__version__
        speechbrain_available = True
    except ImportError:
        pass

    # Step 2: Audio Loading
    wav_path = Path(args.wav)
    if not wav_path.is_file():
        fallback = Path("/Users/prakashkavyaraj/Downloads/ElevenLabs_2026-09-06T11_00_53_Bella - Professional, Bright, Warm_pre_sp100_s50_sb75_se0_b_m2.wav")
        if fallback.is_file():
            wav_path = fallback
        else:
            print(f"[!] Error: Audio file not found at '{args.wav}'")
            sys.exit(1)

    samples, duration = load_and_prepare_wav(wav_path, target_sr=16000)
    chunks = create_safe_chunks(samples, chunk_samples=64000, hop_samples=32000)

    # Step 3: Enrolled Speaker Profile Resolution
    profile_path = Path(args.profile)
    if not profile_path.is_absolute():
        project_root = Path(__file__).resolve().parent.parent
        profile_path = project_root / profile_path

    profile_loaded = False
    enrolled_embedding: Optional[torch.Tensor] = None
    profile_dim = "None"

    if profile_path.is_file():
        try:
            profile_data = torch.load(str(profile_path), map_location="cpu", weights_only=False)
            if isinstance(profile_data, torch.Tensor):
                enrolled_embedding = profile_data
            elif isinstance(profile_data, dict):
                enrolled_embedding = profile_data.get("embedding", profile_data.get("spk_embedding", None))
            
            if enrolled_embedding is not None:
                # Ensure 1D or 2D (1, D)
                enrolled_embedding = enrolled_embedding.detach().cpu().float().view(1, -1)
                profile_loaded = True
                profile_dim = str(list(enrolled_embedding.shape))
        except Exception as exc:
            print(f"[!] Error reading speaker profile from '{profile_path}': {exc}")
    else:
        # Check alternate candidate locations
        alt_candidates = [
            Path("/Users/prakashkavyaraj/backend/data/speaker_profile.pt"),
            Path("/Users/prakashkavyaraj/backend/speaker_profile.pt"),
            Path("/Users/prakashkavyaraj/Downloads/speaker_profile.pt"),
        ]
        for cand in alt_candidates:
            if cand.is_file():
                try:
                    pdata = torch.load(str(cand), map_location="cpu", weights_only=False)
                    if isinstance(pdata, torch.Tensor):
                        enrolled_embedding = pdata.detach().cpu().float().view(1, -1)
                        profile_path = cand
                        profile_loaded = True
                        profile_dim = str(list(enrolled_embedding.shape))
                        break
                except Exception:
                    pass

    # Step 4: ECAPA Model Loading & Inference
    ecapa_model_loaded = False
    test_embedding_dim = "None"
    per_chunk_similarities: List[float] = []
    aggregated_similarity = "None"
    cpu_infer_time_ms = 0.0

    if not speechbrain_available:
        # Cannot load ECAPA without speechbrain
        ecapa_error = "SpeechBrain is not installed in the virtual environment."
    else:
        try:
            from speechbrain.inference.classifiers import EncoderClassifier
            classifier = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="models/cache/spkrec-ecapa-voxceleb",
                run_opts={"device": "cpu"},
            )
            ecapa_model_loaded = True

            t_start = time.perf_counter()
            chunk_embeddings = []

            for chk in chunks:
                tensor_chunk = torch.from_numpy(chk).float().unsqueeze(0)  # (1, T)
                with torch.no_grad():
                    emb = classifier.encode_batch(tensor_chunk)  # (1, 1, 192)
                    emb = emb.squeeze(1)  # (1, 192)
                    emb = F.normalize(emb, p=2, dim=-1)
                    chunk_embeddings.append(emb)

            cpu_infer_time_ms = (time.perf_counter() - t_start) * 1000.0

            if chunk_embeddings:
                test_embedding_dim = str(list(chunk_embeddings[0].shape))

                # If enrolled profile was loaded, compute cosine similarity
                if profile_loaded and enrolled_embedding is not None:
                    norm_enrolled = F.normalize(enrolled_embedding, p=2, dim=-1)
                    for c_emb in chunk_embeddings:
                        sim = F.cosine_similarity(norm_enrolled, c_emb, dim=-1).item()
                        per_chunk_similarities.append(round(float(sim), 4))

                    # Aggregated similarity (mean across temporal chunks)
                    agg_sim = float(np.mean(per_chunk_similarities))
                    aggregated_similarity = f"{round(agg_sim, 4)}"
        except Exception as exc:
            ecapa_error = str(exc)

    # Step 5: Output in the exact requested format
    print("================================================")
    print("AEGIS ECAPA COMPATIBILITY SPIKE")
    print("================================================")
    print(f"Python: {python_ver}")
    print(f"PyTorch: {torch_ver}")
    print(f"SpeechBrain: {speechbrain_ver}")
    print(f"Device: {device}")
    print()
    print(f"Audio duration: {duration:.2f}s")
    print(f"Audio sample rate: 16000 Hz")
    print(f"Number of chunks: {len(chunks)}")
    print()
    print(f"Enrollment profile: {profile_path if profile_loaded else f'NOT FOUND ({profile_path})'}")
    print(f"Profile embedding dimension: {profile_dim}")
    print()
    print(f"Test embedding dimension: {test_embedding_dim}")
    print()
    print("Per-chunk similarities:")
    if per_chunk_similarities:
        print(f"{per_chunk_similarities}")
    else:
        print("  [Not available - requires loaded profile and ECAPA model]")
    print()
    print(f"Aggregated speaker similarity: {aggregated_similarity}")
    print()
    print(f"CPU inference time: {cpu_infer_time_ms:.2f} ms" if cpu_infer_time_ms > 0 else "CPU inference time: N/A")
    print()
    print(f"Profile loaded: {profile_loaded}")
    print(f"ECAPA model loaded: {ecapa_model_loaded}")
    print("================================================")

    # Exit code reflects whether both components loaded
    if profile_loaded and ecapa_model_loaded:
        sys.exit(0)
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()
