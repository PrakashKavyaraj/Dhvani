"""
Multi-Tenant Security Policy & Access Control Service for Dhvani.

Features:
1. Bank-Specific Risk Thresholds:
   Each financial institution operates with customized fraud risk tolerances:
   - Corporate Treasury Desks (ICICI-CORP, AXIS-WEALTH): Stricter block thresholds (50%) and tight SLAs (200ms).
   - Retail Contact Centers (HDFC-BANK, SBI-RETAIL): Standard block thresholds (70-75%) and resilient SLAs (350-400ms).
2. API Key Authentication & Tenant Routing:
   Resolves client requests to isolated bank tenant contexts via X-API-Key and X-Tenant-ID headers.
3. Telemetry & Rate Auditing:
   Tracks per-tenant query volumes, intercepted fraud attempts, and SLA circuit breaker trips.
"""

import hashlib
import logging
import time
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger("voice_integrity.tenant_policy")


@dataclass
class TenantPolicy:
    tenant_id: str
    institution_name: str
    tier: str  # "RETAIL_BANKING", "CORPORATE_TREASURY", "WEALTH_MANAGEMENT"
    block_threshold: int = 70
    step_up_threshold: int = 35
    sla_budget_ms: float = 350.0
    fail_open_enabled: bool = True
    fail_open_action: str = "STEP_UP"  # "STEP_UP" or "ALLOW_CALL_FLAGGED"
    api_key_hash: Optional[str] = None
    rate_limit_rpm: int = 1200
    created_at: float = field(default_factory=time.time)
    request_count: int = 0
    intercept_count: int = 0
    circuit_trip_count: int = 0
    disclaimer: str = "Simulated demonstration profile for architectural validation. No institutional endorsement or relationship implied."


DEFAULT_TENANT_POLICIES: Dict[str, TenantPolicy] = {
    "HDFC-BANK": TenantPolicy(
        tenant_id="HDFC-BANK",
        institution_name="Simulation Tenant: HDFC Retail Architecture Profile (Demo)",
        tier="RETAIL_BANKING",
        block_threshold=70,
        step_up_threshold=35,
        sla_budget_ms=350.0,
        fail_open_enabled=True,
        fail_open_action="ALLOW_CALL_FLAGGED",
        api_key_hash=hashlib.sha256(b"dhvani_live_hdfc_key_2026").hexdigest(),
        rate_limit_rpm=3000,
    ),
    "SBI-RETAIL": TenantPolicy(
        tenant_id="SBI-RETAIL",
        institution_name="Simulation Tenant: SBI IVR Architecture Profile (Demo)",
        tier="RETAIL_BANKING",
        block_threshold=75,
        step_up_threshold=40,
        sla_budget_ms=400.0,
        fail_open_enabled=True,
        fail_open_action="ALLOW_CALL_FLAGGED",
        api_key_hash=hashlib.sha256(b"dhvani_live_sbi_key_2026").hexdigest(),
        rate_limit_rpm=6000,
    ),
    "ICICI-CORP": TenantPolicy(
        tenant_id="ICICI-CORP",
        institution_name="Simulation Tenant: ICICI Corporate Treasury Profile (Demo)",
        tier="CORPORATE_TREASURY",
        block_threshold=50,
        step_up_threshold=25,
        sla_budget_ms=250.0,
        fail_open_enabled=True,
        fail_open_action="STEP_UP",
        api_key_hash=hashlib.sha256(b"dhvani_live_icici_key_2026").hexdigest(),
        rate_limit_rpm=1000,
    ),
    "AXIS-WEALTH": TenantPolicy(
        tenant_id="AXIS-WEALTH",
        institution_name="Simulation Tenant: Axis Wealth Architecture Profile (Demo)",
        tier="WEALTH_MANAGEMENT",
        block_threshold=45,
        step_up_threshold=20,
        sla_budget_ms=200.0,
        fail_open_enabled=True,
        fail_open_action="STEP_UP",
        api_key_hash=hashlib.sha256(b"dhvani_live_axis_key_2026").hexdigest(),
        rate_limit_rpm=600,
    ),
}


