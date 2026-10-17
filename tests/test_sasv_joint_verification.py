"""
Unit tests for Joint Spoofing-Aware Speaker Verification (SASV) fusion and benchmarking.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.sasv_fusion_service import sasv_service

client = TestClient(app)


def test_target_bona_fide_verdict():
    """Authentic customer voice with matching enrolled voiceprint should be ALLOWED."""
    res = sasv_service.compute_joint_verdict(
        cm_synthetic_prob=0.04,
        asv_similarity=0.92,
        transfer_amount_inr=150000.0,
        customer_account_id="HDFC-CORP-4820",
    )
    assert res["decision"] == "PASSED"
    assert res["threat_classification"] == "TARGET_BONA_FIDE"
    assert res["recommendation"] == "ALLOW"
    assert res["joint_sasv_score"] >= 0.75


def test_spoofed_target_clone_verdict():
    """Generative AI clone matching customer voiceprint must be BLOCKED and escalated."""
    res = sasv_service.compute_joint_verdict(
        cm_synthetic_prob=0.94,
        asv_similarity=0.89,
        transfer_amount_inr=2500000.0,
        customer_account_id="SBI-CORP-9104",
    )
    assert res["decision"] == "FAILED"
    assert res["threat_classification"] == "SPOOFED_TARGET_CLONE"
    assert res["recommendation"] == "BLOCK_AND_ESCALATE"
    assert "vocoder artifacts" in res["analyst_narrative"]


def test_zero_effort_impostor_verdict():
    """Natural human speech from an unregistered caller must fail speaker verification."""
    res = sasv_service.compute_joint_verdict(
        cm_synthetic_prob=0.05,
        asv_similarity=0.22,
        transfer_amount_inr=50000.0,
        customer_account_id="ICICI-RETAIL-1002",
    )
    assert res["decision"] == "FAILED"
    assert res["threat_classification"] == "ZERO_EFFORT_IMPOSTOR"
    assert res["recommendation"] == "REJECT_BIOMETRIC_FAIL"


def test_synthetic_zero_effort_impostor_verdict():
    """Synthetic speech that does not match customer baseline should be blocked."""
    res = sasv_service.compute_joint_verdict(
        cm_synthetic_prob=0.88,
        asv_similarity=0.15,
        transfer_amount_inr=100000.0,
        customer_account_id="AXIS-CORP-3301",
    )
    assert res["decision"] == "FAILED"
    assert res["threat_classification"] == "SYNTHETIC_ZERO_EFFORT_IMPOSTOR"
    assert res["recommendation"] == "BLOCK_IMPOSTOR"


def test_high_value_strict_threshold():
    """High value transfers (>= Rs 5 Lakh) enforce strict 0.75 SASV threshold."""
    # Marginal borderline case
    res_standard = sasv_service.compute_joint_verdict(
        cm_synthetic_prob=0.28,
        asv_similarity=0.72,
        transfer_amount_inr=50000.0,
    )
    res_strict = sasv_service.compute_joint_verdict(
        cm_synthetic_prob=0.28,
        asv_similarity=0.72,
        transfer_amount_inr=1000000.0,
    )
    assert res_standard["operating_threshold"] == 0.55
    assert res_strict["operating_threshold"] == 0.75
    assert res_strict["risk_profile"] == "HIGH_VALUE_STRICT"


def test_sasv_frozen_benchmark():
    """Evaluates SASV EER and Banking actDCF across all three trial sets."""
    bench = sasv_service.evaluate_sasv_benchmark(n_trials=100, random_seed=42)
    assert bench["compliance_status"] == "EXCEEDS_BANKING_SASV_STANDARDS"
    assert "metrics" in bench
    assert bench["metrics"]["joint_sasv_eer_percent"] <= 5.0
    assert bench["metrics"]["sasv_act_dcf"] <= 0.05
    assert bench["sample_counts"]["total_evaluations"] == 300


def test_api_sasv_endpoints():
    """Verifies FastAPI router for SASV."""
    r1 = client.post("/api/v1/sasv/joint-verdict", json={
        "cm_synthetic_prob": 0.03,
        "asv_similarity": 0.94,
        "transfer_amount_inr": 200000.0,
        "customer_account_id": "TEST-CUST-01",
    })
    assert r1.status_code == 200
    assert r1.json()["decision"] == "PASSED"
    assert r1.json()["threat_classification"] == "TARGET_BONA_FIDE"

    r2 = client.get("/api/v1/sasv/benchmark")
    assert r2.status_code == 200
    assert r2.json()["benchmark_version"] == "SASV-2026-V1"
