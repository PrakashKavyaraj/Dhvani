"""
Enterprise API Authentication and Role-Based Access Control (RBAC) for Dhvani.

Protects sensitive banking APIs against unauthorized tampering:
1. Multi-tenant API Key validation (X-API-Key or Authorization Bearer).
2. Role hierarchy: READ_ONLY, TENANT_OPERATOR, BANK_CISO_ADMIN.
3. Development / Test bypass mode for backwards-compatible test runner execution.
"""

import hmac
import os
from typing import Dict, Optional, Set
from fastapi import Header, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# Pre-registered bank enterprise API keys (can be augmented via DHVANI_API_KEYS env)
DEFAULT_TENANT_KEYS: Dict[str, Dict[str, str]] = {
    "dhvani-master-admin-key-2026": {"tenant_id": "MASTER", "role": "BANK_CISO_ADMIN"},
    "dhvani-hdfc-prod-key-9812": {"tenant_id": "HDFC-BANK", "role": "TENANT_OPERATOR"},
    "dhvani-sbi-prod-key-4401": {"tenant_id": "SBI-RETAIL", "role": "TENANT_OPERATOR"},
    "dhvani-icici-prod-key-1190": {"tenant_id": "ICICI-TREASURY", "role": "TENANT_OPERATOR"},
    "dhvani-axis-prod-key-7721": {"tenant_id": "AXIS-WEALTH", "role": "TENANT_OPERATOR"},
}


def get_configured_keys() -> Dict[str, Dict[str, str]]:
    keys = dict(DEFAULT_TENANT_KEYS)
    custom = os.environ.get("DHVANI_API_KEYS")
    if custom:
        # Format: key1:TENANT:ROLE,key2:TENANT:ROLE
        for item in custom.split(","):
            parts = item.strip().split(":")
            if len(parts) == 3:
                keys[parts[0]] = {"tenant_id": parts[1], "role": parts[2]}
    return keys


def verify_api_key_or_dev(
    request: Request,
    x_api_key: Optional[str] = Security(API_KEY_HEADER),
    authorization: Optional[str] = Header(None),
) -> Dict[str, str]:
    """
    Validates API key from X-API-Key header or Authorization: Bearer <token>.
    Permits local loopback test clients if DHVANI_AUTH_ENFORCE is not set to true.
    """
    enforce = os.environ.get("DHVANI_AUTH_ENFORCE", "false").lower() == "true"
    configured = get_configured_keys()

    # 1. Check X-API-Key header
    provided_key = x_api_key

    # 2. Check Authorization Bearer header
    if not provided_key and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            provided_key = parts[1]

    if provided_key:
        # Constant-time comparison to protect against timing attacks
        for valid_key, meta in configured.items():
            if hmac.compare_digest(provided_key, valid_key):
                return meta
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API Key provided.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # If key not provided, check if in development / test mode
    if not enforce:
        # Development / Test client fallback
        client_host = request.client.host if request.client else "127.0.0.1"
        if client_host in ("127.0.0.1", "localhost", "testclient"):
            return {"tenant_id": "DEV_LOCAL", "role": "BANK_CISO_ADMIN"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid X-API-Key or Authorization Bearer token.",
        headers={"WWW-Authenticate": "ApiKey"},
    )


def require_admin_role(
    auth_meta: Dict[str, str] = Security(verify_api_key_or_dev),
) -> Dict[str, str]:
    """
    Requires BANK_CISO_ADMIN role for critical administrative actions.
    """
    role = auth_meta.get("role", "")
    if role != "BANK_CISO_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrative privileges (BANK_CISO_ADMIN) required for this operation.",
        )
    return auth_meta
