"""
Unit & Integration Tests for Dhvani Carrier Telephony Concurrent Load Tester.

Validates:
1. Synthetic G.711 mu-law audio chunk generation.
2. Single-session streaming call simulation with zero-leakage memory wipes.
3. Multi-threaded concurrency load testing across workers.
4. SLA compliance accounting and latency percentile aggregation (p50, p90, p95, p99).
"""

import pytest
from app.services.cpaas_telephony_service import CPaaSTelephonyService
from scripts.load_test_concurrency import (
    generate_synthetic_mulaw_chunk,
    run_concurrency_load_test,
    simulate_single_call,
    format_markdown_load_report,
)


class TestConcurrencyLoadRunner:
    """Validates the multi-worker telephony load testing pipeline."""

    def test_generate_synthetic_mulaw_chunk(self):
        chunk = generate_synthetic_mulaw_chunk(num_samples=160)
        assert isinstance(chunk, str)
        assert len(chunk) > 0

    def test_simulate_single_call_execution(self):
        service = CPaaSTelephonyService(sla_budget_ms=350.0)
        result = simulate_single_call(
            service=service,
            call_index=1,
            total_turns=10,
            fallback_action="STEP_UP",
        )

        assert result["call_index"] == 1
        assert result["stream_sid"] == "STREAM-LOAD-0001"
        assert result["turns_processed"] == 10
        assert len(result["latencies_ms"]) == 10
        assert all(lat >= 0.0 for lat in result["latencies_ms"])
        # Buffer should be wiped upon end_session
        assert service.get_session("STREAM-LOAD-0001") is None

    def test_run_concurrency_load_test_multi_workers(self):
        # Run small concurrency test: 2 workers, 5 turns
        results = run_concurrency_load_test(
            concurrency_levels=[2, 4],
            turns_per_call=5,
            sla_budget_ms=350.0,
        )

        assert "concurrency_benchmarks" in results
        assert "2_calls" in results["concurrency_benchmarks"]
        assert "4_calls" in results["concurrency_benchmarks"]

        bench_2 = results["concurrency_benchmarks"]["2_calls"]
        assert bench_2["concurrent_calls"] == 2
        assert bench_2["total_turns"] == 10
        assert bench_2["latency_p50_ms"] >= 0.0
        assert bench_2["latency_p95_ms"] >= 0.0
        assert bench_2["latency_p99_ms"] >= 0.0
        assert bench_2["sla_compliance_pct"] > 90.0
        assert bench_2["throughput_turns_per_sec"] > 0.0

        md_report = format_markdown_load_report(results)
        assert "# Dhvani Carrier Telephony: Concurrent Load & Latency Report" in md_report
        assert "2" in md_report
