#!/usr/bin/env python3
"""
Namma Space — Controlled Reconstruction Experiment Runner
Executes an isolated, verifiable COLMAP SfM pipeline with:
- Shared camera model (SIMPLE_RADIAL)
- Chronologically ordered image list
- Sequential feature matching with quadratic overlap & guided matching
- Incremental mapping with multi-model evaluation
- Bundle adjustment refinement
- Detailed metrics extraction and PLY conversion
"""

import argparse
import json
import os
import shutil
import struct
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))


def find_colmap() -> str:
    return shutil.which("colmap") or shutil.which("/opt/homebrew/bin/colmap") or ""


def run_command(cmd, step_name):
    print(f"\n[SfM Step] Running: {step_name}")
    print(f"Command: {' '.join(cmd)}")
    env = os.environ.copy()
    env["QT_QPA_PLATFORM"] = "offscreen"
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    if res.returncode != 0:
        print(f"[ERROR] Step '{step_name}' failed:\n{res.stderr}", file=sys.stderr)
        return False
    if res.stdout.strip():
        print(res.stdout)
    if res.stderr.strip() and "WARNING" in res.stderr:
        print(res.stderr)
    return True


def read_model_metrics(model_dir: str):
    images_bin = os.path.join(model_dir, "images.bin")
    points_bin = os.path.join(model_dir, "points3D.bin")
    cameras_bin = os.path.join(model_dir, "cameras.bin")

    num_images = 0
    num_points = 0
    num_cameras = 0
    mean_error = 0.0
    mean_track = 0.0

    if os.path.exists(cameras_bin):
        with open(cameras_bin, "rb") as f:
            num_cameras = struct.unpack("<Q", f.read(8))[0]

    image_names = []
    camera_poses = {}
    if os.path.exists(images_bin):
        with open(images_bin, "rb") as f:
            num_images = struct.unpack("<Q", f.read(8))[0]
            for _ in range(num_images):
                iid, qw, qx, qy, qz, tx, ty, tz, cid = struct.unpack("<IdddddddI", f.read(64))
                name = ""
                while True:
                    ch = f.read(1)
                    if ch == b"\x00":
                        break
                    name += ch.decode("ascii")
                n_pts2d = struct.unpack("<Q", f.read(8))[0]
                f.seek(n_pts2d * 24, 1)
                image_names.append(name)
                camera_poses[name] = {
                    "image_id": iid,
                    "q": [qw, qx, qy, qz],
                    "t": [tx, ty, tz],
                    "camera_id": cid,
                }

    if os.path.exists(points_bin):
        with open(points_bin, "rb") as f:
            num_points = struct.unpack("<Q", f.read(8))[0]
            total_error = 0.0
            total_track = 0
            for _ in range(num_points):
                f.seek(8 + 24 + 3, 1)  # point3D_id (uint64) + xyz (3*double) + rgb (3*uchar)
                err = struct.unpack("<d", f.read(8))[0]
                track_len = struct.unpack("<Q", f.read(8))[0]
                f.seek(track_len * 8, 1)
                total_error += err
                total_track += track_len
            if num_points > 0:
                mean_error = total_error / num_points
                mean_track = total_track / num_points

    return {
        "num_cameras": num_cameras,
        "num_images": num_images,
        "num_points": num_points,
        "mean_error_px": round(mean_error, 4),
        "mean_track_length": round(mean_track, 2),
        "registered_frames": sorted(image_names),
        "camera_poses": camera_poses,
    }


