"""
Unit tests for OWASP Enterprise Security Hardening, Anti-DoS, and RBAC Guardrails.
"""

import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.rate_limiter import rate_limiter
from app.core.security_auth import get_configured_keys

client = TestClient(app)


def test_owasp_security_headers_present():
    """Verifies that all mandatory OWASP security headers are injected into HTTP responses."""
    response = client.get("/health")
    assert response.status_code == 200
    headers = response.headers

    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert "max-age=31536000" in headers.get("strict-transport-security", "")
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "default-src 'self'" in headers.get("content-security-policy", "")
    assert "microphone=(self)" in headers.get("permissions-policy", "")


def test_payload_size_anti_dos_rejection():
    """Verifies that requests exceeding the 25MB limit are rejected with HTTP 413 Payload Too Large."""
    # Simulate a request header declaring over 25MB (26MB)
    response = client.post(
        "/api/v1/vendor/shadow-mode/evaluate",
        headers={"Content-Length": str(27 * 1024 * 1024)},
        content=b"oversized-payload-data",
    )
    assert response.status_code == 413
    assert "Payload too large" in response.json()["detail"]


def test_auth_enforcement_rbac(monkeypatch):
    """
    Verifies that when DHVANI_AUTH_ENFORCE is true:
    - Missing key yields HTTP 401
    - Invalid key yields HTTP 401
    - Operator key yields HTTP 403 on admin-only endpoints
    - Master CISO Admin key yields HTTP 200
    """
    monkeypatch.setenv("DHVANI_AUTH_ENFORCE", "true")

    # 1. Missing key
    unauth_resp = client.post(
        "/api/v1/vendor/shadow-mode/reset-circuit-breaker",
        json={},
    )
    assert unauth_resp.status_code == 401
    assert "Authentication required" in unauth_resp.json()["detail"]

    # 2. Invalid key
    bad_key_resp = client.post(
        "/api/v1/vendor/shadow-mode/reset-circuit-breaker",
        headers={"X-API-Key": "invalid-malicious-attacker-key"},
        json={},
    )
    assert bad_key_resp.status_code == 401
    assert "Invalid or expired API Key" in bad_key_resp.json()["detail"]

    # 3. Valid tenant operator key (role: TENANT_OPERATOR) on admin route -> HTTP 403
    operator_resp = client.post(
        "/api/v1/vendor/shadow-mode/reset-circuit-breaker",
        headers={"X-API-Key": "dhvani-hdfc-prod-key-9812"},
        json={},
    )
    assert operator_resp.status_code == 403
    assert "Administrative privileges (BANK_CISO_ADMIN) required" in operator_resp.json()["detail"]

    # 4. Valid Master Admin key (role: BANK_CISO_ADMIN) -> HTTP 200
    admin_resp = client.post(
        "/api/v1/vendor/shadow-mode/reset-circuit-breaker",
        headers={"X-API-Key": "dhvani-master-admin-key-2026"},
        json={},
    )
    assert admin_resp.status_code == 200
    assert admin_resp.json()["status"] == "CIRCUIT_BREAKER_RESET"

    # 5. Bearer token syntax also works
    bearer_resp = client.post(
        "/api/v1/vendor/shadow-mode/reset-circuit-breaker",
        headers={"Authorization": "Bearer dhvani-master-admin-key-2026"},
        json={},
    )
    assert bearer_resp.status_code == 200


def test_rate_limiter_sliding_window():
    """Verifies that excessive requests trigger HTTP 429 Too Many Requests."""
    from unittest.mock import Mock
    from fastapi import HTTPException
    
    limiter = rate_limiter
    mock_request = Mock()
    mock_request.headers = {"X-Forwarded-For": "198.51.100.99"}
    mock_request.client = None

    # Reset any prior record for test IP
    with limiter._lock:
        limiter._history["ip:198.51.100.99"] = []

    # Inject 5 allowed requests
    for _ in range(5):
        limiter.check_limit(mock_request, max_requests=5, window_seconds=60)

    # 6th request should raise HTTPException with status_code 429
    with pytest.raises(HTTPException) as exc_info:
        limiter.check_limit(mock_request, max_requests=5, window_seconds=60)

    assert exc_info.value.status_code == 429
    assert "Rate limit exceeded" in exc_info.value.detail
    assert "Retry-After" in exc_info.value.headers

    # Cleanup stale records does not crash
    limiter.cleanup_stale_records(max_idle_seconds=0)
