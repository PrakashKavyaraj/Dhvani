import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Query, status
from pydantic import BaseModel, Field

from app.core.logging import logger
from app.services.alert_service import alert_dispatcher

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])


class TestAlertRequest(BaseModel):
    channel: str = Field("ALL", description="Target channel: 'ALL', 'FRAUD_DESK', 'SMS', 'WEBHOOK', 'EMAIL'")
    risk_score: int = Field(85, ge=0, le=100, description="Risk score to evaluate (0-100)")
    analysis_id: Optional[str] = Field(None, description="Optional analysis identifier")
    custom_message: Optional[str] = Field(None, description="Optional custom operational message")


@router.get("", status_code=status.HTTP_200_OK)
def get_alerts(
    limit: int = Query(20, ge=1, le=200, description="Max number of alerts to return"),
    analysis_id: Optional[str] = Query(None, description="Filter by analysis ID"),
    channel: Optional[str] = Query(None, description="Filter by channel"),
):
    """
    Retrieves recent multi-channel security alerts from the outbox.
    """
    alerts = alert_dispatcher.get_alerts(limit=limit, analysis_id=analysis_id, channel=channel)
    return {
        "total": len(alerts),
        "alerts": alerts,
    }


@router.post("/test", status_code=status.HTTP_201_CREATED)
def trigger_test_alert(payload: TestAlertRequest = Body(...)):
    """
    Test-fires multi-channel alerts on-demand for live SIH jury demonstration.
    """
    dispatched = alert_dispatcher.dispatch_test_alert(
        channel=payload.channel,
        risk_score=payload.risk_score,
        analysis_id=payload.analysis_id,
        custom_message=payload.custom_message,
    )
    return {
        "status": "success",
        "channel": payload.channel,
        "dispatched_count": len(dispatched),
        "alerts": dispatched,
    }


@router.post("/mock-webhook", status_code=status.HTTP_200_OK)
def mock_webhook_receiver(payload: Dict[str, Any] = Body(...)):
    """
    Built-in loopback mock webhook endpoint for offline SIH hackathon environments.
    Receives and acknowledges core banking SIEM JSON event notifications.
    """
    logger.info("Mock Banking SIEM received webhook event: %s", payload.get("event"))
    return {
        "status": "acknowledged",
        "server": "Dhvani-CoreBanking-SIEM-MockGateway/1.0",
        "received_at": time.time(),
        "event_type": payload.get("event", "UNKNOWN"),
        "analysis_id": payload.get("analysis_id"),
        "policy_action": payload.get("policy_enforcement", "ACK"),
    }


class SecondaryVerificationRequest(BaseModel):
    analysis_id: str = Field(..., description="Target analysis ID")
    method: str = Field("OTP", description="'OTP' or 'SUPERVISOR_OVERRIDE'")
    verified_by: str = Field("CUSTOMER_MOBILE", description="Entity who verified ('CUSTOMER_MOBILE' or supervisor badge)")
    verification_code: Optional[str] = Field(None, description="Entered code")
    reason: Optional[str] = Field(None, description="Override justification if supervisor")
    transaction_amount_inr: Optional[float] = Field(50000.0, description="Amount in INR")


@router.post("/secondary-verification", status_code=status.HTTP_200_OK)
def record_secondary_verification(payload: SecondaryVerificationRequest = Body(...)):
    """
    Records completed out-of-band secondary verification or supervisor override,
    releasing paused bank transactions and appending an audit record.
    """
    import datetime
    now_ts = time.time()
    iso_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    audit_id = f"vfy_{payload.analysis_id[-8:] if len(payload.analysis_id) >= 8 else payload.analysis_id}_{int(now_ts)}"

    record = {
        "alert_id": audit_id,
        "analysis_id": payload.analysis_id,
        "timestamp": now_ts,
        "iso_timestamp": iso_ts,
        "channel": "FRAUD_DESK",
        "severity": "RESOLVED",
        "recipient": "Cyber Fraud Operations Center & Core Banking",
        "title": f"✓ Secondary Verification Approved ({payload.method})",
        "message": (
            f"Transaction of ₹{payload.transaction_amount_inr:,.2f} released for analysis {payload.analysis_id}. "
            f"Verified via {payload.method} by {payload.verified_by}."
        ),
        "status": "VERIFIED_AND_RELEASED",
        "delivery_metadata": {
            "method": payload.method,
            "verified_by": payload.verified_by,
            "reason": payload.reason or "Customer passed out-of-band challenge",
            "amount_inr": payload.transaction_amount_inr,
        },
        "payload": {
            "analysis_id": payload.analysis_id,
            "status": "UNLOCKED",
            "audit_signature": f"HMAC_VERIFIED_{audit_id}",
        },
    }

    alert_dispatcher._save_dispatched([record])
    logger.info(
        "Secondary verification recorded for %s | Method: %s | Verified By: %s",
        payload.analysis_id,
        payload.method,
        payload.verified_by,
    )
    return {
        "status": "success",
        "transaction_status": "RELEASED",
        "audit_record": record,
    }


@router.post("/clear", status_code=status.HTTP_200_OK)
def clear_alerts():
    """
    Resets outbox records for fresh jury demonstrations.
    """
    alert_dispatcher.clear_alerts()
    return {"status": "cleared", "message": "Alerts outbox has been reset"}
