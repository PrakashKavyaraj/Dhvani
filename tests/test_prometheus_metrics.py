"""
Unit tests for Prometheus Observability and Metrics Service.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.metrics_service import metrics_service

client = TestClient(app)


def test_metrics_service_recording():
    # Record latency
    metrics_service.observe_inference_latency(0.12, tenant_id="HDFC-BANK", model="Forensics-0.3B")
    metrics_service.observe_inference_latency(0.24, tenant_id="HDFC-BANK", model="Forensics-0.3B")
    metrics_service.observe_inference_latency(0.42, tenant_id="HDFC-BANK", model="Forensics-0.3B")

    # Record audio ingested
    metrics_service.record_audio_ingested(12.5, carrier="exotel", codec="g711_ulaw", tenant_id="HDFC-BANK")

    # Record fraud verdict
    metrics_service.record_fraud_verdict("ALLOW", tenant_id="HDFC-BANK")
    metrics_service.record_fraud_verdict("BLOCK_AND_ESCALATE", tenant_id="HDFC-BANK")

    # Record SASV verdict
    metrics_service.record_sasv_verdict("TARGET_BONA_FIDE", "PASSED", tenant_id="HDFC-BANK")

    # Record circuit breaker trip
    metrics_service.record_circuit_breaker_trip("TIMEOUT_EXCEEDED", tenant_id="HDFC-BANK")

    text = metrics_service.export_metrics_text()
    assert "dhvani_system_up 1.0" in text
    assert "dhvani_telephony_sla_budget_seconds 0.35" in text
    assert "dhvani_telephony_audio_ingested_seconds_total" in text
    assert "dhvani_fraud_verdict_total" in text
    assert "dhvani_sasv_evaluations_total" in text
    assert "dhvani_inference_latency_seconds_bucket" in text
    assert "dhvani_inference_latency_seconds_count" in text


def test_prometheus_endpoint():
    # Scrape root /metrics
    r1 = client.get("/metrics")
    assert r1.status_code == 200
    assert "text/plain" in r1.headers["content-type"]
    assert "dhvani_system_up" in r1.text

    # Scrape /api/v1/metrics
    r2 = client.get("/api/v1/metrics")
    assert r2.status_code == 200
    assert "text/plain" in r2.headers["content-type"]
    assert "dhvani_inference_latency_seconds" in r2.text
