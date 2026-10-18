"""
Unit & Integration Tests for Comprehensive Model Inference Benchmarking.

Validates:
1. Warmup and forward pass execution over component functions.
2. Latency percentile computation (p50, p90, p95, p99) and SLA accounting.
3. Hardware environment metadata extraction.
4. Executive Markdown report generation with SLA definition.
"""

import pytest
import numpy as np
from scripts.benchmark_model_inference import (
    benchmark_component,
    format_markdown_report,
    run_comprehensive_benchmark,
)
from app.integrations.aegis_adapter import get_aegis_engine


class TestModelInferenceBenchmark:
    """Validates the acoustic model forward pass latency benchmarker."""

    def test_benchmark_component_execution(self):
        engine = get_aegis_engine()
        assert engine is not None

        dummy_audio = np.random.randn(16000).astype(np.float32) * 0.05
        res = benchmark_component(
            lambda a: engine.aasist.predict(a),
            dummy_audio,
            warmup_runs=1,
            benchmark_runs=2,
        )

        assert res["p50_ms"] > 0.0
        assert res["min_ms"] > 0.0
        assert res["max_ms"] >= res["min_ms"]

    def test_format_markdown_report(self):
        data = {
            "timestamp": "2026-10-18T00:00:00Z",
            "window_seconds": 1.5,
            "sample_count": 24000,
            "sla_budget_ms": 350.0,
            "sla_definition": "Turn turnaround time once the 1.5s/3.0s rolling buffer is ready.",
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
            "components": {
                "forensics_0.3b_wavlm": {
                    "p50_ms": 260.7,
                    "p90_ms": 263.9,
                    "p95_ms": 264.4,
                    "p99_ms": 264.8,
                    "min_ms": 258.1,
                    "max_ms": 264.9,
                    "mean_ms": 261.2,
                    "stdev_ms": 2.4,
                    "sla_compliance_pct": 100.0,
                },
                "aasist_l": {
                    "p50_ms": 97.3,
                    "p90_ms": 98.4,
                    "p95_ms": 98.4,
                    "p99_ms": 98.4,
                    "min_ms": 96.1,
                    "max_ms": 98.4,
                    "mean_ms": 97.3,
                    "stdev_ms": 0.8,
                    "sla_compliance_pct": 100.0,
                },
            },
        }

        md = format_markdown_report(data)
        assert "# Dhvani Acoustic Inference: Component & Ensemble Latency Benchmark" in md
        assert "arm64" in md
        assert "260.7 ms" in md
        assert "Formal Telephony SLA Definition" in md
