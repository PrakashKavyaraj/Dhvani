import pytest
from app.integrations.banking_bridge import BankingBridgeService, banking_bridge
from app.services.database_service import DatabaseService


def test_banking_pre_auth_evaluation_low_risk(tmp_path):
    """
    Verifies that low threat voice analysis produces ISO 8583 Code '00' (Approved).
    """
    json_path = tmp_path / "analysis_records.json"
    sqlite_path = tmp_path / "dhvani.db"
    db = DatabaseService(db_path=json_path, sqlite_path=sqlite_path)

    # Low risk record
    record = {
        "voiceprint_sha256": "low_risk_hash_001",
        "analysis_id": "anlz_clean_001",
        "risk_score": 18,
        "risk_level": "LOW",
        "synthetic_speech_probability": 0.04,
    }
    db.save_record(record)

    service = BankingBridgeService()
    # Evaluate pre-auth
    result = service.evaluate_pre_auth(
        voiceprint_sha256="low_risk_hash_001",
        customer_id="cust_9988",
        transaction_amount_inr=50000.0,
        liveness_verified=True,
        biometric_similarity=0.92,
    )

    assert result["status"] == "EVALUATED"
    assert result["iso_response_code"] == "00"  # ISO Approved
    assert result["pre_auth_action"] == "APPROVE"
    assert result["decision"] == "ALLOW_TRANSACTION"
    assert result["compliance_headers"]["X-Dhvani-ISO8583-Code"] == "00"
    assert result["compliance_headers"]["X-Dhvani-PreAuth-Action"] == "APPROVE"


def test_banking_pre_auth_evaluation_fraud_intercept():
    """
    Verifies that failed liveness or high risk produces ISO 8583 Code '59' (Suspected Fraud)
    and triggers PAUSE_UPI_TRANSFER.
    """
    service = BankingBridgeService()

    # Case 1: Liveness challenge failed (active clone lag)
    result_clone = service.evaluate_pre_auth(
        customer_id="cust_intercept_12",
        transaction_amount_inr=150000.0,
        liveness_verified=False,  # Failed liveness
    )
    assert result_clone["iso_response_code"] == "59"
    assert result_clone["pre_auth_action"] == "PAUSE_UPI_TRANSFER"
    assert result_clone["decision"] == "INTERCEPT_AND_HOLD"
    assert result_clone["compliance_headers"]["X-Dhvani-ISO8583-Code"] == "59"

    # Case 2: Voiceprint biometric impersonator (similarity < 0.50)
    result_impersonator = service.evaluate_pre_auth(
        customer_id="cust_intercept_12",
        transaction_amount_inr=25000.0,
        liveness_verified=True,
        biometric_similarity=0.25,  # Impersonator
    )
    assert result_impersonator["iso_response_code"] == "59"
    assert result_impersonator["pre_auth_action"] == "PAUSE_UPI_TRANSFER"


def test_telephony_streaming_simulation():
    """
    Verifies carrier-grade RTP packet streaming simulation (20ms frames).
    """
    service = BankingBridgeService()
    sim_result = service.simulate_telephony_stream(
        duration_seconds=1.0,
        sample_rate=16000,
        packet_duration_ms=20,
    )

    assert sim_result["status"] == "TELEPHONY_STREAM_SIMULATED"
    assert sim_result["total_packets"] == 50  # 1.0s / 20ms = 50 packets
    assert sim_result["average_packet_latency_us"] < 2000.0  # Ultra-low latency < 2ms per packet
    assert sim_result["jitter_buffer_status"] == "OPTIMAL"


def test_api_banking_endpoints(client):
    """
    Tests REST endpoints /api/v1/banking:
    - POST /pre-auth-evaluate (with HTTP compliance headers)
    - POST /simulate-telephony
    """
    # 1. Pre-auth evaluate
    resp = client.post(
        "/api/v1/banking/pre-auth-evaluate",
        json={
            "customer_id": "cust_rest_test",
            "transaction_amount_inr": 75000.0,
            "liveness_verified": True,
            "biometric_similarity": 0.88,
        },
    )
    assert resp.status_code == 200
    assert "X-Dhvani-ISO8583-Code" in resp.headers
    assert resp.headers["X-Dhvani-ISO8583-Code"] == "00"
    assert resp.headers["X-Dhvani-PreAuth-Action"] == "APPROVE"

    data = resp.json()
    assert data["status"] == "EVALUATED"
    assert data["iso_response_code"] == "00"

    # 2. Simulate telephony
    sim_resp = client.post(
        "/api/v1/banking/simulate-telephony",
        json={
            "duration_seconds": 1.0,
            "packet_duration_ms": 20,
            "sample_rate": 16000,
        },
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["total_packets"] == 50
    assert sim_data["status"] == "TELEPHONY_STREAM_SIMULATED"
