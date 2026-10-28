from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Overall service health")
    version: str = Field(..., description="API Version")
    environment: str = Field(..., description="Active runtime environment")
    tools: dict[str, bool] = Field(
        ...,
        description="Availability status of reconstruction and processing binaries (FFmpeg, COLMAP, OpenCV)",
    )
    system: dict[str, Any] = Field(
        default_factory=dict,
        description="Non-sensitive host environment metadata (architecture, python version)",
    )
    message: str | None = None
