#!/usr/bin/env python3
"""
Phase 4H: Export dense geometry and surface mesh for Three.js viewer.
Applies (x, -y, -z) display transformation to match the viewer coordinate frame.
Preserves native COLMAP coordinates in raw exports.
Generates:
  1. meshed-delaunay-sparse.ply -> mesh_threejs.ply (display transformed)
  2. dense_threejs.ply (densified surface point cloud with RGB colors)
  3. dense_filtered_threejs.ply (filtered dense point cloud)
Uses pure numpy (no external dependencies required).
"""

import os
import sys
import struct
import json
import numpy as np
from pathlib import Path

def read_sparse_points_rgb(sparse_ply_path):
    """Read sparse points and RGB colors from sparse_points.ply."""
    points = []
    colors = []
    with open(sparse_ply_path, "rb") as f:
        while True:
            line = f.readline().decode("ascii", errors="ignore").strip()
            if line.startswith("element vertex"):
                num_verts = int(line.split()[-1])
            if line == "end_header":
                break
        
        for _ in range(num_verts):
            data = f.read(15)
            if len(data) < 15:
                break
            x, y, z = struct.unpack("<fff", data[:12])
            r, g, b = struct.unpack("BBB", data[12:15])
            points.append([x, y, z])
            colors.append([r, g, b])
            
    return np.array(points, dtype=np.float32), np.array(colors, dtype=np.uint8)

def read_mesh_ply(mesh_ply_path):
    """Read binary little-endian mesh PLY."""
    vertices = []
    faces = []
    num_verts = 0
    num_faces = 0
    with open(mesh_ply_path, "rb") as f:
        while True:
            line = f.readline().decode("ascii", errors="ignore").strip()
            if line.startswith("element vertex"):
                num_verts = int(line.split()[-1])
            elif line.startswith("element face"):
                num_faces = int(line.split()[-1])
            elif line == "end_header":
                break
                
        # Vertices: 3 x float32 (12 bytes)
        for _ in range(num_verts):
            v_data = f.read(12)
            if len(v_data) < 12:
                break
            x, y, z = struct.unpack("<fff", v_data)
            vertices.append([x, y, z])
            
        # Faces: uchar n_indices, int32 v0, v1, v2
        for _ in range(num_faces):
            n_idx_data = f.read(1)
            if not n_idx_data:
                break
            n_idx = struct.unpack("B", n_idx_data)[0]
            indices = struct.unpack(f"<{n_idx}i", f.read(4 * n_idx))
            if n_idx >= 3:
                faces.append(list(indices[:3]))
                
    return np.array(vertices, dtype=np.float32), np.array(faces, dtype=np.int32)

def write_mesh_ply(output_path, vertices, faces, colors=None):
    """Write binary little-endian mesh PLY with optional vertex colors."""
    num_verts = len(vertices)
    num_faces = len(faces)
    has_colors = colors is not None and len(colors) == num_verts
    
    header = (
        "ply\n"
        "format binary_little_endian 1.0\n"
        f"element vertex {num_verts}\n"
        "property float x\n"
        "property float y\n"
        "property float z\n"
    )
    if has_colors:
        header += (
            "property uchar red\n"
            "property uchar green\n"
            "property uchar blue\n"
        )
    header += (
        f"element face {num_faces}\n"
        "property list uchar int vertex_indices\n"
        "end_header\n"
    )
    
    with open(output_path, "wb") as f:
        f.write(header.encode("ascii"))
        for i in range(num_verts):
            f.write(struct.pack("<fff", *vertices[i]))
            if has_colors:
                f.write(struct.pack("BBB", *colors[i]))
        for face in faces:
            f.write(struct.pack("B", len(face)))
            f.write(struct.pack(f"<{len(face)}i", *face))

def write_pointcloud_ply(output_path, points, colors):
    """Write binary little endian point cloud PLY with RGB."""
    num_points = len(points)
    header = (
        "ply\n"
        "format binary_little_endian 1.0\n"
        f"element vertex {num_points}\n"
        "property float x\n"
        "property float y\n"
        "property float z\n"
        "property uchar red\n"
        "property uchar green\n"
        "property uchar blue\n"
        "end_header\n"
    )
    with open(output_path, "wb") as f:
        f.write(header.encode("ascii"))
        for i in range(num_points):
            f.write(struct.pack("<fff", *points[i]))
            f.write(struct.pack("BBB", *colors[i]))

def find_nearest_colors_numpy(queries, references, ref_colors, chunk_size=1000):
    """Chunked nearest neighbor lookup in pure NumPy."""
    N = len(queries)
    out_colors = np.zeros((N, 3), dtype=np.uint8)
    for i in range(0, N, chunk_size):
        chunk = queries[i:i + chunk_size]
        diff = chunk[:, np.newaxis, :] - references[np.newaxis, :, :]
        dists_sq = np.sum(diff**2, axis=2)
        nearest_idx = np.argmin(dists_sq, axis=1)
        out_colors[i:i + chunk_size] = ref_colors[nearest_idx]
    return out_colors

def filter_outliers_grid(points, colors, voxel_size=0.15, min_pts_per_voxel=4):
    """Radius/voxel-density outlier removal in pure NumPy."""
    voxel_coords = np.floor(points / voxel_size).astype(np.int64)
    # Pack voxel coordinates into unique keys
    keys, counts = np.unique(voxel_coords, axis=0, return_counts=True)
    dense_voxels = set(map(tuple, keys[counts >= min_pts_per_voxel]))
    
    inliers = np.array([tuple(v) in dense_voxels for v in voxel_coords])
    return inliers

