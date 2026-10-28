import os
import shutil
import subprocess
from typing import Any

import cv2

from backend.app.core.config import settings


class ReconstructionService:
    @staticmethod
    def get_tool_availability() -> dict[str, bool]:
        """Detect which external reconstruction and CV binaries are currently available."""
        ffmpeg_exists = (
            shutil.which(settings.FFMPEG_PATH) is not None or shutil.which("ffmpeg") is not None
        )
        colmap_exists = (
            shutil.which(settings.COLMAP_PATH) is not None or shutil.which("colmap") is not None
        )

        # Test OpenCV availability
        opencv_ready = False
        try:
            _ = cv2.__version__
            opencv_ready = True
        except Exception:
            opencv_ready = False

        return {
            "ffmpeg": bool(ffmpeg_exists),
            "colmap": bool(colmap_exists),
            "opencv": opencv_ready,
        }

    @staticmethod
    def list_raw_videos() -> list[str]:
        """List user-provided videos in data/raw."""
        if not os.path.exists(settings.RAW_DATA_DIR):
            return []
        valid_extensions = {".mp4", ".mov", ".avi", ".mkv"}
        return [
            f
            for f in os.listdir(settings.RAW_DATA_DIR)
            if os.path.splitext(f)[1].lower() in valid_extensions and not f.startswith(".")
        ]

    @staticmethod
    def list_extracted_sessions() -> list[str]:
        """List session directories under data/frames."""
        if not os.path.exists(settings.FRAMES_DIR):
            return []
        return [
            d
            for d in os.listdir(settings.FRAMES_DIR)
            if os.path.isdir(os.path.join(settings.FRAMES_DIR, d)) and not d.startswith(".")
        ]

    @staticmethod
    def extract_frames(
        video_filename: str,
        target_fps: float = 2.0,
        max_frames: int = 200,
    ) -> dict[str, Any]:
        """
        Extract frames from a video file inside data/raw to data/frames/<video_stem>/
        Validates paths defensively to prevent directory traversal.
        Uses FFmpeg when available; falls back to native OpenCV video capture.
        """
        # Defensive path sanitation: filename cannot contain path separators
        clean_filename = os.path.basename(video_filename)
        input_video_path = os.path.join(settings.RAW_DATA_DIR, clean_filename)

        if not os.path.isfile(input_video_path):
            raise FileNotFoundError(
                f"Video file '{clean_filename}' was not found in {settings.RAW_DATA_DIR}"
            )

        video_stem = os.path.splitext(clean_filename)[0]
        output_dir = os.path.join(settings.FRAMES_DIR, video_stem)
        os.makedirs(output_dir, exist_ok=True)

        extracted_files: list[str] = []
        ffmpeg_bin = shutil.which(settings.FFMPEG_PATH) or shutil.which("ffmpeg")

        if ffmpeg_bin:
            # Use FFmpeg filter fps
            output_pattern = os.path.join(output_dir, "frame_%04d.jpg")
            cmd = [
                ffmpeg_bin,
                "-y",  # overwrite existing
                "-i",
                input_video_path,
                "-vf",
                f"fps={target_fps}",
                "-frames:v",
                str(max_frames),
                "-q:v",
                "2",
                output_pattern,
            ]
            process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if process.returncode != 0:
                raise RuntimeError(f"FFmpeg extraction failed: {process.stderr}")
        else:
            # Native OpenCV fallback
            cap = cv2.VideoCapture(input_video_path)
            if not cap.isOpened():
                raise RuntimeError(f"OpenCV could not open video: {input_video_path}")

            orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frame_interval = max(1, int(round(orig_fps / target_fps)))

            frame_idx = 0
            saved_count = 0
            while cap.isOpened() and saved_count < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break
                if frame_idx % frame_interval == 0:
                    saved_count += 1
                    out_path = os.path.join(output_dir, f"frame_{saved_count:04d}.jpg")
                    cv2.imwrite(out_path, frame)
                frame_idx += 1
            cap.release()

        # Collect results
        for f in sorted(os.listdir(output_dir)):
            if f.endswith(".jpg"):
                extracted_files.append(os.path.join(output_dir, f))

        return {
            "success": True,
            "message": f"Successfully extracted {len(extracted_files)} frames to {output_dir}",
            "output_directory": output_dir,
            "extracted_frames_count": len(extracted_files),
            "frame_paths": extracted_files,
        }
