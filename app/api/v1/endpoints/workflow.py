from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, status
from pydantic import BaseModel, Field

from app.core.logging import logger
from app.services.workflow_service import workflow_service

router = APIRouter(prefix="/workflow", tags=["Workflow & Policy Engine"])


class WorkflowRuleModel(BaseModel):
    tier: str = Field(..., description="Tier name: LOW, MODERATE, HIGH, CRITICAL")
    min_score: int = Field(..., ge=0, le=100, description="Minimum risk score (0-100)")
    max_score: int = Field(..., ge=0, le=100, description="Maximum risk score (0-100)")
    actions: List[str] = Field(default_factory=list, description="Automated response action codes")
    description: Optional[str] = Field(None, description="Human readable policy explanation")


class UpdateWorkflowConfigRequest(BaseModel):
    rules: List[WorkflowRuleModel] = Field(..., min_length=1, description="List of tiered workflow rules")


@router.get("/rules", status_code=status.HTTP_200_OK)
def get_workflow_rules():
    """
    Fetches the current dynamic risk tier workflow configuration.
    """
    config = workflow_service.get_workflow_config()
    return config


@router.put("/rules", status_code=status.HTTP_200_OK)
def update_workflow_rules(payload: UpdateWorkflowConfigRequest = Body(...)):
    """
    Updates the dynamic risk tier workflow configuration rules.
    Takes effect immediately for all subsequent analyses without server restarts.
    """
    try:
        rules_dict = [r.model_dump() for r in payload.rules]
        updated = workflow_service.update_workflow_config(rules_dict)
        return {
            "status": "success",
            "message": "Workflow configuration updated successfully",
            "config": updated,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Failed to update workflow configuration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update workflow configuration",
        )


@router.post("/rules/reset", status_code=status.HTTP_200_OK)
def reset_workflow_rules():
    """
    Resets the workflow rules to factory SIH default configurations.
    """
    config = workflow_service.reset_to_defaults()
    return {
        "status": "success",
        "message": "Workflow configuration reset to defaults",
        "config": config,
    }
