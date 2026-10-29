#!/usr/bin/env python3
"""
Generate comprehensive camera trajectory and frame metadata JSON for the 3D WebGL Viewer.
Calculates camera optical centers C = -R^T @ t, viewing direction, and alignment center.
"""

import os
import sys
import json
import struct
import numpy as np

def qvec2rotmat(qvec):
    qw, qx, qy, qz = qvec
    return np.array([
        [1 - 2 * qy**2 - 2 * qz**2, 2 * qx * qy - 2 * qw * qz, 2 * qx * qz + 2 * qw * qy],
        [2 * qx * qy + 2 * qw * qz, 1 - 2 * qx**2 - 2 * qz**2, 2 * qy * qz - 2 * qw * qx],
        [2 * qx * qz - 2 * qw * qy, 2 * qy * qz + 2 * qw * qx, 1 - 2 * qx**2 - 2 * qy**2]
    ])

def export_trajectory(model_dir: str, frames_dir: str, output_path: str, fps: float = 3.0, static_url_prefix: str = "/api/v1/data/reconstruction_experiments/IMG_5449/frames_3fps"):
    images_bin = os.path.join(model_dir, "images.bin")
    points_bin = os.path.join(model_dir, "points3D.bin")

    # 1. Read points3D bounding box for centering
    point_positions = []
    if os.path.exists(points_bin):
        with open(points_bin, "rb") as f:
            num_points = struct.unpack("<Q", f.read(8))[0]
            for _ in range(num_points):
                f.read(8)  # point3D_id
                xyz = struct.unpack("<ddd", f.read(24))
                point_positions.append(xyz)
                f.read(3)  # rgb
                err = struct.unpack("<d", f.read(8))[0]
                track_len = struct.unpack("<Q", f.read(8))[0]
                f.seek(track_len * 8, 1)

    pts_arr = np.array(point_positions) if point_positions else np.zeros((1, 3))
    pts_min = pts_arr.min(axis=0)
    pts_max = pts_arr.max(axis=0)
    pts_center = ((pts_min + pts_max) / 2.0).tolist()

    # 2. Read images and compute optical center
    poses = {}
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

                R = qvec2rotmat([qw, qx, qy, qz])
                t = np.array([tx, ty, tz])
                C = -R.T @ t
                forward = R.T @ np.array([0, 0, 1])

                poses[name] = {
                    "image_id": iid,
                    "raw_center": C.tolist(),
                    "centered_position": (C - np.array(pts_center)).tolist(),
                    "forward": forward.tolist(),
                    "q": [qw, qx, qy, qz],
                    "camera_id": cid,
                }

    # 3. Read all frames from disk
    all_frame_files = sorted([f for f in os.listdir(frames_dir) if f.startswith("frame_") and f.endswith(".jpg")])

    trajectory_list = []
    unregistered_list = []

    for idx, fname in enumerate(all_frame_files):
        # Extract frame index
        num_str = fname.replace("frame_", "").replace(".jpg", "")
        f_num = int(num_str) if num_str.isdigit() else idx + 1
        t_sec = round((f_num - 1) / fps, 2)
        img_url = f"{static_url_prefix}/{fname}"

        if fname in poses:
            info = poses[fname]
            trajectory_list.append({
                "name": fname,
                "frame_number": f_num,
                "timestamp_sec": t_sec,
                "registered": True,
                "position": info["centered_position"],
                "raw_position": info["raw_center"],
                "forward": info["forward"],
                "image_url": img_url,
            })
        else:
            unregistered_list.append({
                "name": fname,
                "frame_number": f_num,
                "timestamp_sec": t_sec,
                "registered": False,
                "image_url": img_url,
            })

    # Sort trajectory_list chronologically
    trajectory_list.sort(key=lambda x: x["frame_number"])

    output_data = {
        "stats": {
            "total_frames": len(all_frame_files),
            "registered_count": len(trajectory_list),
            "unregistered_count": len(unregistered_list),
            "points_count": len(point_positions),
            "pts_center": pts_center,
            "pts_min": pts_min.tolist(),
            "pts_max": pts_max.tolist(),
            "fps": fps,
        },
        "trajectory": trajectory_list,
        "unregistered": unregistered_list,
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"[✓] Trajectory saved to {output_path}")
    print(f"    Total frames: {len(all_frame_files)}, Registered: {len(trajectory_list)}, Unregistered: {len(unregistered_list)}")
    print(f"    Point cloud center: {pts_center}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: generate_rich_trajectory.py <model_dir> <frames_dir> <output_json> [fps] [url_prefix]")
        sys.exit(1)

    m_dir = sys.argv[1]
    f_dir = sys.argv[2]
    out_j = sys.argv[3]
    fps_val = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0
    url_p = sys.argv[5] if len(sys.argv) > 5 else "/api/v1/data/reconstruction_experiments/IMG_5449/frames_3fps"

    export_trajectory(m_dir, f_dir, out_j, fps_val, url_p)
