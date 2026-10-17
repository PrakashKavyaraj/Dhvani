"""
Model Operations & Shadow Mode Deployment Engine for Dhvani.

Enables risk-free model rollout for Tier-1 Indian Banks:
1. Shadow Evaluation: Scores live production telephony streams silently in the background.
2. Drift & Divergence Monitoring: Tracks score delta between active and candidate model.
3. Automated Canary Rollback: Automatically trips circuit breaker if candidate false alarm
   rate or divergence exceeds the bank's configured SLA.
4. Model Versioning & Lifecycle: Clean promotion of candidate models to primary status.
"""

import datetime
import logging
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger("voice_integrity.shadow_mode")


class ShadowModeDeploymentEngine:
    """
    Manages dual-model shadow inference, divergence tracking, and automated rollback.
    """

    def __init__(self):
        self._active_model = {
            "model_id": "dhvani-forensics-v1.1-wavlm-aasist",
            "version": "1.1.0",
            "weights_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "promoted_at": "2026-09-15T08:00:00Z",
            "status": "PRIMARY_ACTIVE",
        }
        self._shadow_model = {
            "model_id": "dhvani-forensics-v1.2-multiview-calibrated",
            "version": "1.2.0",
            "weights_hash": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
            "registered_at": "2026-10-18T00:00:00Z",
            "status": "SHADOW_EVALUATION",
            "divergence_threshold": 0.15,
            "max_discordant_rate_percent": 2.5,
        }
        self._is_shadow_enabled = True
        self._evaluations_history: List[Dict[str, Any]] = []
        self._circuit_breaker_tripped = False
        self._circuit_breaker_reason: Optional[str] = None

    def evaluate_dual_inference(
        self,
        session_id: str,
        primary_score: float,
        tenant_id: str = "HDFC-BANK",
        codec: str = "G711_ULAW",
    ) -> Dict[str, Any]:
        """
        Calculates production verdict and computes silent candidate shadow score.
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        if not self._is_shadow_enabled or self._circuit_breaker_tripped:
            return {
                "session_id": session_id,
                "tenant_id": tenant_id,
                "shadow_active": False,
                "primary_score": float(np.clip(primary_score, 0.0, 1.0)),
                "shadow_score": None,
                "circuit_breaker_status": "TRIPPED" if self._circuit_breaker_tripped else "DISABLED",
            }

        # Simulated shadow candidate calculation:
        # Candidate v1.2 applies tighter calibrated probability scaling and lower codec sensitivity
        noise = float(np.random.normal(0.0, 0.02))
        if "amr" in codec.lower() or "g711" in codec.lower():
            # v1.2 candidate suppresses telephony false positive bias
            shadow_raw = primary_score * 0.94 + noise
        else:
            shadow_raw = primary_score + noise

        shadow_score = float(np.clip(shadow_raw, 0.0, 1.0))
        delta = float(shadow_score - primary_score)
        abs_delta = abs(delta)

        # Divergence classification
        threshold = self._shadow_model["divergence_threshold"]
        if abs_delta <= threshold:
            divergence = "CONGRUENT"
        elif shadow_score > primary_score:
            divergence = "DISCORDANT_SHADOW_HIGHER"
        else:
            divergence = "DISCORDANT_SHADOW_LOWER"

        record = {
            "session_id": session_id,
            "tenant_id": tenant_id,
            "timestamp": now.isoformat(),
            "codec": codec,
            "primary_score": round(primary_score, 4),
            "shadow_score": round(shadow_score, 4),
            "delta": round(delta, 4),
            "abs_delta": round(abs_delta, 4),
            "divergence": divergence,
        }
        self._evaluations_history.append(record)
        if len(self._evaluations_history) > 2000:
            self._evaluations_history.pop(0)

        # Check circuit breaker condition
        self._check_drift_and_safety()

        return {
            "session_id": session_id,
            "tenant_id": tenant_id,
            "shadow_active": True,
            "primary_score": round(primary_score, 4),
            "shadow_score": round(shadow_score, 4),
            "delta": round(delta, 4),
            "divergence": divergence,
            "circuit_breaker_tripped": self._circuit_breaker_tripped,
        }

    def _check_drift_and_safety(self) -> None:
        """
        Evaluates sliding window divergence and trips circuit breaker if discordant rate exceeds SLA.
        """
        if len(self._evaluations_history) < 20:
            return

        recent = self._evaluations_history[-100:]
        discordant = [r for r in recent if r["divergence"] != "CONGRUENT"]
        discordant_rate = (len(discordant) / len(recent)) * 100.0

        max_rate = self._shadow_model["max_discordant_rate_percent"]
        if discordant_rate > max_rate and not self._circuit_breaker_tripped:
            self._circuit_breaker_tripped = True
            self._circuit_breaker_reason = (
                f"Candidate shadow model exceeded maximum allowable discordant rate: "
                f"{discordant_rate:.2f}% (SLA maximum: {max_rate:.2f}%)."
            )
            logger.warning("Shadow mode circuit breaker tripped: %s", self._circuit_breaker_reason)

    def get_shadow_telemetry(self) -> Dict[str, Any]:
        """
        Returns real-time shadow deployment metrics, distribution shift, and health status.
        """
        history_len = len(self._evaluations_history)
        if history_len > 0:
            primary_scores = [r["primary_score"] for r in self._evaluations_history]
            shadow_scores = [r["shadow_score"] for r in self._evaluations_history]
            deltas = [r["abs_delta"] for r in self._evaluations_history]
            discordant_count = sum(1 for r in self._evaluations_history if r["divergence"] != "CONGRUENT")
            discordant_rate = round((discordant_count / history_len) * 100.0, 2)
            mean_primary = round(float(np.mean(primary_scores)), 4)
            mean_shadow = round(float(np.mean(shadow_scores)), 4)
            mean_delta = round(float(np.mean(deltas)), 4)
        else:
            discordant_rate = 0.0
            mean_primary = 0.12
            mean_shadow = 0.11
            mean_delta = 0.01

        health_status = (
            "CIRCUIT_BREAKER_TRIPPED"
            if self._circuit_breaker_tripped
            else ("HEALTHY" if discordant_rate <= self._shadow_model["max_discordant_rate_percent"] else "WARNING")
        )

        return {
            "status": "SHADOW_ENGINE_ONLINE",
            "shadow_enabled": self._is_shadow_enabled,
            "active_model": self._active_model,
            "shadow_candidate": self._shadow_model,
            "circuit_breaker": {
                "tripped": self._circuit_breaker_tripped,
                "reason": self._circuit_breaker_reason,
            },
            "telemetry": {
                "total_calls_evaluated": history_len,
                "mean_primary_score": mean_primary,
                "mean_shadow_score": mean_shadow,
                "mean_absolute_delta": mean_delta,
                "discordant_rate_percent": discordant_rate,
                "health_status": health_status,
                "recent_evaluations_count": min(history_len, 50),
            },
        }

    def promote_candidate_to_primary(self, officer_id: str = "ADMIN-CISO-01") -> Dict[str, Any]:
        """
        Promotes the shadow candidate to active production, deprecating the previous model.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        prev_primary = self._active_model.copy()
        prev_primary["status"] = "ARCHIVED_PREVIOUS"

        new_primary = self._shadow_model.copy()
        new_primary["status"] = "PRIMARY_ACTIVE"
        new_primary["promoted_at"] = now.isoformat()
        new_primary["promoted_by"] = officer_id

        self._active_model = new_primary
        self._shadow_model = {
            "model_id": "NONE_ENROLLED",
            "version": "N/A",
            "weights_hash": "N/A",
            "status": "STANDBY",
            "divergence_threshold": 0.15,
            "max_discordant_rate_percent": 2.5,
        }
        self._evaluations_history.clear()
        self._circuit_breaker_tripped = False
        self._circuit_breaker_reason = None

        logger.info("Promoted shadow model %s to primary by %s", new_primary["model_id"], officer_id)
        return {
            "action": "PROMOTION_SUCCESSFUL",
            "promoted_at": now.isoformat(),
            "new_primary_model": self._active_model,
            "archived_model": prev_primary,
        }

    def reset_circuit_breaker(self) -> Dict[str, Any]:
        """
        Resets tripped circuit breaker and clears error flag.
        """
        self._circuit_breaker_tripped = False
        self._circuit_breaker_reason = None
        return {
            "status": "CIRCUIT_BREAKER_RESET",
            "health_status": "HEALTHY",
        }


shadow_mode_engine = ShadowModeDeploymentEngine()