def export_dense_and_mesh(
    mesh_input="data/reconstruction_experiments/IMG_5449/phase4_dense/exports/meshed-delaunay-sparse.ply",
    sparse_ply="data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/sparse_points.ply",
    exports_dir="data/reconstruction_experiments/IMG_5449/phase4_dense/exports"
):
    exports_dir = Path(exports_dir)
    exports_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Reading sparse points from: {sparse_ply}")
    sparse_pts, sparse_colors = read_sparse_points_rgb(sparse_ply)
    print(f"Loaded {len(sparse_pts)} sparse points.")
    
    print(f"Reading Delaunay mesh from: {mesh_input}")
    mesh_verts, mesh_faces = read_mesh_ply(mesh_input)
    print(f"Loaded mesh: {len(mesh_verts)} vertices, {len(mesh_faces)} faces.")
    
    # 1. Colorize mesh vertices from nearest sparse points
    print("Colorizing mesh vertices from sparse 3D points...")
    mesh_colors = find_nearest_colors_numpy(mesh_verts, sparse_pts, sparse_colors)
    
    # 2. Convert mesh to Three.js viewer display space: (x, -y, -z)
    mesh_verts_thjs = mesh_verts.copy()
    mesh_verts_thjs[:, 1] = -mesh_verts_thjs[:, 1]
    mesh_verts_thjs[:, 2] = -mesh_verts_thjs[:, 2]
    
    mesh_threejs_path = exports_dir / "mesh_threejs.ply"
    write_mesh_ply(mesh_threejs_path, mesh_verts_thjs, mesh_faces, mesh_colors)
    print(f"Exported display-transformed mesh to: {mesh_threejs_path} ({len(mesh_verts)} verts, {len(mesh_faces)} faces)")
    
    # 3. Surface densification: sample points across triangle faces
    np.random.seed(42)
    dense_pts = list(sparse_pts)
    dense_cols = list(sparse_colors)
    
    samples_per_face = 4
    for face in mesh_faces:
        v0, v1, v2 = mesh_verts[face[0]], mesh_verts[face[1]], mesh_verts[face[2]]
        c0, c1, c2 = mesh_colors[face[0]], mesh_colors[face[1]], mesh_colors[face[2]]
        
        edge1 = v1 - v0
        edge2 = v2 - v0
        area = 0.5 * np.linalg.norm(np.cross(edge1, edge2))
        # Filter huge spanning triangles
        if area > 1.5 or area < 1e-6:
            continue
            
        r1 = np.random.rand(samples_per_face)
        r2 = np.random.rand(samples_per_face)
        sqrt_r1 = np.sqrt(r1)
        
        for k in range(samples_per_face):
            w0 = 1.0 - sqrt_r1[k]
            w1 = sqrt_r1[k] * (1.0 - r2[k])
            w2 = sqrt_r1[k] * r2[k]
            
            p = w0 * v0 + w1 * v1 + w2 * v2
            c = (w0 * c0.astype(float) + w1 * c1.astype(float) + w2 * c2.astype(float)).astype(np.uint8)
            dense_pts.append(p)
            dense_cols.append(c)
            
    dense_pts = np.array(dense_pts, dtype=np.float32)
    dense_cols = np.array(dense_cols, dtype=np.uint8)
    print(f"Generated raw densified point cloud: {len(dense_pts)} points.")
    
    # Save native COLMAP dense cloud
    dense_native_path = exports_dir / "dense_native_colmap.ply"
    write_pointcloud_ply(dense_native_path, dense_pts, dense_cols)
    print(f"Saved native dense cloud to: {dense_native_path}")
    
    # 4. Convert dense points to Three.js viewer display space: (x, -y, -z)
    dense_thjs = dense_pts.copy()
    dense_thjs[:, 1] = -dense_thjs[:, 1]
    dense_thjs[:, 2] = -dense_thjs[:, 2]
    
    dense_threejs_path = exports_dir / "dense_threejs.ply"
    write_pointcloud_ply(dense_threejs_path, dense_thjs, dense_cols)
    print(f"Exported display-transformed dense cloud to: {dense_threejs_path} ({len(dense_thjs)} points)")
    
    # 5. Outlier removal filtering
    print("Applying density-based outlier removal filter...")
    inliers = filter_outliers_grid(dense_thjs, dense_cols, voxel_size=0.18, min_pts_per_voxel=5)
    filtered_dense_thjs = dense_thjs[inliers]
    filtered_dense_cols = dense_cols[inliers]
    
    filtered_dense_path = exports_dir / "dense_filtered_threejs.ply"
    write_pointcloud_ply(filtered_dense_path, filtered_dense_thjs, filtered_dense_cols)
    print(f"Exported filtered dense cloud to: {filtered_dense_path} ({len(filtered_dense_thjs)} points, removed {np.sum(~inliers)} outliers)")
    
    # Export summary metadata
    bounds_min = dense_thjs.min(axis=0).tolist()
    bounds_max = dense_thjs.max(axis=0).tolist()
    
    summary = {
        "mesh": {
            "vertices": len(mesh_verts),
            "faces": len(mesh_faces),
            "path": str(mesh_threejs_path)
        },
        "dense_raw": {
            "point_count": len(dense_thjs),
            "path": str(dense_threejs_path),
            "bounds_min": bounds_min,
            "bounds_max": bounds_max
        },
        "dense_filtered": {
            "point_count": len(filtered_dense_thjs),
            "outliers_removed": int(np.sum(~inliers)),
            "path": str(filtered_dense_path)
        },
        "display_transform": "(x, y, z) -> (x, -y, -z)",
        "sparse_baseline_points": len(sparse_pts),
        "dense_to_sparse_ratio": round(len(dense_thjs) / len(sparse_pts), 2)
    }
    
    summary_path = exports_dir / "dense_export_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Export summary saved to: {summary_path}")

if __name__ == "__main__":
    export_dense_and_mesh()
