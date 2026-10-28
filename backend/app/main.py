from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.api import api_router
from backend.app.api.v1.endpoints.health import get_health
from backend.app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Namma Space: Indoor 3D Digital Twin Platform API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS Middleware configured for frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root-level convenience health check
app.get("/health", tags=["Health"])(get_health)

# Include v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root_info():
    return {
        "project": "Namma Space",
        "description": "Indoor 3D Digital Twin Platform API",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health",
    }
