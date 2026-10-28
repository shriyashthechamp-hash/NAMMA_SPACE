#!/usr/bin/env python3
"""
Namma Space — Structure-from-Motion (SfM) Pipeline Interface
Automates feature extraction, feature matching, and sparse reconstruction
using COLMAP on Apple Silicon.
"""

import argparse
import os
import shutil
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))


def find_colmap() -> str:
    path = shutil.which("colmap") or shutil.which("/opt/homebrew/bin/colmap")
    return path or ""


def run_command(cmd, step_name):
    print(f"\n[SfM Step] Running: {step_name}")
    print(f"Command: {' '.join(cmd)}")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"[ERROR] Step '{step_name}' failed:\n{res.stderr}", file=sys.stderr)
        return False
    return True


def run_sfm(image_dir: str, output_sparse_dir: str) -> bool:
    colmap_bin = find_colmap()
    if not colmap_bin:
        print("[ERROR] COLMAP binary not found.", file=sys.stderr)
        print("To install on macOS Apple Silicon: brew install colmap", file=sys.stderr)
        return False

    if not os.path.isdir(image_dir):
        print(f"[ERROR] Image directory '{image_dir}' does not exist.", file=sys.stderr)
        return False

    valid_images = [
        f for f in os.listdir(image_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ]
    if len(valid_images) < 3:
        print(
            f"[ERROR] SfM requires at least 3-5 images. Found only {len(valid_images)} in {image_dir}.",
            file=sys.stderr,
        )
        return False

    os.makedirs(output_sparse_dir, exist_ok=True)
    database_path = os.path.join(output_sparse_dir, "database.db")
    sparse_model_dir = os.path.join(output_sparse_dir, "0")
    os.makedirs(sparse_model_dir, exist_ok=True)

    # Step 1: Feature extraction (using CPU or SIFT GPU if OpenGL is active)
    # On Apple Silicon without NVIDIA CUDA, COLMAP uses CPU threads for SIFT extraction
    extract_cmd = [
        colmap_bin,
        "feature_extractor",
        "--database_path",
        database_path,
        "--image_path",
        image_dir,
        "--ImageReader.camera_model",
        "SIMPLE_RADIAL",
        "--ImageReader.single_camera",
        "1",
        "--SiftExtraction.use_gpu",
        "0",  # Safe CPU mode for non-CUDA Apple Silicon
    ]
    if not run_command(extract_cmd, "Feature Extraction (SIFT CPU)"):
        return False

    # Step 2: Feature matching (sequential or exhaustive)
    # Sequential matching is ideal for continuous video walkthrough frames
    match_cmd = [
        colmap_bin,
        "sequential_matcher",
        "--database_path",
        database_path,
        "--SiftMatching.use_gpu",
        "0",
    ]
    if not run_command(match_cmd, "Sequential Feature Matching"):
        return False

    # Step 3: Sparse 3D Reconstruction (Mapper)
    mapper_cmd = [
        colmap_bin,
        "mapper",
        "--database_path",
        database_path,
        "--image_path",
        image_dir,
        "--output_path",
        output_sparse_dir,
    ]
    if not run_command(mapper_cmd, "Incremental Mapping (Sparse Reconstruction)"):
        return False

    # Step 4: Export to PLY point cloud for browser viewing
    ply_output = os.path.join(output_sparse_dir, "sparse_points.ply")
    export_cmd = [
        colmap_bin,
        "model_converter",
        "--input_path",
        sparse_model_dir,
        "--output_path",
        ply_output,
        "--output_type",
        "PLY",
    ]
    _ = run_command(export_cmd, "Exporting Point Cloud to PLY")

    print("\n[✓] Structure-from-Motion complete!")
    print(f"    Sparse model files: {sparse_model_dir}")
    print(f"    Exported PLY cloud: {ply_output}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Namma Space: Run COLMAP SfM on extracted frames.")
    parser.add_argument("image_dir", help="Directory containing extracted video frames / images")
    parser.add_argument("--output", "-o", default=None, help="Output directory for sparse SfM")
    args = parser.parse_args()

    image_dir = os.path.abspath(args.image_dir)
    if args.output:
        out_dir = os.path.abspath(args.output)
    else:
        stem = os.path.basename(image_dir.rstrip("/"))
        out_dir = os.path.join(PROJECT_ROOT, "data", "sparse", stem)

    success = run_sfm(image_dir, out_dir)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
