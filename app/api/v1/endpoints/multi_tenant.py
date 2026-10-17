"""
Multi-Tenant Architecture, pgvector DDL & Session Endpoints for Dhvani.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.redis_session_store import redis_session_store
from app.services.multi_tenant_vector_store import multi_tenant_vector_store
from app.services.tenant_policy_service import tenant_policy_service

router = APIRouter(tags=["Multi-Tenant Enterprise"])


class UpdatePolicyRequest(BaseModel):
    tenant_id: str = Field(..., json_schema_extra={"example": "HDFC-BANK"})
    institution_name: Optional[str] = Field(None, json_schema_extra={"example": "HDFC Bank Retail Contact Center"})
    tier: Optional[str] = Field(None, json_schema_extra={"example": "RETAIL_BANKING"})
    block_threshold: Optional[int] = Field(None, ge=10, le=95, json_schema_extra={"example": 70})
    step_up_threshold: Optional[int] = Field(None, ge=5, le=90, json_schema_extra={"example": 35})
    sla_budget_ms: Optional[float] = Field(None, ge=50.0, le=1000.0, json_schema_extra={"example": 350.0})
    fail_open_enabled: Optional[bool] = Field(None, json_schema_extra={"example": True})


class PurgeCustomerRequest(BaseModel):
    customer_account_id: str = Field(..., json_schema_extra={"example": "CUST-HDFC-99104"})


@router.get("/tenants")
def list_tenants() -> Dict[str, Any]:
    """Lists all configured bank tenants and operational fraud policies."""
    policies = tenant_policy_service.list_policies()
    return {
        "tenants": policies,
        "count": len(policies),
        "supported_database_modes": ["PostgreSQL 16 + pgvector", "Embedded HNSWLib (Cosine Space)"],
    }


@router.post("/tenants")
def update_tenant_policy(payload: UpdatePolicyRequest) -> Dict[str, Any]:
    """Updates or registers a custom bank risk policy."""
    updated = tenant_policy_service.update_policy(
        tenant_id=payload.tenant_id,
        block_threshold=payload.block_threshold,
        step_up_threshold=payload.step_up_threshold,
        sla_budget_ms=payload.sla_budget_ms,
        fail_open_enabled=payload.fail_open_enabled,
        institution_name=payload.institution_name,
        tier=payload.tier,
    )
    return {
        "status": "POLICY_UPDATED",
        "tenant_id": updated.tenant_id,
        "institution_name": updated.institution_name,
        "block_threshold": updated.block_threshold,
        "step_up_threshold": updated.step_up_threshold,
        "sla_budget_ms": updated.sla_budget_ms,
        "fail_open_enabled": updated.fail_open_enabled,
    }


@router.get("/tenants/pgvector-ddl")
def get_pgvector_ddl() -> Dict[str, Any]:
    """
    Returns production-grade PostgreSQL 16 + pgvector DDL deployment script
    with HNSW cosine vector index for enterprise bank DBAs.
    """
    ddl = multi_tenant_vector_store.get_pgvector_ddl()
    return {
        "target_engine": "PostgreSQL 16+ with pgvector v0.6.0+",
        "index_type": "HNSW (Hierarchical Navigable Small World)",
        "distance_operator": "<=> (Cosine Distance)",
        "vector_dimensions": 192,
        "sql_schema": ddl,
    }


@router.get("/tenants/redis-session/health")
def get_redis_session_health() -> Dict[str, Any]:
    """Returns telemetry of the distributed ephemeral telephony buffer."""
    return redis_session_store.get_health()


@router.get("/tenants/{tenant_id}/stats")
def get_tenant_statistics(tenant_id: str) -> Dict[str, Any]:
    """Returns tenant-scoped biometric vault and policy statistics."""
    policy = tenant_policy_service.get_policy(tenant_id)
    if not policy:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found.")

    vault_stats = multi_tenant_vector_store.get_tenant_stats(tenant_id)
    return {
        "tenant_id": policy.tenant_id,
        "institution_name": policy.institution_name,
        "tier": policy.tier,
        "policy": {
            "block_threshold": policy.block_threshold,
            "step_up_threshold": policy.step_up_threshold,
            "sla_budget_ms": policy.sla_budget_ms,
            "fail_open_enabled": policy.fail_open_enabled,
        },
        "vault": vault_stats,
        "telemetry": {
            "request_count": policy.request_count,
            "intercept_count": policy.intercept_count,
            "circuit_trip_count": policy.circuit_trip_count,
        },
    }


@router.post("/tenants/{tenant_id}/purge-customer")
def purge_customer_voiceprint(tenant_id: str, payload: PurgeCustomerRequest) -> Dict[str, Any]:
    """
    DPDP Act 2023 Section 12 Right to Erasure.
    Permanently removes customer voiceprint from tenant vault and vector indices.
    """
    res = multi_tenant_vector_store.purge_customer(
        tenant_id=tenant_id,
        customer_account_id=payload.customer_account_id,
    )
    return res
