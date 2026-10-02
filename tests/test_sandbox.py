"""
Unit & Integration Test Suite for Developer Sandbox & Multi-Language SDK Playground.

Validates:
1. Multi-language code snippet generation (Python, TypeScript, cURL, Java, Go)
2. Scenario coverage across all 9 core Dhvani endpoints
3. Live test runner execution and latency profiling
4. REST endpoints for scenario definitions and interactive console execution
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.sandbox_service import (
    SCENARIOS,
    SDK_LANGUAGES,
    DeveloperSandboxService,
    developer_sandbox_service,
)


@pytest.fixture
def client():
    return TestClient(app)


class TestDeveloperSandboxService:
    def test_scenarios_and_languages(self):
        assert len(SDK_LANGUAGES) == 5
        assert "python" in SDK_LANGUAGES
        assert "typescript" in SDK_LANGUAGES
        assert "curl" in SDK_LANGUAGES
        assert len(SCENARIOS) >= 9

    def test_get_template_languages(self):
        service = DeveloperSandboxService()
        for lang in SDK_LANGUAGES:
            code = service.get_template("VOICE_INFERENCE", lang)
            assert len(code) > 20
            if lang == "python":
                assert "requests" in code
            elif lang == "typescript":
                assert "axios" in code
            elif lang == "curl":
                assert "curl" in code

    def test_execute_live_test(self):
        service = DeveloperSandboxService()
        res = service.execute_live_test("CALL_COPILOT")
        assert res["status_code"] == 200
        assert res["latency_ms"] > 0
        assert "response_data" in res
        assert "session_id" in res["response_data"]


class TestDeveloperSandboxRESTEndpoints:
    def test_get_scenarios_endpoint(self, client):
        resp = client.get("/api/v1/sandbox/scenarios")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SCENARIOS_ACTIVE"
        assert len(data["supported_languages"]) == 5
        assert "VOICE_INFERENCE" in data["scenarios"]

    def test_get_code_snippet_endpoint(self, client):
        resp = client.get("/api/v1/sandbox/code-snippet?scenario=VOCODER_ATTRIBUTION&language=python")
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == "python"
        assert "import requests" in data["code_snippet"]
        assert "/api/v1/vocoder/attribute" in data["code_snippet"]

    def test_execute_test_endpoint(self, client):
        payload = {"scenario": "EDGE_VERIFY"}
        resp = client.post("/api/v1/sandbox/execute-test", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status_code"] == 200
        assert "HARDWARE_PHYSICAL_MIC_VERIFIED" in str(data["response_data"])