def run_experiment(
    image_dir: str,
    output_dir: str,
    matcher: str = "sequential",
    overlap: int = 30,
    single_camera: bool = True,
    max_num_features: int = 8192,
) -> dict:
    colmap_bin = find_colmap()
    if not colmap_bin:
        raise RuntimeError("COLMAP binary not found on PATH or /opt/homebrew/bin/colmap")

    os.makedirs(output_dir, exist_ok=True)
    database_path = os.path.join(output_dir, "database.db")
    models_dir = os.path.join(output_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    # 1. Feature Extraction
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
        "1" if single_camera else "0",
        "--ImageReader.camera_params",
        "1722,540,960,0.045",
        "--FeatureExtraction.use_gpu",
        "0",
        "--FeatureExtraction.num_threads",
        "8",
        "--SiftExtraction.max_num_features",
        str(max_num_features),
    ]

    image_list_txt = os.path.join(image_dir, "image_list.txt")
    if os.path.exists(image_list_txt):
        print(f"[*] Enforcing chronological order via {image_list_txt}")
        extract_cmd.extend(["--image_list_path", image_list_txt])

    if not run_command(extract_cmd, "Feature Extraction (SIFT CPU)"):
        return {}

    # 2. Feature Matching
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
            "--FeatureMatching.guided_matching",
            "1",
        ]
        step_title = "Exhaustive Feature Matching (guided=1)"
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
            "--FeatureMatching.guided_matching",
            "1",
        ]
        step_title = f"Sequential Feature Matching (overlap={overlap}, quadratic=1, guided=1)"

    if not run_command(match_cmd, step_title):
        return {}

    # 3. Incremental Mapper
    mapper_cmd = [
        colmap_bin,
        "mapper",
        "--database_path",
        database_path,
        "--image_path",
        image_dir,
        "--output_path",
        models_dir,
    ]
    if not run_command(mapper_cmd, "Incremental Mapping (Sparse Reconstruction)"):
        return {}

    # 4. Discover sub-models
    candidate_subdirs = [
        d for d in os.listdir(models_dir)
        if os.path.isdir(os.path.join(models_dir, d)) and d.isdigit()
    ]
    if not candidate_subdirs:
        print("[ERROR] No sparse 3D sub-model was created by the mapper.", file=sys.stderr)
        return {}

    print(f"\n[📊 Evaluating {len(candidate_subdirs)} Reconstructed Sub-Models]")
    all_models = {}
    best_sub = None
    best_points = -1

    for d in sorted(candidate_subdirs, key=int):
        m_p = os.path.join(models_dir, d)
        metrics = read_model_metrics(m_p)
        all_models[d] = {
            "num_cameras": metrics["num_cameras"],
            "num_images": metrics["num_images"],
            "num_points": metrics["num_points"],
            "mean_error_px": metrics["mean_error_px"],
            "mean_track_length": metrics["mean_track_length"],
            "registered_frames": metrics["registered_frames"],
        }
        print(f"  • Sub-model {d}: {metrics['num_images']} registered frames, "
              f"{metrics['num_points']} 3D points, "
              f"track length={metrics['mean_track_length']}, "
              f"reproj error={metrics['mean_error_px']} px")
        if metrics["num_points"] > best_points:
            best_points = metrics["num_points"]
            best_sub = d

    best_model_dir = os.path.join(models_dir, best_sub)
    best_metrics = read_model_metrics(best_model_dir)

    # 5. Export Best Model to PLY
    ply_output = os.path.join(output_dir, "sparse_points.ply")
    export_cmd = [
        colmap_bin,
        "model_converter",
        "--input_path",
        best_model_dir,
        "--output_path",
        ply_output,
        "--output_type",
        "PLY",
    ]
    if not run_command(export_cmd, f"Exporting Best Sub-Model {best_sub} to PLY"):
        return {}

    # 6. Export Trajectory JSON for WebGL rendering
    trajectory_json = os.path.join(output_dir, "camera_trajectory.json")
    with open(trajectory_json, "w") as f:
        json.dump(best_metrics["camera_poses"], f, indent=2)

    # 7. Summary Report
    summary = {
        "output_directory": output_dir,
        "best_model_sub": best_sub,
        "best_model_dir": best_model_dir,
        "total_submodels": len(candidate_subdirs),
        "best_model_metrics": {
            "num_cameras": best_metrics["num_cameras"],
            "num_images": best_metrics["num_images"],
            "num_points": best_metrics["num_points"],
            "mean_error_px": best_metrics["mean_error_px"],
            "mean_track_length": best_metrics["mean_track_length"],
        },
        "all_submodels": all_models,
        "ply_output": ply_output,
        "ply_size_bytes": os.path.getsize(ply_output) if os.path.exists(ply_output) else 0,
        "trajectory_json": trajectory_json,
    }

    report_p = os.path.join(output_dir, "experiment_metrics.json")
    with open(report_p, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n[✓] Experiment completed successfully!")
    print(f"    Best model:        Sub-model {best_sub} ({best_model_dir})")
    print(f"    Registered frames: {best_metrics['num_images']}")
    print(f"    3D points:         {best_metrics['num_points']}")
    print(f"    Reprojection error:{best_metrics['mean_error_px']} px")
    print(f"    Track length:      {best_metrics['mean_track_length']} obs/pt")
    print(f"    PLY exported:      {ply_output} ({summary['ply_size_bytes'] / 1024:.1f} KB)")
    print(f"    Metrics report:    {report_p}")
    return summary


def main():
    parser = argparse.ArgumentParser(description="Run controlled SfM reconstruction experiment.")
    parser.add_argument("image_dir", help="Directory with extracted frames")
    parser.add_argument("--output", "-o", required=True, help="Experiment output directory")
    parser.add_argument("--matcher", choices=["sequential", "exhaustive"], default="sequential")
    parser.add_argument("--overlap", type=int, default=30)
    parser.add_argument("--no-single-camera", action="store_true", help="Do not force shared camera")
    parser.add_argument("--max-features", type=int, default=8192)
    args = parser.parse_args()

    run_experiment(
        image_dir=os.path.abspath(args.image_dir),
        output_dir=os.path.abspath(args.output),
        matcher=args.matcher,
        overlap=args.overlap,
        single_camera=not args.no_single_camera,
        max_num_features=args.max_features,
    )


if __name__ == "__main__":
    main()
