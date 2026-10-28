import platform
import sys

from fastapi import APIRouter

from backend.app.core.config import settings
from backend.app.schemas.health import HealthResponse
from backend.app.services.reconstruction_service import ReconstructionService

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    tools = ReconstructionService.get_tool_availability()
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        tools=tools,
        system={
            "platform": platform.platform(),
            "machine": platform.machine(),
            "python_version": sys.version.split()[0],
        },
        message="Namma Space digital-twin backend is running.",
    )
