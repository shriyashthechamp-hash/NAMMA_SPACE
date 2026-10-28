#!/usr/bin/env python3
"""
Namma Space — Synthetic Indoor Point Cloud Generator
Generates a benchmark indoor PLY point cloud (floor, walls, desks, door, and lighting)
to test and validate the 3D Point Cloud visualization and navigation pipeline.
"""

import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "sparse", "sample")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "benchmark_room.ply")


def generate_indoor_ply(filename: str):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    points = []  # (x, y, z, r, g, b)

    # 1. Floor: 12m x 12m grid (y = 0) with slight jitter
    for _ in range(8000):
        x = random.uniform(-6.0, 6.0)
        z = random.uniform(-6.0, 6.0)
        y = random.uniform(-0.02, 0.02)
        # Slate blue-gray floor
        r, g, b = (35 + random.randint(0, 10), 45 + random.randint(0, 10), 65 + random.randint(0, 10))
        points.append((x, y, z, r, g, b))

    # 2. Outer Walls: 3m height (y from 0 to 3)
    # North Wall (z = -6.0)
    for _ in range(3000):
        x = random.uniform(-6.0, 6.0)
        y = random.uniform(0.0, 3.0)
        z = -6.0 + random.uniform(-0.03, 0.03)
        points.append((x, y, z, 55, 65, 85))

    # South Wall (z = 6.0)
    for _ in range(3000):
        x = random.uniform(-6.0, 6.0)
        y = random.uniform(0.0, 3.0)
        z = 6.0 + random.uniform(-0.03, 0.03)
        points.append((x, y, z, 55, 65, 85))

    # West Wall (x = -6.0)
    for _ in range(3000):
        z = random.uniform(-6.0, 6.0)
        y = random.uniform(0.0, 3.0)
        x = -6.0 + random.uniform(-0.03, 0.03)
        points.append((x, y, z, 50, 60, 80))

    # East Wall (x = 6.0)
    for _ in range(3000):
        z = random.uniform(-6.0, 6.0)
        y = random.uniform(0.0, 3.0)
        x = 6.0 + random.uniform(-0.03, 0.03)
        points.append((x, y, z, 50, 60, 80))

    # 3. Interior Divider Wall with central door opening (z = 0, x from -6 to -1 and 1 to 6)
    for _ in range(2500):
        # Pick left side or right side of doorway
        if random.random() < 0.5:
            x = random.uniform(-6.0, -1.0)
        else:
            x = random.uniform(1.0, 6.0)
        y = random.uniform(0.0, 3.0)
        z = random.uniform(-0.03, 0.03)
        points.append((x, y, z, 70, 85, 105))

    # Doorway Lintel (y from 2.2 to 3.0 across x = -1 to 1)
    for _ in range(500):
        x = random.uniform(-1.0, 1.0)
        y = random.uniform(2.2, 3.0)
        z = random.uniform(-0.03, 0.03)
        points.append((x, y, z, 70, 85, 105))

    # 4. Desks (Wood / Amber tones)
    # Desk 1 at (-3.5, 0.8, -3.5)
    for _ in range(1200):
        x = random.uniform(-4.5, -2.5)
        z = random.uniform(-4.2, -2.8)
        y = 0.85 + random.uniform(-0.02, 0.02)
        points.append((x, y, z, 210, 140, 75))

    # Desk 2 at (3.5, 0.8, -3.5)
    for _ in range(1200):
        x = random.uniform(2.5, 4.5)
        z = random.uniform(-4.2, -2.8)
        y = 0.85 + random.uniform(-0.02, 0.02)
        points.append((x, y, z, 210, 140, 75))

    # 5. Central Landmark Pedestal (Cyan accent)
    for _ in range(800):
        angle = random.uniform(0, 6.283)
        rad = random.uniform(0, 0.9)
        x = rad * random.uniform(0.8, 1.0) * (2 ** 0.5) * random.choice([-1, 1]) * random.random()
        z = 3.5 + rad * random.uniform(0.8, 1.0) * random.choice([-1, 1]) * random.random()
        y = random.uniform(0.0, 0.9)
        points.append((x, y, z, 6, 182, 212))

    # Write PLY header and points
    with open(filename, "w", encoding="utf-8") as f:
        f.write("ply\n")
        f.write("format ascii 1.0\n")
        f.write(f"element vertex {len(points)}\n")
        f.write("property float x\n")
        f.write("property float y\n")
        f.write("property float z\n")
        f.write("property uchar red\n")
        f.write("property uchar green\n")
        f.write("property uchar blue\n")
        f.write("end_header\n")
        for x, y, z, r, g, b in points:
            f.write(f"{x:.4f} {y:.4f} {z:.4f} {r} {g} {b}\n")

    print(f"[✓] Created benchmark PLY cloud with {len(points)} points: {filename}")


if __name__ == "__main__":
    generate_indoor_ply(OUTPUT_FILE)
