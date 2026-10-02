from typing import Optional
from pydantic import BaseModel, Field


class AnalysisCreateRequest(BaseModel):
    experiment_id: Optional[str] = Field(None, max_length=100)
    language: Optional[str] = Field(None, max_length=32)