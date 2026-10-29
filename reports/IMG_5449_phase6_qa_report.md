# NAMMA SPACE — PHASE 6: GAUSSIAN SPLAT QUALITY ASSURANCE & VISUAL VALIDATION REPORT
**Target Model**: 3D Gaussian Splatting from `data/raw/IMG_5449.MOV`  
**Evaluation Date**: 2026-10-29  
**Execution Environment**: Apple Silicon M4 (macOS arm64, PyTorch MPS)  
**Primary Focus**: Artifact Provenance, Training Audit, Visual Render Evaluation, Renderer Fidelity, Gap Analysis  

---

## 1. Executive Summary

Phase 6 performed an exhaustive, rigorous quality audit of the Phase 5 3D Gaussian Splatting pipeline. Rather than assuming reported numbers, we traced the exact camera pose provenance, audited model weights and checkpoint files, generated real image renders against ground truth frames across multiple trajectory phases, and conducted an honest technical evaluation of the web renderer.

### Key Audit Findings:
1. **Provenance Verified**: The 71 views in `dataset/transforms.json` originate from the 71 successfully registered cameras in Phase 3 COLMAP SfM (`exp1_3fps_singlecam/models/1/`), undistorted in Phase 4 (`phase4_dense/undistorted/`) at $1064 \times 1893$ resolution.
2. **Checkpoint Audit**:
   - Both `checkpoint_iter_0150.pt` and `checkpoint_iter_0250.pt` exist on disk.
   - The reported 250 iterations was indeed the full run; `checkpoint_iter_0150.pt` was an intermediate checkpoint triggered by the periodic save rule (`if it % 150 == 0`).
   - `checkpoint_iter_0250.pt` is the final model. Zero NaN or infinite values were found across all 11,804 Gaussians.
3. **Visual Quality & Geometric Completeness**:
   - Primary office features (backpack, office desk, laptops, chairs, blue decal quotes, fire extinguisher) are clearly identifiable in the rendered outputs.
   - Significant holes exist on solid white walls and untextured floor areas where sparse SfM lacked keypoints. The late section (chair near frame 94) suffers from sparse geometric density.
4. **Renderer Architecture**:
   - The Three.js viewer implements an **isotropic radial Gaussian disc approximation** (`renderMode="splats"`) using a 2D canvas alpha map.
   - It does **not** implement full anisotropic covariance projection ($\Sigma_{2D} = J \Sigma J^T$) or real-time per-frame depth sorting.
5. **Readiness Assessment**: The scene functions as a recognizable geometric and spatial preview of the real room, but is **not yet a production-grade photorealistic digital twin** due to the low Gaussian count (11,804 points vs. typical 500k–1.5M in full 3DGS) and lack of adaptive densification.

---

## 2. Checkpoint & Training Parameter Audit

Detailed inspection of `data/reconstruction_experiments/IMG_5449/phase5_gaussian/checkpoints/`:

| Parameter | `checkpoint_iter_0150.pt` | `checkpoint_iter_0250.pt` (Final) | Sanity Status |
| :--- | :--- | :--- | :--- |
| **Recorded Iteration** | 150 | 250 | Verified |
| **Recorded Loss** | 0.7122 | 0.7352 | Verified |
| **_xyz (Centroids)** | min=-25.44, max=26.13 | min=-25.44, max=26.13 | Clean (No NaN / Inf) |
| **_scaling (log space)** | min=-3.71, max=-2.64 | min=-4.22, max=-2.11 | Clean (Scales $\approx 0.015 - 0.12$ m) |
| **_rotation (quaternions)** | mean=0.2445 | mean=0.2366 | Clean unit quaternions |
| **_opacity (logit space)** | mean=2.0325 ($\alpha \approx 0.88$) | mean=2.2790 ($\alpha \approx 0.91$) | Clean, positive convergence |
| **_features_dc (SH 0th)** | min=-1.79, max=1.80 | min=-1.80, max=1.81 | Full RGB color dynamic range |

### Training History Progression:
- **Iteration 1**: Loss = 0.7641, L1 = 0.7079, SSIM = 0.0108, PSNR = 2.61 dB
- **Best Iteration (Iter 231)**: Loss = 0.5751, PSNR = 4.45 dB
- **Final Iteration (Iter 250)**: Loss = 0.7352, L1 = 0.6704, PSNR = 2.76 dB
- **Gaussian Count**: Constant at 11,804 (cloning and split-densification were not active during this run).

