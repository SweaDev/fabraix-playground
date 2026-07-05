"""Pydantic models for challenge configuration."""

from datetime import datetime

from pydantic import BaseModel, Field


class ChallengeConfig(BaseModel):
    """Challenge configuration loaded from YAML."""

    slug: str = Field(..., description="Unique challenge identifier")
    name: str = Field(..., description="Display name")
    difficulty: int = Field(..., ge=1, le=5, description="Difficulty 1-5")
    description: str = Field(..., description="Brief description")
    objective: str = Field(..., description="User's objective")
    agent_persona: str = Field(..., description="Agent character name")
    agent_subtitle: str = Field(..., description="Agent role/title")
    greeting: str = Field(..., description="Initial greeting")
    system_prompt: str = Field(..., description="Agent system prompt")
    deadline: datetime = Field(..., description="Challenge deadline")
    is_active: bool = Field(True, description="Whether challenge is active")
    tools: list[str] = Field(default_factory=list, description="Available tools")
    prize: str = Field(..., description="Weekly prize copy shown in the UI (per challenge)")
