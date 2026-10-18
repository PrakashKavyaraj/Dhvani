"""
Rigorous Multi-Trial Model Inference Latency Benchmark (Parts E1, E2, E3, E4).

Benchmarks all 7 model configurations:
1. Forensics-0.3B (WavLM-Large 300M)
2. AASIST-L (PyTorch CPU)
3. AASIST-L (ONNX Runtime CPU)
4. ECAPA-TDNN (SpeechBrain)
5. Full Ensemble (Serial PyTorch)
6. Full Ensemble (Serial ONNX)
7. Full Ensemble (Concurrent Multi-Threaded)

Protocol:
- 50 warmup runs per configuration
- At least 1000 timed runs per row in randomized interleaved order to mitigate thermal/cache bias
- Benchmark repeated 3 independent times to quantify run-to-run variation of p50 and p99
- For every row: reports hardware, OS, libraries, threads, N, p50, p90, p95, p99, max, and percentage <= 350 ms
  (Does NOT base compliance on p50)
- Defines SLA scope: compute after rolling window vs time-to-first-verdict

Outputs:
- data/rigorous_latency_benchmark.json
- docs/RIGOROUS_LATENCY_REPORT.md
"""

import argparse
import concurrent.futures
import importlib.metadata
import json
import logging
import os
import platform
import random
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Tuple

import numpy as np
import onnxruntime as ort
import soundfile as sf
import torch

_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.integrations.aegis_adapter import get_aegis_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("rigorous_latency_benchmark")


