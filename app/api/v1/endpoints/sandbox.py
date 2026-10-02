"""
Developer Sandbox & Multi-Language SDK Playground REST Endpoints for Dhvani.

Features:
- Code generation across Python, TypeScript, cURL, Java, and Go
- Live test runner executing against local forensic endpoints
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.services.sandbox_service import (
    SCENARIOS,
    SDK_LANGUAGES,
    developer_sandbox_service,
)

router = APIRouter(prefix="/sandbox", tags=["Developer Sandbox & Multi-Language SDK Playground"])


class ExecuteTestRequest(BaseModel):
    scenario: str = Field("VOICE_INFERENCE", description="Scenario key to execute")


@router.get(
    "/scenarios",
    status_code=status.HTTP_200_OK,
    summary="Get available integration scenarios and supported SDK languages",
)
async def get_scenarios():
    """Returns available scenarios and supported programming languages."""
    return {
        "status": "SCENARIOS_ACTIVE",
        "supported_languages": SDK_LANGUAGES,
        "scenarios": SCENARIOS,
    }


@router.get(
    "/code-snippet",
    status_code=status.HTTP_200_OK,
    summary="Get ready-to-run SDK code snippet for specified scenario and language",
)
async def get_code_snippet(
    scenario: str = Query("VOICE_INFERENCE", description="Scenario key"),
    language: str = Query("python", description="Language: curl, python, typescript, java, go"),
    base_url: str = Query("http://localhost:8000", description="Base URL of Dhvani API"),
):
    """Generates runnable SDK code snippet."""
    code = developer_sandbox_service.get_template(scenario, language.lower(), base_url)
    return {
        "scenario": scenario,
        "language": language.lower(),
        "code_snippet": code,
    }


@router.post(
    "/execute-test",
    status_code=status.HTTP_200_OK,
    summary="Execute live sandbox scenario test",
)
async def execute_test(request: ExecuteTestRequest):
    """Executes a live test in the sandbox and measures real execution latency."""
    res = developer_sandbox_service.execute_live_test(request.scenario)
    return res
