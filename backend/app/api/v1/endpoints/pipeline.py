from fastapi import APIRouter, HTTPException, status

from backend.app.schemas.reconstruction import (
    FrameExtractionRequest,
    FrameExtractionResponse,
    PipelineStatusResponse,
)
from backend.app.services.reconstruction_service import ReconstructionService

router = APIRouter()


@router.get("/status", response_model=PipelineStatusResponse)
def get_pipeline_status() -> PipelineStatusResponse:
    tools = ReconstructionService.get_tool_availability()
    raw_videos = ReconstructionService.list_raw_videos()
    sessions = ReconstructionService.list_extracted_sessions()
    return PipelineStatusResponse(
        raw_videos_count=len(raw_videos),
        extracted_sessions=sessions,
        reconstruction_available=tools["colmap"],
        ffmpeg_available=tools["ffmpeg"],
        colmap_available=tools["colmap"],
    )


@router.post("/extract-frames", response_model=FrameExtractionResponse)
def extract_video_frames(req: FrameExtractionRequest) -> FrameExtractionResponse:
    try:
        result = ReconstructionService.extract_frames(
            video_filename=req.video_filename,
            target_fps=req.target_fps,
            max_frames=req.max_frames,
        )
        return FrameExtractionResponse(**result)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Frame extraction failed: {e!s}",
        )
