#!/usr/bin/env python3
"""
Namma Space — Structure-from-Motion (SfM) Pipeline Interface
Automates feature extraction, feature matching, and sparse reconstruction
using COLMAP on Apple Silicon.
"""

import argparse
import json
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
    env = os.environ.copy()
    env["QT_QPA_PLATFORM"] = "offscreen"
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    if res.returncode != 0:
        print(f"[ERROR] Step '{step_name}' failed:\n{res.stderr}", file=sys.stderr)
        return False
    print(res.stdout)
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

import struct


def read_model_metrics(model_dir: str):
    """
    Parses COLMAP binary model files to extract exact metrics:
    registered images, 3D points, mean track length, and mean reprojection error.
    """
    images_bin = os.path.join(model_dir, "images.bin")
    points_bin = os.path.join(model_dir, "points3D.bin")

    num_images = 0
    num_points = 0
    mean_error = 0.0
    mean_track = 0.0

    if os.path.exists(images_bin):
        with open(images_bin, "rb") as f:
            num_images = struct.unpack("<Q", f.read(8))[0]

    if os.path.exists(points_bin):
        with open(points_bin, "rb") as f:
            num_points = struct.unpack("<Q", f.read(8))[0]
            total_error = 0.0
            total_track = 0
            for _ in range(num_points):
                f.seek(8 + 24 + 3, 1)  # point3D_id (uint64) + xyz (3*double) + rgb (3*uchar)
                err = struct.unpack("<d", f.read(8))[0]
                track_len = struct.unpack("<Q", f.read(8))[0]
                f.seek(track_len * 8, 1)  # skip track elements (image_id + point2D_idx)
                total_error += err
                total_track += track_len
            if num_points > 0:
                mean_error = total_error / num_points
                mean_track = total_track / num_points

    return {
        "num_images": num_images,
        "num_points": num_points,
        "mean_error_px": round(mean_error, 4),
        "mean_track_length": round(mean_track, 2),
    }


def run_sfm(
    image_dir: str,
    output_sparse_dir: str,
    matcher: str = "sequential",
    overlap: int = 20,
) -> bool:
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

    # Step 1: Feature extraction (CPU SIFT)
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
        "--FeatureExtraction.use_gpu",
        "0",
        "--FeatureExtraction.num_threads",
        "8",
    ]

    # Use image_list.txt if present to enforce strict chronological insertion order
    image_list_txt = os.path.join(image_dir, "image_list.txt")
    if os.path.exists(image_list_txt):
        print(f"[*] Enforcing chronological order via {image_list_txt}")
        extract_cmd.extend(["--image_list_path", image_list_txt])

    if not run_command(extract_cmd, "Feature Extraction (SIFT CPU)"):
        return False

    # Step 2: Feature Matching
    if matcher == "exhaustive":
        match_cmd = [
            colmap_bin,
            "exhaustive_matcher",
            "--database_path",
            database_path,
            "--FeatureMatching.use_gpu",
            "0",
            "--FeatureMatching.num_threads",
            "8",
        ]
        step_title = "Exhaustive Feature Matching"
    else:
        match_cmd = [
            colmap_bin,
            "sequential_matcher",
            "--database_path",
            database_path,
            "--SequentialMatching.overlap",
            str(overlap),
            "--SequentialMatching.quadratic_overlap",
            "1",
            "--FeatureMatching.use_gpu",
            "0",
            "--FeatureMatching.num_threads",
            "8",
        ]
        step_title = f"Sequential Feature Matching (overlap={overlap}, quadratic=1)"

    if not run_command(match_cmd, step_title):
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

    # Find and evaluate all reconstructed sub-models
    candidate_subdirs = [
        d for d in os.listdir(output_sparse_dir)
        if os.path.isdir(os.path.join(output_sparse_dir, d)) and d.isdigit()
    ]
    if not candidate_subdirs:
        print("[ERROR] No sparse 3D sub-model was created by the mapper.", file=sys.stderr)
        return False

    print("\n[📊 Sub-Model Evaluation]")
    best_dir = None
    best_points = -1
    total_registered = 0
    all_models_metrics = {}

    for d in sorted(candidate_subdirs, key=int):
        model_p = os.path.join(output_sparse_dir, d)
        metrics = read_model_metrics(model_p)
        all_models_metrics[d] = metrics
        total_registered += metrics["num_images"]
        print(f"  • Sub-model {d}: {metrics['num_images']} registered images, "
              f"{metrics['num_points']} 3D points, "
              f"mean track length={metrics['mean_track_length']}, "
              f"reproj error={metrics['mean_error_px']} px")
        if metrics["num_points"] > best_points:
            best_points = metrics["num_points"]
            best_dir = model_p

    sparse_model_dir = best_dir or os.path.join(output_sparse_dir, "0")
    best_metrics = read_model_metrics(sparse_model_dir)

    # Step 4: Export best model to PLY
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
    if not run_command(export_cmd, "Exporting Point Cloud to PLY"):
        return False

    # Save summary report JSON
    summary_report = {
        "output_directory": output_sparse_dir,
        "best_model": sparse_model_dir,
        "total_submodels": len(candidate_subdirs),
        "total_registered_images": total_registered,
        "best_model_metrics": best_metrics,
        "submodels": all_models_metrics,
        "ply_file": ply_output,
        "ply_size_bytes": os.path.getsize(ply_output) if os.path.exists(ply_output) else 0,
    }
    with open(os.path.join(output_sparse_dir, "reconstruction_metrics.json"), "w") as f:
        json.dump(summary_report, f, indent=2)

    print("\n[✓] Structure-from-Motion complete!")
    print(f"    Selected best sub-model: {sparse_model_dir}")
    print(f"    Total registered images: {total_registered}")
    print(f"    Best model images:       {best_metrics['num_images']}")
    print(f"    Best model 3D points:    {best_metrics['num_points']}")
    print(f"    Mean reproj error:       {best_metrics['mean_error_px']} px")
    print(f"    Mean track length:       {best_metrics['mean_track_length']} obs/pt")
    print(f"    Exported PLY cloud:      {ply_output}")
    if os.path.exists(ply_output):
        size_kb = os.path.getsize(ply_output) / 1024
        print(f"    Exported PLY size:       {size_kb:.1f} KB")
    return True


def main():
    parser = argparse.ArgumentParser(description="Namma Space: Run COLMAP SfM on extracted frames.")
    parser.add_argument("image_dir", help="Directory containing extracted video frames / images")
    parser.add_argument("--output", "-o", default=None, help="Output directory for sparse SfM")
    parser.add_argument(
        "--matcher",
        choices=["sequential", "exhaustive"],
        default="sequential",
        help="Feature matching strategy (default: sequential)",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=20,
        help="Sequential matching frame overlap window (default: 20)",
    )
    args = parser.parse_args()

    image_dir = os.path.abspath(args.image_dir)
    if args.output:
        out_dir = os.path.abspath(args.output)
    else:
        stem = os.path.basename(image_dir.rstrip("/"))
        out_dir = os.path.join(PROJECT_ROOT, "data", "sparse", stem)

    success = run_sfm(image_dir, out_dir, matcher=args.matcher, overlap=args.overlap)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
