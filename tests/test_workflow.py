import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.workflow_service import WorkflowService, workflow_service
from app.core.security_engine import security_engine
from app.schemas.risk_schema import ThreatTier, RecommendedAction

client = TestClient(app)


def test_workflow_service_defaults(tmp_path):
    rules_file = tmp_path / "test_rules.json"
    svc = WorkflowService(rules_path=rules_file)

    config = svc.get_workflow_config()
    assert "rules" in config
    assert len(config["rules"]) == 3

    # Test scoring evaluations
    low_eval = svc.evaluate_score(20)
    assert low_eval["tier"] == "LOW"
    assert "ALLOW_STREAM" in low_eval["actions"]
    assert low_eval["challenge_required"] is False

    mod_eval = svc.evaluate_score(50)
    assert mod_eval["tier"] == "MODERATE"
    assert "STEP_UP_LIVENESS_CHALLENGE" in mod_eval["actions"]
    assert mod_eval["challenge_required"] is True

    high_eval = svc.evaluate_score(85)
    assert high_eval["tier"] == "HIGH"
    assert "ALERT_FRAUD_DESK" in high_eval["actions"]
    assert high_eval["challenge_required"] is True

    # Test thresholds helper
    mod_min, high_min = svc.get_thresholds()
    assert mod_min == 35
    assert high_min == 71


def test_workflow_service_update_and_reset(tmp_path):
    rules_file = tmp_path / "test_rules_update.json"
    svc = WorkflowService(rules_path=rules_file)

    custom_rules = [
        {"tier": "LOW", "min_score": 0, "max_score": 19, "actions": ["ALLOW_STREAM"]},
        {"tier": "MODERATE", "min_score": 20, "max_score": 59, "actions": ["STEP_UP_LIVENESS"]},
        {"tier": "HIGH", "min_score": 60, "max_score": 100, "actions": ["TERMINATE_AND_ALERT_FRAUD_DESK", "PAUSE_TRANSACTION"]},
    ]

    updated = svc.update_workflow_config(custom_rules)
    assert updated["rules"][1]["max_score"] == 59
    assert updated["rules"][2]["min_score"] == 60

    # Under new rules, score 25 is MODERATE instead of LOW
    eval_25 = svc.evaluate_score(25)
    assert eval_25["tier"] == "MODERATE"

    # Score 65 is now HIGH
    eval_65 = svc.evaluate_score(65)
    assert eval_65["tier"] == "HIGH"

    # Reset
    reset_config = svc.reset_to_defaults()
    assert reset_config["rules"][0]["max_score"] == 34
    assert reset_config["rules"][1]["min_score"] == 35
    assert svc.evaluate_score(25)["tier"] == "LOW"


def test_workflow_validation_errors(tmp_path):
    rules_file = tmp_path / "test_rules_err.json"
    svc = WorkflowService(rules_path=rules_file)

    # Invalid range: doesn't start at 0
    with pytest.raises(ValueError):
        svc.update_workflow_config([
            {"tier": "LOW", "min_score": 10, "max_score": 100, "actions": []}
        ])

    # Gap in coverage
    with pytest.raises(ValueError):
        svc.update_workflow_config([
            {"tier": "LOW", "min_score": 0, "max_score": 40, "actions": []},
            {"tier": "HIGH", "min_score": 50, "max_score": 100, "actions": []},
        ])


def test_workflow_api_endpoints():
    # 1. GET /api/v1/workflow/rules
    res = client.get("/api/v1/workflow/rules")
    assert res.status_code == 200
    data = res.json()
    assert "rules" in data
    assert len(data["rules"]) >= 3

    # 2. PUT /api/v1/workflow/rules
    update_payload = {
        "rules": [
            {"tier": "LOW", "min_score": 0, "max_score": 29, "actions": ["ALLOW_STREAM"]},
            {"tier": "MODERATE", "min_score": 30, "max_score": 69, "actions": ["STEP_UP_LIVENESS", "REQUIRE_SECONDARY_VERIFICATION"]},
            {"tier": "HIGH", "min_score": 70, "max_score": 100, "actions": ["TERMINATE_AND_ALERT_FRAUD_DESK", "PAUSE_TRANSACTION"]},
        ]
    }
    res_put = client.put("/api/v1/workflow/rules", json=update_payload)
    assert res_put.status_code == 200
    assert res_put.json()["status"] == "success"

    # Verify security engine map_tier_and_action picks up immediately
    tier, action, challenge = security_engine._map_tier_and_action(31)
    assert tier == ThreatTier.MEDIUM
    assert challenge is True

    # 3. POST /api/v1/workflow/rules/reset
    res_reset = client.post("/api/v1/workflow/rules/reset")
    assert res_reset.status_code == 200
    reset_data = res_reset.json()
    assert reset_data["config"]["rules"][0]["max_score"] == 34
