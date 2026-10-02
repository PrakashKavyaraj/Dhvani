import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.alert_service import AlertDispatcher

client = TestClient(app)


def test_alert_dispatcher_tiers(tmp_path):
    outbox_file = tmp_path / "test_outbox.json"
    dispatcher = AlertDispatcher(outbox_path=outbox_file)

    # 1. Low risk (<35) -> 0 alerts
    low_record = {"analysis_id": "test_low", "risk_score": 15}
    dispatched_low = dispatcher.dispatch_for_analysis(low_record)
    assert len(dispatched_low) == 0

    # 2. Moderate risk (35-70) -> 3 alerts (SMS, Webhook, Fraud Desk Standby)
    mod_record = {"analysis_id": "test_mod", "risk_score": 55}
    dispatched_mod = dispatcher.dispatch_for_analysis(mod_record)
    assert len(dispatched_mod) == 3
    channels_mod = {a["channel"] for a in dispatched_mod}
    assert channels_mod == {"SMS", "WEBHOOK", "FRAUD_DESK"}

    # 3. High risk (>=71) -> 4 alerts (Fraud Desk, SMS, Webhook, Email)
    high_record = {
        "analysis_id": "test_high",
        "risk_score": 88,
        "voiceprint_sha256": "f" * 64,
        "recommendation": "Perform independent secondary verification",
    }
    dispatched_high = dispatcher.dispatch_for_analysis(high_record)
    assert len(dispatched_high) == 4
    channels_high = {a["channel"] for a in dispatched_high}
    assert channels_high == {"FRAUD_DESK", "SMS", "WEBHOOK", "EMAIL"}

    # 4. Verify file persistence and query
    all_alerts = dispatcher.get_alerts(limit=50)
    assert len(all_alerts) == 7
    assert outbox_file.exists()


def test_api_alerts_endpoints():
    # Test POST /api/v1/alerts/test
    res = client.post(
        "/api/v1/alerts/test",
        json={
            "channel": "ALL",
            "risk_score": 92,
            "custom_message": "SIH automated test trigger",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["dispatched_count"] == 4

    # Test GET /api/v1/alerts
    get_res = client.get("/api/v1/alerts?limit=10")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert "alerts" in get_data
    assert get_data["total"] >= 4

    # Test Mock Webhook loopback receiver
    wh_res = client.post(
        "/api/v1/alerts/mock-webhook",
        json={
            "event": "VOICE_SECURITY_THREAT_DETECTED",
            "severity": "CRITICAL",
            "analysis_id": "test_wh",
            "risk_score": 95,
        },
    )
    assert wh_res.status_code == 200
    assert wh_res.json()["status"] == "acknowledged"

    # Test POST /api/v1/alerts/secondary-verification
    vfy_res = client.post(
        "/api/v1/alerts/secondary-verification",
        json={
            "analysis_id": "anl_test_secondary_vfy",
            "method": "OUT_OF_BAND_SMS_OTP",
            "verified_by": "CUSTOMER_MOBILE (+91-98765-XXXXX)",
            "verification_code": "749210",
            "transaction_amount_inr": 50000.0,
        },
    )
    assert vfy_res.status_code == 200
    vfy_data = vfy_res.json()
    assert vfy_data["status"] == "success"
    assert vfy_data["transaction_status"] == "RELEASED"
    assert "audit_record" in vfy_data

