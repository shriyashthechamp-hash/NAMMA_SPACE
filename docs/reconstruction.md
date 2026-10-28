# Namma Space — Indoor Reconstruction Guide

## 1. Smartphone Capture Guidelines

To achieve high-quality 3D reconstruction and accurate camera poses:

1. **Walking Speed:** Walk slowly and steadily at ~0.5 m/s. Avoid abrupt camera rotations or rapid jerks.
2. **Camera Overlap:** Ensure 70–80% visual overlap between successive views. Loop back to previously visited areas (loop closure) to minimize drift.
3. **Lighting:** Keep indoor lighting uniform. Avoid moving shadows or harsh glare directly facing lenses.
4. **Resolution & Frame Rate:** Record at 1080p or 4K at 30fps or 60fps. Higher frame rates reduce motion blur.
5. **Format:** Standard H.264 / HEVC `.mp4` or `.mov`.

---

## 2. Pipeline Execution Steps

### Step 1: Video Frame Extraction
Place your walkthrough video in `data/raw/walkthrough.mp4`, then run:

```bash
./.venv/bin/python3 reconstruction/extract_frames.py data/raw/walkthrough.mp4 --fps 2.0
```

Frames will be saved in `data/frames/walkthrough/`.

### Step 2: Camera Pose Estimation & Sparse SfM (COLMAP)
Ensure COLMAP is installed (`brew install colmap`), then run:

```bash
./.venv/bin/python3 reconstruction/run_sfm.py data/frames/walkthrough/
```

This runs:
- SIFT feature extraction on Apple Silicon CPU threads.
- Sequential image matching (ideal for video continuous walkthroughs).
- Incremental bundle adjustment and camera pose recovery.
- Automatic point cloud export to `data/sparse/walkthrough/sparse_points.ply`.

### Step 3: Web Visualization
The exported `.ply` or converted `.splat` file is loaded into the Three.js viewer on the web client.
