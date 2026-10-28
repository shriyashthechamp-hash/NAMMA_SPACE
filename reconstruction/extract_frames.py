#!/usr/bin/env python3
"""
Namma Space — Video Frame Extraction CLI
Extracts high-quality frames from smartphone-captured indoor walkthrough videos
into timestamped/session-tagged directories for 3D reconstruction and camera-pose estimation.
"""

import argparse
import os
import shutil
import subprocess
import sys

# Ensure project root is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


def extract_frames(
    video_path: str, output_dir: str, fps: float = 2.0, max_frames: int = 300
) -> int:
    """
    Extracts frames using FFmpeg if available, or OpenCV fallback.
    """
    if not os.path.isfile(video_path):
        print(f"[ERROR] Input video '{video_path}' not found.", file=sys.stderr)
        return 0

    os.makedirs(output_dir, exist_ok=True)
    ffmpeg_bin = shutil.which("ffmpeg") or shutil.which("/opt/homebrew/bin/ffmpeg")

    if ffmpeg_bin:
        print(f"[*] Using FFmpeg binary: {ffmpeg_bin}")
        output_pattern = os.path.join(output_dir, "frame_%04d.jpg")
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            video_path,
            "-vf",
            f"fps={fps}",
            "-frames:v",
            str(max_frames),
            "-q:v",
            "2",
            output_pattern,
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            print(f"[ERROR] FFmpeg failed: {res.stderr}", file=sys.stderr)
            return 0
    else:
        print("[*] FFmpeg not found in PATH; falling back to OpenCV VideoCapture...")
        try:
            import cv2
        except ImportError:
            print(
                "[ERROR] Neither FFmpeg nor OpenCV is installed. Cannot extract frames.",
                file=sys.stderr,
            )
            return 0

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"[ERROR] OpenCV could not open video: {video_path}", file=sys.stderr)
            return 0

        native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        interval = max(1, int(round(native_fps / fps)))
        frame_idx = 0
        saved_count = 0

        while cap.isOpened() and saved_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % interval == 0:
                saved_count += 1
                out_path = os.path.join(output_dir, f"frame_{saved_count:04d}.jpg")
                cv2.imwrite(out_path, frame)
            frame_idx += 1
        cap.release()

    extracted = [f for f in os.listdir(output_dir) if f.endswith(".jpg")]
    count = len(extracted)
    print(f"[✓] Extracted {count} frames to: {output_dir}")
    print(
        "    Note: Frame extraction is Step 1. Camera pose estimation (COLMAP) and 3D reconstruction must follow."
    )
    return count


def main():
    parser = argparse.ArgumentParser(
        description="Namma Space: Video to frames extractor for indoor 3D reconstruction."
    )
    parser.add_argument("video", help="Path to input video file (e.g., data/raw/walkthrough.mp4)")
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Target frames directory (defaults to data/frames/<video_name>/)",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=2.0,
        help="Target extraction frame-rate (default: 2.0 frames/sec)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=300,
        help="Maximum frames to extract (default: 300)",
    )

    args = parser.parse_args()

    video_path = os.path.abspath(args.video)
    if args.output:
        out_dir = os.path.abspath(args.output)
    else:
        stem = os.path.splitext(os.path.basename(video_path))[0]
        out_dir = os.path.join(PROJECT_ROOT, "data", "frames", stem)

    success_count = extract_frames(
        video_path=video_path,
        output_dir=out_dir,
        fps=args.fps,
        max_frames=args.max_frames,
    )
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
