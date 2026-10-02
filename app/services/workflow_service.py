import datetime
import json
import logging
import os
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_RULES: List[Dict[str, Any]] = [
    {
        "tier": "LOW",
        "min_score": 0,
        "max_score": 34,
        "label": "Normal Conversation",
        "color": "emerald",
        "actions": ["ALLOW_STREAM"],
    },
    {
        "tier": "MODERATE",
        "min_score": 35,
        "max_score": 70,
        "label": "Step-up Warning & Liveness",
        "color": "amber",
        "actions": [
            "STEP_UP_LIVENESS_CHALLENGE",
            "DISPATCH_USER_SMS_ADVISORY",
            "REQUIRE_SECONDARY_VERIFICATION",
        ],
    },
    {
        "tier": "HIGH",
        "min_score": 71,
        "max_score": 100,
        "label": "Active Fraud Defense",
        "color": "rose",
        "actions": [
            "PAUSE_TRANSACTION",
            "ALERT_FRAUD_DESK",
            "DISPATCH_WEBHOOK",
            "TERMINATE_SESSION",
        ],
    },
]


class WorkflowService:
    """
    Configurable Workflow & Automated Countermeasure Policy Engine.

    Features:
    - Thread-safe access via threading.RLock.
    - Atomic JSON persistence to data/workflow_rules.json.
    - Real-time dynamic evaluation without restarting servers.
    - Seamless reset to official SIH baseline thresholds.
    """

    def __init__(self, rules_path: Optional[Path] = None):
        self._lock = threading.RLock()
        settings = get_settings()
        if rules_path is not None:
            self._rules_path = Path(rules_path)
        else:
            self._rules_path = settings.workflow_rules_path
        self._ensure_dir()
        self._init_file_if_missing()

    @property
    def rules_path(self) -> Path:
        return self._rules_path

    def _ensure_dir(self) -> None:
        self._rules_path.parent.mkdir(parents=True, exist_ok=True)

    def _init_file_if_missing(self) -> None:
        """Initializes default workflow rules file if it does not exist."""
        if not self._rules_path.exists():
            default_config = {
                "rules": DEFAULT_RULES,
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "is_customized": False,
            }
            self._write_config_unlocked(default_config)

    def _read_config_unlocked(self) -> Dict[str, Any]:
        if not self._rules_path.exists():
            return {
                "rules": DEFAULT_RULES,
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "is_customized": False,
            }

        try:
            content = self._rules_path.read_text(encoding="utf-8").strip()
            if not content:
                return {"rules": DEFAULT_RULES, "is_customized": False}
            data = json.loads(content)
            if isinstance(data, dict) and "rules" in data:
                return data
            return {"rules": DEFAULT_RULES, "is_customized": False}
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Error reading workflow rules file %s (%s); returning defaults", self._rules_path, exc)
            return {"rules": DEFAULT_RULES, "is_customized": False}

    def _write_config_unlocked(self, config: Dict[str, Any]) -> None:
        self._ensure_dir()
        temp_filename = f"{self._rules_path.name}.tmp_{uuid.uuid4().hex}"
        temp_path = self._rules_path.parent / temp_filename

        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())

            os.replace(temp_path, self._rules_path)
        except Exception as exc:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            logger.error("Failed to atomically write workflow config to %s: %s", self._rules_path, exc)
            raise exc

    def get_workflow_config(self) -> Dict[str, Any]:
        """Retrieves active workflow rules and customization status."""
        with self._lock:
            return self._read_config_unlocked()

    def update_workflow_config(self, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validates and updates workflow rules in real-time.
        Immediately affects subsequent threat scoring.
        """
        if not isinstance(rules, list) or len(rules) == 0:
            raise ValueError("Rules must be a non-empty list of rule objects.")

        # Validate each rule
        for r in rules:
            if "min_score" not in r or "max_score" not in r or "tier" not in r:
                raise ValueError("Each rule must specify 'tier', 'min_score', and 'max_score'.")
            if r["min_score"] < 0 or r["max_score"] > 100 or r["min_score"] > r["max_score"]:
                raise ValueError(f"Invalid score bounds: {r.get('min_score')} to {r.get('max_score')}")

        sorted_rules = sorted(rules, key=lambda x: x["min_score"])
        if sorted_rules[0]["min_score"] != 0:
            raise ValueError("Workflow rules must begin at min_score = 0.")
        if sorted_rules[-1]["max_score"] != 100:
            raise ValueError("Workflow rules must terminate at max_score = 100.")

        for i in range(1, len(sorted_rules)):
            prev = sorted_rules[i - 1]
            curr = sorted_rules[i]
            if curr["min_score"] != prev["max_score"] + 1:
                raise ValueError(
                    f"Gap or overlap detected between tiers: [{prev['min_score']}-{prev['max_score']}] "
                    f"and [{curr['min_score']}-{curr['max_score']}]."
                )

        rules = sorted_rules

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        is_custom = json.dumps(rules, sort_keys=True) != json.dumps(DEFAULT_RULES, sort_keys=True)

        config = {
            "rules": rules,
            "last_updated": now_iso,
            "is_customized": is_custom,
        }

        with self._lock:
            self._write_config_unlocked(config)
            logger.info("Updated workflow policy configuration. is_customized=%s", is_custom)

        return config

    def reset_to_defaults(self) -> Dict[str, Any]:
        """Resets workflow rules to standard factory baseline."""
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        config = {
            "rules": DEFAULT_RULES,
            "last_updated": now_iso,
            "is_customized": False,
        }
        with self._lock:
            self._write_config_unlocked(config)
            logger.info("Reset workflow policy configuration to factory baseline.")
        return config

    def evaluate_score(self, threat_score: int) -> Dict[str, Any]:
        """
        Dynamically matches composite threat score against configured rules.
        """
        clamped = max(0, min(100, int(round(threat_score))))
        config = self.get_workflow_config()
        rules = config.get("rules", DEFAULT_RULES)

        matched_rule = None
        for r in rules:
            if r["min_score"] <= clamped <= r["max_score"]:
                matched_rule = r
                break

        if not matched_rule:
            # Fallback to nearest rule if gap exists
            matched_rule = rules[-1] if clamped > 50 else rules[0]

        actions = set(matched_rule.get("actions", []))
        tier_str = matched_rule.get("tier", "LOW").upper()

        return {
            "tier": tier_str,
            "label": matched_rule.get("label", tier_str),
            "color": matched_rule.get("color", "emerald"),
            "actions": list(actions),
            "challenge_required": (
                "STEP_UP_LIVENESS_CHALLENGE" in actions
                or "REQUIRE_SECONDARY_VERIFICATION" in actions
                or "PAUSE_TRANSACTION" in actions
            ),
            "pause_transaction": "PAUSE_TRANSACTION" in actions,
            "alert_fraud_desk": "ALERT_FRAUD_DESK" in actions,
            "dispatch_sms": (
                "DISPATCH_USER_SMS_ADVISORY" in actions
                or "ALERT_FRAUD_DESK" in actions
            ),
            "dispatch_webhook": "DISPATCH_WEBHOOK" in actions,
            "terminate_session": "TERMINATE_SESSION" in actions,
            "is_customized": config.get("is_customized", False),
        }

    def get_thresholds(self) -> Tuple[int, int]:
        """
        Returns (moderate_min, high_min) score cutoffs.
        """
        config = self.get_workflow_config()
        rules = config.get("rules", DEFAULT_RULES)
        mod_min = 35
        high_min = 71

        for r in rules:
            tier = r.get("tier", "").upper()
            if tier in ("MODERATE", "MEDIUM"):
                mod_min = r.get("min_score", 35)
            elif tier == "HIGH":
                high_min = r.get("min_score", 71)

        return mod_min, high_min


# Global singleton instance
workflow_service = WorkflowService()
