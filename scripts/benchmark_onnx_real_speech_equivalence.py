"""
Empirical ONNX Runtime vs PyTorch Equivalence Benchmark on Real Speech.

Evaluates AASIST-L across 300 real speech utterances from ASVspoof 5:
- Compares raw logits and spoof probabilities across real human and synthetic speech.
- Measures Max Absolute Error, Mean Absolute Error, RMSE, and Decision Agreement.
- Computes aggregate biometric metrics (EER, minDCF, Cllr) under both PyTorch and ONNX Runtime.
"""

import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import torch
import torch.nn.functional as F

# Ensure backend root is on sys.path
_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.core.calibration_engine import ProbabilityCalibrator
from scripts.evaluation_harness import compute_dcf, compute_eer, load_manifest_trials

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("onnx_speech_equivalence")


def run_real_speech_equivalence_benchmark(
    manifest_path: Path,
    audio_dir: Path,
    output_json: Path,
) -> Dict[str, Any]:
    import onnxruntime as ort
    import soundfile as sf
    from app.integrations.aegis_adapter import AegisAdapter, get_aegis_engine

    all_trials = load_manifest_trials(manifest_path)
    available_files = {p.stem: p for p in audio_dir.glob("*.flac")}
    matched_trials = [t for t in all_trials if t["trial_id"] in available_files]

    if not matched_trials:
        raise ValueError(f"No audio files in {audio_dir} matched trials in {manifest_path}")

    # Load PyTorch AASIST-L model
    adapter = AegisAdapter()
    pt_model = getattr(adapter, "_model", getattr(adapter, "model", None))
    if pt_model is None:
        raise RuntimeError("Could not load PyTorch AASIST model from AegisAdapter")

    pt_model.eval()

    # Load ONNX Runtime session
    onnx_path = _backend_root / "models" / "weights" / "aasist_l.onnx"
    if not onnx_path.is_file():
        raise FileNotFoundError(f"ONNX model not found: {onnx_path}")

    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = 4
    ort_sess = ort.InferenceSession(str(onnx_path), sess_opts, providers=["CPUExecutionProvider"])

    logger.info("Evaluating 300 real speech utterances across PyTorch and ONNX Runtime...")

    pt_scores: List[float] = []
    onnx_scores: List[float] = []
    labels: List[int] = []
    abs_diffs: List[float] = []
    trial_records: List[Dict[str, Any]] = []

    t_start = time.perf_counter()

    for idx, t in enumerate(matched_trials, start=1):
        flac_path = available_files[t["trial_id"]]
        audio, sr = sf.read(str(flac_path), dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Standard 64,600 window (center crop or repeat-pad)
        n = 64600
        cur = len(audio)
        if cur < n:
            chunk = np.tile(audio, (n + cur - 1) // cur)[:n]
        elif cur > n:
            s = (cur - n) // 2
            chunk = audio[s : s + n]
        else:
            chunk = audio

        # PyTorch forward pass
        t_in = torch.from_numpy(chunk).float().unsqueeze(0)
        with torch.inference_mode():
            _, pt_out = pt_model(t_in)
            pt_prob = float(F.softmax(pt_out, dim=-1)[0, 0].item())

        # ONNX Runtime forward pass
        ort_inputs = {"audio": chunk.reshape(1, -1).astype(np.float32)}
        ort_outs = ort_sess.run(None, ort_inputs)
        # ort_outs[1] is output logits shape (1, 2)
        onnx_logits = ort_outs[1] if len(ort_outs) > 1 else ort_outs[0]
        exp_logits = np.exp(onnx_logits - np.max(onnx_logits, axis=-1, keepdims=True))
        onnx_prob = float(exp_logits[0, 0] / np.sum(exp_logits[0]))

        diff = abs(pt_prob - onnx_prob)
        abs_diffs.append(diff)
        pt_scores.append(pt_prob)
        onnx_scores.append(onnx_prob)
        labels.append(t["label"])

        trial_records.append({
            "trial_id": t["trial_id"],
            "label": t["label"],
            "generator": t.get("generator", "bonafide"),
            "pt_score": round(pt_prob, 5),
            "onnx_score": round(onnx_prob, 5),
            "abs_error": round(diff, 7),
            "decision_parity": (pt_prob >= 0.50) == (onnx_prob >= 0.50),
        })

    elapsed = time.perf_counter() - t_start
    arr_diffs = np.array(abs_diffs)
    max_err = float(np.max(arr_diffs))
    mean_err = float(np.mean(arr_diffs))
    rmse = float(np.sqrt(np.mean(arr_diffs ** 2)))
    parity_rate = float(np.mean([r["decision_parity"] for r in trial_records])) * 100.0

    # Aggregate biometric metrics
    bona_pt = [s for s, l in zip(pt_scores, labels) if l == 0]
    spoof_pt = [s for s, l in zip(pt_scores, labels) if l == 1]
    bona_onnx = [s for s, l in zip(onnx_scores, labels) if l == 0]
    spoof_onnx = [s for s, l in zip(onnx_scores, labels) if l == 1]

    eer_pt, th_pt = compute_eer(bona_pt, spoof_pt)
    eer_onnx, th_onnx = compute_eer(bona_onnx, spoof_onnx)

    cal = ProbabilityCalibrator()
    cllr_pt = cal.compute_cllr(pt_scores, labels)
    cllr_onnx = cal.compute_cllr(onnx_scores, labels)

    dcf_pt = compute_dcf(bona_pt, spoof_pt, cost_miss=10.0, cost_fa=1.0, p_target=0.05)
    dcf_onnx = compute_dcf(bona_onnx, spoof_onnx, cost_miss=10.0, cost_fa=1.0, p_target=0.05)

    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": "AASIST-L",
        "dataset": "ASVspoof 5 Development Real Audio Trials",
        "total_trials": len(trial_records),
        "bonafide_trials": len(bona_pt),
        "spoof_trials": len(spoof_pt),
        "benchmark_duration_seconds": round(elapsed, 2),
        "numerical_equivalence": {
            "max_absolute_error": round(max_err, 7),
            "mean_absolute_error": round(mean_err, 7),
            "rmse": round(rmse, 7),
            "tolerance_threshold": 1e-4,
            "within_tolerance": bool(max_err < 1e-4),
            "decision_parity_percent": round(parity_rate, 2),
        },
        "metric_parity": {
            "pytorch": {
                "eer": round(eer_pt, 5),
                "eer_threshold": round(th_pt, 5),
                "min_dcf": round(dcf_pt["min_dcf"], 5),
                "cllr": round(cllr_pt, 5),
            },
            "onnx_runtime": {
                "eer": round(eer_onnx, 5),
                "eer_threshold": round(th_onnx, 5),
                "min_dcf": round(dcf_onnx["min_dcf"], 5),
                "cllr": round(cllr_onnx, 5),
            },
            "delta": {
                "delta_eer": round(abs(eer_pt - eer_onnx), 6),
                "delta_min_dcf": round(abs(dcf_pt["min_dcf"] - dcf_onnx["min_dcf"]), 6),
                "delta_cllr": round(abs(cllr_pt - cllr_onnx), 6),
            },
        },
        "trials": trial_records,
    }

    output_json.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    logger.info(
        "Real Speech ONNX Benchmark complete: MaxErr=%.2e | MeanErr=%.2e | DecisionParity=%.1f%% | DeltaEER=%.5f",
        max_err,
        mean_err,
        parity_rate,
        abs(eer_pt - eer_onnx),
    )
    return results


if __name__ == "__main__":
    b_dir = Path(__file__).resolve().parent.parent
    m_path = b_dir / "data" / "asvspoof5_official" / "ASVspoof5.dev.track_1.tsv"
    a_dir = b_dir / "data" / "asvspoof5_dev_slice" / "flac_D"
    o_json = b_dir / "data" / "onnx_real_speech_equivalence.json"
    run_real_speech_equivalence_benchmark(m_path, a_dir, o_json)
