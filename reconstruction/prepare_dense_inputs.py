#!/usr/bin/env python3
"""
Phase 4C: Prepare and validate dense inputs.
Reads native COLMAP sparse model (cameras.bin, images.bin), cross-references
extracted frames, verifies poses and intrinsics, and produces source_manifest.json
and an image_list file for image_undistorter.
"""

import os
import sys
import json
import struct
import argparse
from pathlib import Path

def parse_cameras_bin(cameras_path):
    cameras = {}
    with open(cameras_path, "rb") as f:
        num_cameras = struct.unpack("<Q", f.read(8))[0]
        for _ in range(num_cameras):
            camera_id, model_id, width, height = struct.unpack("<IIQQ", f.read(24))
            # Model IDs: 0: SIMPLE_PINHOLE (3 params), 1: PINHOLE (4 params), 2: SIMPLE_RADIAL (4 params), 3: RADIAL (5 params), etc.
            # Number of params depending on model_id
            num_params_map = {0: 3, 1: 4, 2: 4, 3: 5, 4: 6, 5: 8, 6: 12}
            n_params = num_params_map.get(model_id, 4)
            params = struct.unpack(f"<{n_params}d", f.read(8 * n_params))
            cameras[camera_id] = {
                "camera_id": camera_id,
                "model_id": model_id,
                "width": width,
                "height": height,
                "params": list(params)
            }
    return cameras

def parse_images_bin(images_path):
    images = {}
    with open(images_path, "rb") as f:
        num_images = struct.unpack("<Q", f.read(8))[0]
        for _ in range(num_images):
            image_id, qw, qx, qy, qz, tx, ty, tz, camera_id = struct.unpack("<IdddddddI", f.read(64))
            name = ""
            while True:
                ch = f.read(1)
                if ch == b"\x00":
                    break
                name += ch.decode("ascii")
            num_points2d = struct.unpack("<Q", f.read(8))[0]
            f.seek(num_points2d * 24, 1) # Skip 2D points (x, y, point3D_id)
            
            images[name] = {
                "image_id": image_id,
                "qvec": [qw, qx, qy, qz],
                "tvec": [tx, ty, tz],
                "camera_id": camera_id,
                "num_points2d": num_points2d
            }
    return images

def prepare_dense_inputs(
    model_dir="data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/models/1",
    frames_dir="data/reconstruction_experiments/IMG_5449/frames_3fps",
    output_dir="data/reconstruction_experiments/IMG_5449/phase4_dense"
):
    model_dir = Path(model_dir)
    frames_dir = Path(frames_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    cameras_bin = model_dir / "cameras.bin"
    images_bin = model_dir / "images.bin"
    points_bin = model_dir / "points3D.bin"
    
    if not cameras_bin.exists() or not images_bin.exists():
        raise FileNotFoundError(f"Missing native COLMAP model files in {model_dir}")
        
    cameras = parse_cameras_bin(cameras_bin)
    registered_images = parse_images_bin(images_bin)
    
    # Check all frames in frames_dir
    all_extracted_frames = sorted([f.name for f in frames_dir.glob("*.jpg")])
    total_extracted = len(all_extracted_frames)
    
    usable_registered = []
    missing_files = []
    unregistered_frames = []
    
    for frame_name in all_extracted_frames:
        if frame_name in registered_images:
            frame_path = frames_dir / frame_name
            if frame_path.exists():
                img_meta = registered_images[frame_name]
                cam_meta = cameras.get(img_meta["camera_id"], {})
                usable_registered.append({
                    "name": frame_name,
                    "image_id": img_meta["image_id"],
                    "camera_id": img_meta["camera_id"],
                    "width": cam_meta.get("width"),
                    "height": cam_meta.get("height"),
                    "num_2d_points": img_meta["num_points2d"],
                    "qvec": img_meta["qvec"],
                    "tvec": img_meta["tvec"]
                })
            else:
                missing_files.append(frame_name)
        else:
            unregistered_frames.append(frame_name)
            
    # Sort usable registered by name
    usable_registered.sort(key=lambda x: x["name"])
    
    # Save registered image list for colmap image_undistorter
    image_list_path = output_dir / "registered_images.txt"
    with open(image_list_path, "w") as f:
        for item in usable_registered:
            f.write(f"{item['name']}\n")
            
    manifest = {
        "native_sparse_model": str(model_dir),
        "frames_source_dir": str(frames_dir),
        "total_extracted_frames": total_extracted,
        "total_registered_frames": len(registered_images),
        "total_usable_registered_frames": len(usable_registered),
        "missing_registered_files": missing_files,
        "unregistered_frames_count": len(unregistered_frames),
        "unregistered_frames": unregistered_frames,
        "registered_images": usable_registered,
        "cameras": cameras,
        "image_list_file": str(image_list_path)
    }
    
    manifest_path = output_dir / "source_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"=== Phase 4C: Input Image Validation Complete ===")
    print(f"Total extracted frames: {total_extracted}")
    print(f"Total registered frames: {len(registered_images)}")
    print(f"Total usable registered: {len(usable_registered)}")
    print(f"Missing registered files: {len(missing_files)}")
    print(f"Unregistered frames excluded: {len(unregistered_frames)}")
    print(f"Image list saved to: {image_list_path}")
    print(f"Source manifest saved to: {manifest_path}")
    
    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare and validate dense inputs")
    parser.add_argument("--model-dir", default="data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/models/1")
    parser.add_argument("--frames-dir", default="data/reconstruction_experiments/IMG_5449/frames_3fps")
    parser.add_argument("--output-dir", default="data/reconstruction_experiments/IMG_5449/phase4_dense")
    args = parser.parse_args()
    
    prepare_dense_inputs(args.model_dir, args.frames_dir, args.output_dir)
