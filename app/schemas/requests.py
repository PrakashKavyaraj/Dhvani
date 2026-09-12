from pydantic import BaseModel, Field


class AnalysisOptions(BaseModel):
    experiment_id: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=32)
