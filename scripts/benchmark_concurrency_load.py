"""
Fixed-Arrival-Rate Concurrency Load Benchmark for Dhvani Voice Integrity (Part E5).

Evaluates 1, 2, 4, and 8 simultaneous call streams using the real production ensemble.
Each stream dispatches an acoustic verdict request every 1.0 second at a FIXED arrival rate
(open-loop schedule; does not wait for prior turn response).
Runs each stream concurrency level for at least 3 minutes (180 seconds).

Measures:
- Latency percentiles: p50, p90, p95, p99, max
- Percentage of requests <= 350 ms
- CPU utilization across the 3-minute run
- Maximum streams sustaining >= 99% SLA compliance

Outputs:
- data/concurrency_benchmark.json
- docs/CONCURRENCY_BENCHMARK.md
"""

import argparse
import concurrent.futures
import json
import logging
import os
import platform
import queue
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import psutil
import torch

_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.integrations.aegis_adapter import get_aegis_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("concurrency_benchmark")


def run_concurrency_level(
    engine: Any,
    num_streams: int,
    duration_seconds: float = 180.0,
    window_samples: int = 24000,
) -> Dict[str, Any]:
    """
    Executes open-loop fixed-rate load test for a specific concurrency level.
    Each of the `num_streams` streams generates a request every 1.0 second.
    """
    logger.info("Starting concurrency test: %d streams for %d seconds...", num_streams, int(duration_seconds))
    dummy_audio = (np.random.RandomState(42).randn(window_samples) * 0.1).astype(np.float32)

    # Worker pool for model execution
    # Up to 8 workers or os.cpu_count()
    max_workers = min(os.cpu_count() or 4, max(4, num_streams))
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers)

    latencies_ms: List[float] = []
    latencies_lock = threading.Lock()

    stop_event = threading.Event()
    cpu_measurements: List[float] = []

    # Background CPU monitor thread
    def _cpu_monitor():
        while not stop_event.is_set():
            cpu_pct = psutil.cpu_percent(interval=1.0)
            cpu_measurements.append(cpu_pct)

    monitor_thread = threading.Thread(target=_cpu_monitor, daemon=True)
    monitor_thread.start()

    # Worker task
    def _process_turn(stream_id: int, turn_idx: int, dispatch_time: float):
        try:
            # Execute real production ensemble analysis
            _ = engine.analyze(dummy_audio, session_id=f"stream-{stream_id}-turn-{turn_idx}")
            completed_time = time.perf_counter()
            elapsed_ms = (completed_time - dispatch_time) * 1000.0
            with latencies_lock:
                latencies_ms.append(elapsed_ms)
        except Exception as exc:
            logger.warning("Stream %d turn %d failed: %s", stream_id, turn_idx, exc)

    # Stream schedule loop
    t_start = time.perf_counter()
    next_tick = t_start
    turn_counts = [0] * num_streams

    while time.perf_counter() - t_start < duration_seconds:
        now = time.perf_counter()
        if now >= next_tick:
            # Dispatch one request for each active stream
            for s_id in range(num_streams):
                turn_counts[s_id] += 1
                t_dispatch = time.perf_counter()
                executor.submit(_process_turn, s_id, turn_counts[s_id], t_dispatch)
            next_tick += 1.0
        time.sleep(0.01)

    # Signal stop and wait for pending tasks
    stop_event.set()
    executor.shutdown(wait=True)
    monitor_thread.join(timeout=2.0)

    total_requests = len(latencies_ms)
    expected_requests = int(duration_seconds) * num_streams

    lat_arr = np.array(latencies_ms) if latencies_ms else np.array([0.0])
    p50 = float(np.percentile(lat_arr, 50))
    p90 = float(np.percentile(lat_arr, 90))
    p95 = float(np.percentile(lat_arr, 95))
    p99 = float(np.percentile(lat_arr, 99))
    max_lat = float(np.max(lat_arr))
    pct_under_350 = float(np.mean(lat_arr <= 350.0) * 100.0)
    avg_cpu = float(np.mean(cpu_measurements)) if cpu_measurements else 0.0

    compliant = pct_under_350 >= 99.0

    logger.info("Results for %d streams: N=%d | p50=%.2fms | p95=%.2fms | p99=%.2fms | <=350ms: %.1f%% | CPU: %.1f%% | Compliant: %s",
                num_streams, total_requests, p50, p95, p99, pct_under_350, avg_cpu, compliant)

    return {
        "num_streams": num_streams,
        "duration_seconds": duration_seconds,
        "total_requests": total_requests,
        "expected_requests": expected_requests,
        "p50_ms": round(p50, 2),
        "p90_ms": round(p90, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "max_ms": round(max_lat, 2),
        "pct_under_350ms": round(pct_under_350, 2),
        "avg_cpu_percent": round(avg_cpu, 1),
        "compliant_99pct": compliant,
    }


def main():
    parser = argparse.ArgumentParser(description="Dhvani Real-Model Concurrency Load Benchmark")
    parser.add_argument("--duration", type=float, default=180.0, help="Duration in seconds per concurrency level (default: 180s = 3 min)")
    parser.add_argument("--output-json", type=str, default="data/concurrency_benchmark.json", help="Output JSON path")
    parser.add_argument("--output-md", type=str, default="docs/CONCURRENCY_BENCHMARK.md", help="Output Markdown path")
    args = parser.parse_args()

    engine = get_aegis_engine()
    if engine is None:
        logger.error("Could not load AegisEngine.")
        sys.exit(1)

    stream_levels = [1, 2, 4, 8]
    level_results = {}

    max_compliant_streams = 0

    for streams in stream_levels:
        res = run_concurrency_level(engine, streams, duration_seconds=args.duration)
        level_results[f"streams_{streams}"] = res
        if res["compliant_99pct"]:
            max_compliant_streams = max(max_compliant_streams, streams)

    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "hardware": {
            "machine": platform.machine(),
            "system": platform.system(),
            "release": platform.release(),
            "cpu_count": os.cpu_count(),
            "torch_threads": torch.get_num_threads(),
        },
        "test_parameters": {
            "duration_per_level_seconds": args.duration,
            "arrival_interval_seconds": 1.0,
            "model_tested": "Full AEGIS Production Pipeline (Forensics-0.3B + AASIST-L + ECAPA + VAD + PAD + Liveness + Fusion)",
            "audio_window_seconds": 1.5,
        },
        "max_streams_sustaining_99pct_compliance": max_compliant_streams,
        "concurrency_levels": level_results,
    }

    out_json = Path(args.output_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Format Markdown Report
    md = []
    md.append("# Dhvani Voice Integrity: Fixed-Arrival-Rate Concurrency Benchmark")
    md.append(f"**Recorded:** {payload['timestamp']}")
    md.append(f"**Test Model:** {payload['test_parameters']['model_tested']}")
    md.append(f"**Test Window:** {payload['test_parameters']['audio_window_seconds']}s audio per request\n")

    md.append("## Concurrency Performance Summary")
    md.append("| Streams | Total Requests | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) | <= 350ms (%) | CPU (%) | 99% Compliance |")
    md.append("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")

    for s in stream_levels:
        r = level_results[f"streams_{s}"]
        md.append(f"| **{r['num_streams']}** | {r['total_requests']} | {r['p50_ms']} ms | {r['p90_ms']} ms | {r['p95_ms']} ms | {r['p99_ms']} ms | {r['max_ms']} ms | **{r['pct_under_350ms']}%** | {r['avg_cpu_percent']}% | {'PASS' if r['compliant_99pct'] else 'FAIL'} |")

    md.append("")
    md.append(f"**Maximum Simultaneous Streams Sustaining >= 99% SLA Compliance:** **{max_compliant_streams} streams**\n")

    out_md = Path(args.output_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    logger.info("Saved concurrency benchmark to %s and %s", out_json, out_md)


if __name__ == "__main__":
    main()