def _prepare_aasist_input(audio_in: np.ndarray) -> np.ndarray:
    n = 64600
    cur = len(audio_in)
    if cur < n:
        chunk = np.tile(audio_in, (n + cur - 1) // cur)[:n]
    elif cur > n:
        s = (cur - n) // 2
        chunk = audio_in[s : s + n]
    else:
        chunk = audio_in
    return chunk.reshape(1, -1).astype(np.float32)


def run_benchmark_trial(
    trial_idx: int,
    engine: Any,
    ort_session: Any,
    dummy_audio: np.ndarray,
    n_warmup: int = 50,
    n_timed: int = 1000,
) -> Dict[str, Any]:
    """Runs a single benchmark trial of n_timed interleaved iterations."""
    logger.info("--- Starting Benchmark Trial %d (Warmup=%d, Timed=%d) ---", trial_idx, n_warmup, n_timed)

    # Define component runner lambdas
    def _run_forensics():
        return engine.forensics_detector.predict(dummy_audio)

    def _run_aasist_pytorch():
        return engine.aasist.predict(dummy_audio)

    def _run_aasist_onnx():
        return ort_session.run(None, {"audio": _prepare_aasist_input(dummy_audio)})

    def _run_ecapa():
        return engine.ecapa.verify(dummy_audio)

    def _run_serial_pytorch():
        if engine.vad:
            _ = engine.vad.analyze(dummy_audio)
        if hasattr(engine, "channel_analyzer") and engine.channel_analyzer:
            _ = engine.channel_analyzer.analyze(dummy_audio)
        if hasattr(engine, "pad") and engine.pad:
            _ = engine.pad.analyze(dummy_audio)
        if hasattr(engine, "passive_liveness") and engine.passive_liveness:
            _ = engine.passive_liveness.evaluate(dummy_audio)
        r_f = engine.forensics_detector.predict(dummy_audio)
        r_a = engine.aasist.predict(dummy_audio)
        r_e = engine.ecapa.verify(dummy_audio)
        return r_f, r_a, r_e

    def _run_serial_onnx():
        if engine.vad:
            _ = engine.vad.analyze(dummy_audio)
        if hasattr(engine, "channel_analyzer") and engine.channel_analyzer:
            _ = engine.channel_analyzer.analyze(dummy_audio)
        if hasattr(engine, "pad") and engine.pad:
            _ = engine.pad.analyze(dummy_audio)
        if hasattr(engine, "passive_liveness") and engine.passive_liveness:
            _ = engine.passive_liveness.evaluate(dummy_audio)
        r_f = engine.forensics_detector.predict(dummy_audio)
        r_a = ort_session.run(None, {"audio": _prepare_aasist_input(dummy_audio)})
        r_e = engine.ecapa.verify(dummy_audio)
        return r_f, r_a, r_e

    conc_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)

    def _run_concurrent():
        if engine.vad:
            _ = engine.vad.analyze(dummy_audio)
        if hasattr(engine, "channel_analyzer") and engine.channel_analyzer:
            _ = engine.channel_analyzer.analyze(dummy_audio)
        if hasattr(engine, "pad") and engine.pad:
            _ = engine.pad.analyze(dummy_audio)
        if hasattr(engine, "passive_liveness") and engine.passive_liveness:
            _ = engine.passive_liveness.evaluate(dummy_audio)
        f_forensics = conc_executor.submit(engine.forensics_detector.predict, dummy_audio)
        f_aasist = conc_executor.submit(ort_session.run, None, {"audio": _prepare_aasist_input(dummy_audio)})
        f_ecapa = conc_executor.submit(engine.ecapa.verify, dummy_audio)
        r_f = f_forensics.result()
        r_a = f_aasist.result()
        r_e = f_ecapa.result()
        return r_f, r_a, r_e

    components: Dict[str, Tuple[str, str, Callable]] = {
        "forensics_0.3b_wavlm": ("Forensics-0.3B", "WavLM-Large (300M params) + GAT head (PyTorch)", _run_forensics),
        "aasist_l_pytorch": ("AASIST-L (PyTorch)", "Spectro-temporal graph attention (PyTorch CPU)", _run_aasist_pytorch),
        "aasist_l_onnx": ("AASIST-L (ONNX)", "Accelerated Graph Attention (ONNX Runtime CPU)", _run_aasist_onnx),
        "ecapa_tdnn": ("ECAPA-TDNN", "192-dim speaker verification embedding", _run_ecapa),
        "full_ensemble_serial_pytorch": ("Full Ensemble (Serial PyTorch)", "Sequential pipeline with PyTorch AASIST-L", _run_serial_pytorch),
        "full_ensemble_serial_onnx": ("Full Ensemble (Serial ONNX)", "Sequential pipeline with ONNX AASIST-L (no thread pool)", _run_serial_onnx),
        "full_ensemble_concurrent": ("Full Ensemble (Concurrent)", "ThreadPool concurrent pipeline with ONNX AASIST-L", _run_concurrent),
    }

    # 1. Warmup runs
    logger.info("Executing %d warmup runs for all components...", n_warmup)
    for _ in range(n_warmup):
        for key, (_, _, fn) in components.items():
            fn()

    # 2. Interleaved timed runs
    logger.info("Executing %d interleaved timed runs...", n_timed)
    timings: Dict[str, List[float]] = {k: [] for k in components}

    keys = list(components.keys())
    t_start = time.perf_counter()

    for i in range(1, n_timed + 1):
        # Randomize order of execution in this iteration
        shuffled_keys = list(keys)
        random.shuffle(shuffled_keys)

        for k in shuffled_keys:
            fn = components[k][2]
            t0 = time.perf_counter()
            fn()
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            timings[k].append(elapsed_ms)

        if i % 50 == 0 or i == n_timed:
            elapsed = time.perf_counter() - t_start
            logger.info("Trial %d: Completed %d/%d iterations (%.1fs elapsed)", trial_idx, i, n_timed, elapsed)

    conc_executor.shutdown(wait=True)

    # 3. Compute statistics for this trial
    trial_stats = {}
    for k, (name, arch, _) in components.items():
        arr = np.array(timings[k])
        p50 = float(np.percentile(arr, 50))
        p90 = float(np.percentile(arr, 90))
        p95 = float(np.percentile(arr, 95))
        p99 = float(np.percentile(arr, 99))
        max_v = float(np.max(arr))
        pct_under_350 = float(np.mean(arr <= 350.0) * 100.0)

        trial_stats[k] = {
            "name": name,
            "architecture": arch,
            "n_runs": len(arr),
            "p50_ms": round(p50, 2),
            "p90_ms": round(p90, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "max_ms": round(max_v, 2),
            "pct_under_350ms": round(pct_under_350, 2),
            "raw_samples": [round(float(x), 2) for x in arr[:50]],  # Store head 50 raw samples
        }

    return trial_stats


def main():
    parser = argparse.ArgumentParser(description="Dhvani Rigorous Latency Benchmark")
    parser.add_argument("--runs", type=int, default=1000, help="Number of timed runs per row (default: 1000)")
    parser.add_argument("--warmup", type=int, default=50, help="Number of warmup runs (default: 50)")
    parser.add_argument("--trials", type=int, default=3, help="Number of independent benchmark repetitions (default: 3)")
    parser.add_argument("--window", type=float, default=1.5, help="Audio window in seconds (default: 1.5)")
    parser.add_argument("--output-json", type=str, default="data/rigorous_latency_benchmark.json", help="Output JSON path")
    parser.add_argument("--output-md", type=str, default="docs/RIGOROUS_LATENCY_REPORT.md", help="Output Markdown report path")
    args = parser.parse_args()

    engine = get_aegis_engine()
    if engine is None:
        logger.error("Could not initialize AegisEngine.")
        sys.exit(1)

    onnx_path = Path("models/weights/aasist_l.onnx")
    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = 4
    ort_session = ort.InferenceSession(str(onnx_path), sess_opts, providers=["CPUExecutionProvider"])

    window_samples = int(args.window * 16000)
    dummy_audio = (np.random.RandomState(42).randn(window_samples) * 0.1).astype(np.float32)

    hardware_env = {
        "machine": platform.machine(),
        "processor": platform.processor(),
        "system": platform.system(),
        "release": platform.release(),
        "cpu_count": os.cpu_count(),
        "torch_version": torch.__version__,
        "torch_threads": torch.get_num_threads(),
        "onnxruntime_version": ort.__version__,
    }

    trials_data = []
    for t_idx in range(1, args.trials + 1):
        t_data = run_benchmark_trial(
            t_idx,
            engine,
            ort_session,
            dummy_audio,
            n_warmup=args.warmup,
            n_timed=args.runs,
        )
        trials_data.append(t_data)

    # Aggregate across trials
    comp_keys = list(trials_data[0].keys())
    aggregated = {}

    for k in comp_keys:
        p50s = [td[k]["p50_ms"] for td in trials_data]
        p90s = [td[k]["p90_ms"] for td in trials_data]
        p95s = [td[k]["p95_ms"] for td in trials_data]
        p99s = [td[k]["p99_ms"] for td in trials_data]
        maxs = [td[k]["max_ms"] for td in trials_data]
        pcts = [td[k]["pct_under_350ms"] for td in trials_data]

        aggregated[k] = {
            "name": trials_data[0][k]["name"],
            "architecture": trials_data[0][k]["architecture"],
            "total_runs_per_trial": args.runs,
            "trials_conducted": args.trials,
            "mean_p50_ms": round(float(np.mean(p50s)), 2),
            "variation_p50_ms": round(float(np.max(p50s) - np.min(p50s)), 2),
            "mean_p90_ms": round(float(np.mean(p90s)), 2),
            "mean_p95_ms": round(float(np.mean(p95s)), 2),
            "mean_p99_ms": round(float(np.mean(p99s)), 2),
            "variation_p99_ms": round(float(np.max(p99s) - np.min(p99s)), 2),
            "max_ms": round(float(np.max(maxs)), 2),
            "mean_pct_under_350ms": round(float(np.mean(pcts)), 2),
            "trial_p50s": p50s,
            "trial_p99s": p99s,
            "trial_pcts": pcts,
        }

    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "audio_window_seconds": args.window,
        "sample_count": window_samples,
        "hardware_environment": hardware_env,
        "test_protocol": {
            "warmup_runs": args.warmup,
            "timed_runs_per_trial": args.runs,
            "trials": args.trials,
            "interleaved_randomized": True,
        },
        "trials_detail": trials_data,
        "aggregated_results": aggregated,
    }

    out_json = Path(args.output_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Generate Markdown Report
    md = []
    md.append("# Dhvani Acoustic Inference: Rigorous Multi-Trial Latency Benchmark")
    md.append(f"**Recorded:** {payload['timestamp']}")
    md.append(f"**Audio Window Tested:** {args.window}s ({window_samples:,} samples @ 16 kHz)")
    md.append(f"**Protocol:** {args.warmup} warmup runs, {args.runs} timed runs per row, randomized interleaved order, repeated {args.trials} times.\n")

    md.append("## Hardware & Runtime Environment")
    md.append(f"* **Machine / Processor:** {hardware_env['machine']} ({hardware_env['processor']}), {hardware_env['cpu_count']} cores")
    md.append(f"* **Operating System:** {hardware_env['system']} {hardware_env['release']}")
    md.append(f"* **Libraries:** PyTorch {hardware_env['torch_version']} ({hardware_env['torch_threads']} threads), ONNX Runtime {hardware_env['onnxruntime_version']}")
    md.append("")

    md.append("## Formal Telephony SLA Scope & Timing Definition")
    md.append("> [!IMPORTANT] **SLA Scope Definition (350 ms Budget)**:")
    md.append("> * **Turn-by-Turn SLA (350 ms Budget)**: Covers pure computation time after a rolling audio buffer turn (1.5s window) is handed to inference until the verdict JSON is dispatched over the carrier WebSocket.")
    md.append("> * **Time-to-First-Verdict (Initial Call Lag)**: The caller must speak for at least 1.5 seconds to fill the sliding window. Minimum initial latency from call onset is **1.5s audio accumulation + compute turnaround** (~1.75s to 1.85s).")
    md.append("")

    md.append("## Multi-Trial Latency & Compliance Summary (Aggregated across 3 Trials)")
    md.append("| Model Component | Architecture / Engine | Runs | p50 (ms) | Delta p50 | p90 (ms) | p95 (ms) | p99 (ms) | Delta p99 | Max (ms) | % <= 350ms |")
    md.append("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")

    for k in comp_keys:
        a = aggregated[k]
        md.append(f"| **{a['name']}** | {a['architecture']} | {a['total_runs_per_trial']} x {a['trials_conducted']} | **{a['mean_p50_ms']} ms** | +/-{a['variation_p50_ms']} ms | {a['mean_p90_ms']} ms | {a['mean_p95_ms']} ms | {a['mean_p99_ms']} ms | +/-{a['variation_p99_ms']} ms | {a['max_ms']} ms | **{a['mean_pct_under_350ms']}%** |")

    md.append("")
    md.append("## Trial-by-Trial Run Variation")
    trial_headers = " | ".join([f"Trial {i} p50 / p99" for i in range(1, args.trials + 1)])
    trial_pct_headers = " | ".join([f"Trial {i} % <= 350" for i in range(1, args.trials + 1)])
    md.append(f"| Model Component | {trial_headers} | {trial_pct_headers} |")
    sep_cols = " | ".join([":---:"] * (2 * args.trials))
    md.append(f"| :--- | {sep_cols} |")

    for k in comp_keys:
        a = aggregated[k]
        t_p50 = a["trial_p50s"]
        t_p99 = a["trial_p99s"]
        t_pct = a["trial_pcts"]
        col_lat = " | ".join([f"{t_p50[i]} / {t_p99[i]} ms" for i in range(len(t_p50))])
        col_pct = " | ".join([f"{t_pct[i]}%" for i in range(len(t_pct))])
        md.append(f"| **{a['name']}** | {col_lat} | {col_pct} |")

    out_md = Path(args.output_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    logger.info("Saved rigorous latency report to %s and %s", out_json, out_md)


if __name__ == "__main__":
    main()
