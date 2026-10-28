from pydantic import BaseModel, Field


class FrameExtractionRequest(BaseModel):
    video_filename: str = Field(..., description="Name of the video file placed in data/raw")
    target_fps: float = Field(
        default=2.0, ge=0.5, le=10.0, description="Frames to extract per second"
    )
    max_frames: int = Field(
        default=200, ge=5, le=2000, description="Upper bound of frames to extract"
    )


class FrameExtractionResponse(BaseModel):
    success: bool
    message: str
    output_directory: str
    extracted_frames_count: int
    frame_paths: list[str] = Field(default_factory=list)


class PipelineStatusResponse(BaseModel):
    raw_videos_count: int
    extracted_sessions: list[str]
    reconstruction_available: bool
    ffmpeg_available: bool
    colmap_available: bool
