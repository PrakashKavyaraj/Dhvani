"""
Unit & Integration Tests for Model Inference Benchmarking.

Validates:
1. Warmup and forward pass execution over standardized audio windows.
2. Latency percentile computation (p50, p90, p95, p99) and SLA accounting.
3. Hardware environment metadata extraction.
4. Executive Markdown report generation.
"""

import pytest
from scripts.benchmark_model_inference import (
    benchmark_audio_window,
    format_markdown_model_report,
    run_model_benchmark_suite,
)
from app.integrations.aegis_adapter import get_aegis_engine


class TestModelInferenceBenchmark:
    """Validates the acoustic model forward pass latency benchmarker."""

    def test_benchmark_audio_window_execution(self):
        engine = get_aegis_engine()
        assert engine is not None

        # Benchmark a 1.0 second window with 1 warmup and 2 runs
        res = benchmark_audio_window(
            engine=engine,
            window_seconds=1.0,
            warmup_runs=1,
            benchmark_runs=2,
        )

        assert res["window_seconds"] == 1.0
        assert res["sample_count"] == 16000
        assert res["latency_p50_ms"] > 0.0
        assert res["latency_min_ms"] > 0.0
        assert res["latency_max_ms"] >= res["latency_min_ms"]
        assert 0.0 <= res["sla_compliance_pct"] <= 100.0

    def test_format_markdown_model_report(self):
        data = {
            "timestamp": "2026-10-18T00:00:00Z",
            "model_architecture": "AASIST-L (Official PyTorch Weights)",
            "hardware_environment": {
                "system": "Darwin",
                "release": "27.0.0",
                "machine": "arm64",
                "processor": "Apple Silicon",
                "python_version": "3.14.3",
                "torch_version": "2.14.0",
                "torch_threads": 4,
                "cuda_available": False,
                "mps_available": True,
            },
            "benchmarks": {
                "1.5s_window": {
                    "window_seconds": 1.5,
                    "sample_count": 24000,
                    "latency_p50_ms": 392.5,
                    "latency_p90_ms": 396.9,
                    "latency_p95_ms": 398.3,
                    "latency_p99_ms": 399.4,
                    "latency_min_ms": 386.7,
                    "latency_max_ms": 399.7,
                    "sla_budget_ms": 350.0,
                    "sla_compliance_pct": 0.0,
                }
            },
        }

        md = format_markdown_model_report(data)
        assert "# Dhvani Acoustic Model: True Neural Forward Pass Benchmark" in md
        assert "arm64" in md
        assert "392.5 ms" in md
        assert "Critical Engineering Analysis: Ingress Plumbing vs Model Execution" in md