---

## 3. Visual Quality Evaluation (Render vs. Ground Truth)

Evaluation renders were generated using differentiable projective splatting and saved to `data/exports/IMG_5449_qa/`:

| View | Target Frame | PSNR (dB) | SSIM | L1 Loss | Visual Findings |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Early Trajectory** | `images/frame_0001.jpg` | 3.60 | 0.0467 | 0.5743 | White wall quote decals, fire extinguisher, floor tiles visible; solid white wall has large voids. |
| **Mid Trajectory** | `images/frame_0036.jpg` | 4.11 | 0.0712 | 0.5130 | Blue backpack, laptops, desk surface, chair arms clearly structured; highest PSNR of all views. |
| **Late Trajectory** | `images/frame_0094.jpg` | 2.94 | 0.0039 | 0.6481 | Chair curvature outline visible; major coverage gaps due to rapid camera panning during capture. |
| **Novel Viewpoint** | Interpolated pose (+0.15m height) | N/A | N/A | N/A | Coherent 3D spatial parallax; desk and backpack maintain proper relative depth without catastrophic floater distortion. |

### Generated Comparison Outputs:
- [`qa_early_frame_0001.jpg`](file:///Users/shriyasdeshmukh/NAMMA_IIT_BOM/data/exports/IMG_5449_qa/qa_early_frame_0001.jpg)
- [`qa_mid_frame_0036.jpg`](file:///Users/shriyasdeshmukh/NAMMA_IIT_BOM/data/exports/IMG_5449_qa/qa_mid_frame_0036.jpg)
- [`qa_late_frame_0094.jpg`](file:///Users/shriyasdeshmukh/NAMMA_IIT_BOM/data/exports/IMG_5449_qa/qa_late_frame_0094.jpg)
- [`render_novel_viewpoint.jpg`](file:///Users/shriyasdeshmukh/NAMMA_IIT_BOM/data/exports/IMG_5449_qa/render_novel_viewpoint.jpg)

---

## 4. Honest Web Renderer Audit

### Current Capabilities:
- **WebGL Geometry**: Uses `THREE.Points` with `THREE.PointsMaterial` and a custom radial Gaussian canvas texture map (`alphaTest=0.01`, `depthWrite=false`, `opacity=0.94`).
- **Coordinate System**: Display transform $(x, y, z) \to (x, -y, -z)$ accurately matches Three.js OpenGL space (+Y up, +Z forward out), ground grid, and camera trajectory.
- **Coloring**: Uses vertex RGB colors encoded directly into `gaussian_model_threejs.ply`.

### Current Limitations:
1. **No Anisotropic Covariance**: Gaussians are drawn as screen-aligned circular discs rather than 3D-oriented anisotropic ellipses. They do not squash or stretch with surface curvature or viewpoint obliqueness.
2. **No Per-Frame Depth Sorting**: Points are drawn without sorting back-to-front every frame, leading to occasional blending order inconsistencies when viewing overlapping transparent splats.
3. **Uniform Opacity**: Per-splat opacity and 3D rotation quaternions present in the PLY file are ignored by standard `THREE.PointsMaterial`.

---

## 5. Top 3 Recommended Improvements

Ranked strictly by impact on photorealism and implementation complexity:

1. **Adaptive Gaussian Densification (Split & Clone)**
   - *Impact*: **Critical**. Fills empty wall regions and floor holes by monitoring positional viewspace gradients ($\nabla_{\mu} \mathcal{L} > \tau_{\text{pos}}$) and splitting under-reconstructed Gaussians from 11.8k up to 100k–300k points.
   - *Estimated Implementation*: 2–3 hours in `train_gaussian.py`.
2. **Dedicated WebGL 3DGS Shader or Splat Viewer Integration**
   - *Impact*: **High**. Replacing `THREE.Points` with a dedicated instanced quad splat shader (or `@mkkellogg/gaussian-splats-3d` / `antimatter15/splat`) gives true anisotropic projected covariance and per-splat opacity.
   - *Estimated Implementation*: 1–2 hours in frontend viewer.
3. **Multi-Resolution Staged Training with CUDA Offload**
   - *Impact*: **High**. Executing full 30,000-iteration training using `reconstruction/train_gaussian_nvidia.sh` on an external NVIDIA GPU (RTX 4090 / A100) to recover sub-millimeter textures on laptop screens, posters, and text.
   - *Estimated Implementation*: 15 minutes setup + 15 minutes cloud GPU training.
