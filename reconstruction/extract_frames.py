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


import json

def generate_contact_sheet(image_paths: list[str], output_path: str, thumb_size: tuple[int, int] = (160, 284), cols: int = 10):
    try:
        import cv2
        import numpy as np
    except ImportError:
        return

    if not image_paths:
        return

    thumbs = []
    for p in image_paths:
        im = cv2.imread(p)
        if im is not None:
            # Resize preserving aspect ratio or fitting into thumb_size
            thumb = cv2.resize(im, thumb_size, interpolation=cv2.INTER_AREA)
            thumbs.append(thumb)

    if not thumbs:
        return

    n = len(thumbs)
    rows = (n + cols - 1) // cols
    sheet_h = rows * thumb_size[1]
    sheet_w = cols * thumb_size[0]
    sheet = np.zeros((sheet_h, sheet_w, 3), dtype=np.uint8)

    for idx, thumb in enumerate(thumbs):
        r = idx // cols
        c = idx % cols
        y1 = r * thumb_size[1]
        y2 = y1 + thumb_size[1]
        x1 = c * thumb_size[0]
        x2 = x1 + thumb_size[0]
        sheet[y1:y2, x1:x2] = thumb
        # Draw frame number label
        cv2.putText(sheet, f"#{idx+1}", (x1 + 6, y1 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)

    cv2.imwrite(output_path, sheet)
    print(f"[*] Generated contact sheet preview: {output_path} ({cols}x{rows} grid)")


def extract_frames(
    video_path: str,
    output_dir: str,
    fps: float = 2.0,
    max_frames: int = 300,
    scale: str | None = None,
    blur_threshold: float = 0.0,
) -> int:
    """
    Extracts frames using FFmpeg, inspects blur, saves timestamp metadata,
    outputs sorted image_list.txt, and creates an inspectable contact sheet.
    """
    if not os.path.isfile(video_path):
        print(f"[ERROR] Input video '{video_path}' not found.", file=sys.stderr)
        return 0

    os.makedirs(output_dir, exist_ok=True)
    ffmpeg_bin = shutil.which("ffmpeg") or shutil.which("/opt/homebrew/bin/ffmpeg")

    raw_frames_dir = os.path.join(output_dir, "raw_extracted")
    os.makedirs(raw_frames_dir, exist_ok=True)

    if ffmpeg_bin:
        print(f"[*] Using FFmpeg binary: {ffmpeg_bin}")
        output_pattern = os.path.join(raw_frames_dir, "frame_%04d.jpg")
        filter_str = f"fps={fps}"
        if scale:
            filter_str += f",scale={scale}"
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            video_path,
            "-vf",
            filter_str,
            "-frames:v",
            str(max_frames),
            "-q:v",
            "2",
            output_pattern,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=False)
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
                out_path = os.path.join(raw_frames_dir, f"frame_{saved_count:04d}.jpg")
                cv2.imwrite(out_path, frame)
            frame_idx += 1
        cap.release()

    raw_files = sorted([f for f in os.listdir(raw_frames_dir) if f.endswith(".jpg")])
    if not raw_files:
        print("[ERROR] No frames extracted.", file=sys.stderr)
        return 0

    try:
        import cv2
        has_cv2 = True
    except ImportError:
        has_cv2 = False

    metadata = {
        "video_path": video_path,
        "target_fps": fps,
        "scale": scale,
        "blur_threshold": blur_threshold,
        "total_extracted": len(raw_files),
        "frames": [],
    }

    accepted_paths = []
    accepted_filenames = []
    rejected_count = 0

    print(f"[*] Analyzing {len(raw_files)} frames for sharpness and timestamp alignment...")
    for idx, fname in enumerate(raw_files):
        src_path = os.path.join(raw_frames_dir, fname)
        timestamp_sec = round(idx / fps, 3)

        lap_var = None
        w, h = 0, 0
        is_blurry = False
        rejection_reason = None

        if has_cv2:
            im = cv2.imread(src_path)
            if im is not None:
                h, w = im.shape[:2]
                gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
                lap_var = round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2)
                if blur_threshold > 0.0 and lap_var < blur_threshold:
                    is_blurry = True

        # Conservative blur policy: do not reject if it creates a > 1.0s gap
        reject = False
        if is_blurry:
            # Check gap to last accepted timestamp
            last_ts = metadata["frames"][-1]["timestamp"] if metadata["frames"] else 0.0
            if (timestamp_sec - last_ts) < 1.0:
                reject = True
                rejection_reason = f"Laplacian variance {lap_var} < threshold {blur_threshold} (redundant within 1s)"
            else:
                rejection_reason = f"Kept despite LapVar {lap_var} < {blur_threshold} to preserve trajectory bridge"

        frame_info = {
            "index": idx + 1,
            "filename": fname,
            "timestamp": timestamp_sec,
            "width": w,
            "height": h,
            "laplacian_variance": lap_var,
            "status": "rejected" if reject else "accepted",
            "reason": rejection_reason,
        }
        metadata["frames"].append(frame_info)

        dst_path = os.path.join(output_dir, fname)
        if reject:
            rejected_count += 1
            if os.path.exists(dst_path):
                os.remove(dst_path)
        else:
            # Copy to final output_dir
            shutil.copy2(src_path, dst_path)
            accepted_paths.append(dst_path)
            accepted_filenames.append(fname)

    # Save sorted image_list.txt for COLMAP chronological ordering
    image_list_txt = os.path.join(output_dir, "image_list.txt")
    with open(image_list_txt, "w") as f:
        for fname in accepted_filenames:
            f.write(f"{fname}\n")

    # Save metadata JSON
    meta_json = os.path.join(output_dir, "metadata.json")
    with open(meta_json, "w") as f:
        json.dump(metadata, f, indent=2)

    # Generate contact sheet
    contact_sheet_path = os.path.join(output_dir, "contact_sheet.jpg")
    generate_contact_sheet(accepted_paths, contact_sheet_path)

    # Clean up temp raw_extracted dir
    shutil.rmtree(raw_frames_dir, ignore_errors=True)

    accepted_count = len(accepted_filenames)
    print(f"\n[✓] Extraction Summary for {output_dir}:")
    print(f"    Total frames decoded: {len(raw_files)}")
    print(f"    Accepted frames:      {accepted_count}")
    print(f"    Rejected frames:      {rejected_count}")
    print(f"    Image list written:   {image_list_txt}")
    print(f"    Metadata saved:       {meta_json}")
    return accepted_count


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
    parser.add_argument(
        "--scale",
        default=None,
        help="FFmpeg scale filter, e.g., '1080:-2' or '1920:-2' (default: native)",
    )
    parser.add_argument(
        "--blur-threshold",
        type=float,
        default=0.0,
        help="Conservative Laplacian variance blur threshold (default: 0.0, disabled)",
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
        scale=args.scale,
        blur_threshold=args.blur_threshold,
    )
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
