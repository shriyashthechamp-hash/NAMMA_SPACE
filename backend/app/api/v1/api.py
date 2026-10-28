from fastapi import APIRouter

from backend.app.api.v1.endpoints import health, pipeline

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