class TenantPolicyService:
    """
    Manages tenant risk policies, API key resolution, and tenant-scoped telemetry.
    """

    def __init__(self):
        self._lock = RLock()
        self._policies: Dict[str, TenantPolicy] = dict(DEFAULT_TENANT_POLICIES)
        self._key_map: Dict[str, str] = {
            "dhvani_live_hdfc_key_2026": "HDFC-BANK",
            "dhvani_live_sbi_key_2026": "SBI-RETAIL",
            "dhvani_live_icici_key_2026": "ICICI-CORP",
            "dhvani_live_axis_key_2026": "AXIS-WEALTH",
        }

    def resolve_tenant(self, api_key: Optional[str] = None, tenant_header: Optional[str] = None) -> TenantPolicy:
        """
        Resolves tenant context from API key or tenant ID header.
        Defaults to configured DEFAULT_TENANT_ID.
        """
        with self._lock:
            if api_key and api_key in self._key_map:
                t_id = self._key_map[api_key]
                return self._policies.get(t_id, self._policies["HDFC-BANK"])

            if tenant_header:
                t_clean = tenant_header.strip().upper()
                if t_clean in self._policies:
                    return self._policies[t_clean]

            default_id = get_settings().DEFAULT_TENANT_ID
            return self._policies.get(default_id, self._policies["HDFC-BANK"])

    def get_policy(self, tenant_id: str) -> Optional[TenantPolicy]:
        t_clean = (tenant_id or "").strip().upper()
        with self._lock:
            return self._policies.get(t_clean)

    def list_policies(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                {
                    "tenant_id": p.tenant_id,
                    "institution_name": p.institution_name,
                    "tier": p.tier,
                    "block_threshold": p.block_threshold,
                    "step_up_threshold": p.step_up_threshold,
                    "sla_budget_ms": p.sla_budget_ms,
                    "fail_open_enabled": p.fail_open_enabled,
                    "fail_open_action": p.fail_open_action,
                    "rate_limit_rpm": p.rate_limit_rpm,
                    "request_count": p.request_count,
                    "intercept_count": p.intercept_count,
                    "circuit_trip_count": p.circuit_trip_count,
                    "disclaimer": p.disclaimer,
                }
                for p in self._policies.values()
            ]

    def update_policy(
        self,
        tenant_id: str,
        block_threshold: Optional[int] = None,
        step_up_threshold: Optional[int] = None,
        sla_budget_ms: Optional[float] = None,
        fail_open_enabled: Optional[bool] = None,
        fail_open_action: Optional[str] = None,
        institution_name: Optional[str] = None,
        tier: Optional[str] = None,
    ) -> TenantPolicy:
        t_clean = tenant_id.strip().upper()
        with self._lock:
            if t_clean not in self._policies:
                self._policies[t_clean] = TenantPolicy(
                    tenant_id=t_clean,
                    institution_name=institution_name or f"{t_clean} Operations",
                    tier=tier or "RETAIL_BANKING",
                )

            p = self._policies[t_clean]
            if block_threshold is not None:
                p.block_threshold = max(10, min(95, block_threshold))
            if step_up_threshold is not None:
                p.step_up_threshold = max(5, min(p.block_threshold - 5, step_up_threshold))
            if sla_budget_ms is not None:
                p.sla_budget_ms = max(50.0, min(1000.0, sla_budget_ms))
            if fail_open_enabled is not None:
                p.fail_open_enabled = fail_open_enabled
            if fail_open_action is not None:
                p.fail_open_action = fail_open_action.strip().upper()
            if institution_name:
                p.institution_name = institution_name
            if tier:
                p.tier = tier

            logger.info("Updated security policy for tenant %s (Block=%d%%, StepUp=%d%%, SLA=%.1fms)",
                        t_clean, p.block_threshold, p.step_up_threshold, p.sla_budget_ms)
            return p

    def record_request(self, tenant_id: str, is_intercept: bool = False, is_circuit_trip: bool = False) -> None:
        t_clean = tenant_id.strip().upper()
        with self._lock:
            p = self._policies.get(t_clean)
            if p:
                p.request_count += 1
                if is_intercept:
                    p.intercept_count += 1
                if is_circuit_trip:
                    p.circuit_trip_count += 1


# Global singleton instance
tenant_policy_service = TenantPolicyService()
