import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Namma Space API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # CORS origins
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # File paths
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    RAW_DATA_DIR: str = os.path.join(DATA_DIR, "raw")
    FRAMES_DIR: str = os.path.join(DATA_DIR, "frames")
    SPARSE_DIR: str = os.path.join(DATA_DIR, "sparse")

    # Pipeline tool paths
    FFMPEG_PATH: str = "/opt/homebrew/bin/ffmpeg"
    COLMAP_PATH: str = "/opt/homebrew/bin/colmap"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
