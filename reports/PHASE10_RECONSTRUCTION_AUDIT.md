# NAMMA SPACE — PHASE 10: RECONSTRUCTION QUALITY AUDIT

**Target Space**: Physical Room Walkthrough from `data/raw/IMG_5449.MOV`  
**Execution Environment**: Apple Silicon M4 (16 GB Unified Memory), macOS arm64, PyTorch MPS, COLMAP 4.2.1, React 18 / Three.js / `@mkkellogg/gaussian-splats-3d` v0.4.7  
**Audit Date**: 2026-10-29  
**Status**: COMPLETE — Non-invasive, Evidence-Supported Quality Diagnosis  

---

## Executive Summary

Both 3D Gaussian Splatting models (`3D Splats (11.8k)` and `Dense Splats (15.7k)`) now render cleanly in the live web application. However, visual inspection reveals noticeable reconstruction artifacts:
- **Fragmented, incomplete walls and hollow boundaries**
- **Discontinuous floor surfaces**
- **Blurry furniture details with fuzzy edges**
- **Floating Gaussian clusters suspended in empty space**

This audit systematically examined camera coverage, frame extraction, the PyTorch training implementation, parameter dynamics, and held-out validation views. 

### Core Audit Verdict

The visual degradation is **not caused by a single defect**, but by three compounding factors across the pipeline:

1. **Severe Trajectory Truncation & Discarded Submodels (Highest Impact)**:
   Extracting frames at a fixed 3.0 FPS dropped **95.0%** of the raw video frames ($2,595$ out of $2,732$). Rapid camera turns at $t \approx 17.7\text{s}$ and $t \approx 31.3\text{s}$ broke SIFT feature tracks, causing COLMAP to split the room into **5 disconnected submodels**. The pipeline naively selected only `models/1` (71 frames), **discarding the entire second half of the room walkthrough** (`models/2`, 39 frames, 5,370 points) and two transition sequences (`models/3` and `models/4`). In total, **48.2% of registered video footage was orphaned**.
2. **Missing Depth / Planar Priors on Textureless Surfaces**:
   100% of Gaussians were initialized strictly from sparse SIFT tie-points. Because whitewashed plaster walls and plain floors contain virtually zero SIFT keypoints, **no Gaussians were ever initialized there**. Phase 8 densification only split/cloned existing points on already-textured furniture and door edges, leaving walls and floors physically unpopulated.
3. **Discretized Spatial Gradients & Fixed-Footprint Additive Rasterizer**:
   The PyTorch rasterizer in `train_gaussian.py` clamps each Gaussian to a fixed $5 \times 5$ pixel bounding box and truncates coordinates to integer `.long()`, severing continuous spatial coordinate gradients. Across 250 iterations, Gaussians moved by a mean distance of only **$1.33\text{ cm}$** (max $3.8\text{ cm}$). Furthermore, training used order-independent additive accumulation at $266 \times 473$ without depth sorting, while the browser displays full volumetric sorted splats at 1080p.

---

## Audit A — Camera Coverage & Trajectory Analysis

### 1. Source Video Characteristics

The raw video `data/raw/IMG_5449.MOV` was probed via `ffprobe`:
- **Format**: 4K HEVC (`hvc1`), Apple iPhone capture
- **Resolution**: $3840 \times 2160$ pixels (landscape / rotated portrait)
- **Frame Rate**: $59.94\text{ fps}$ ($60000/1001$)
- **Duration**: $45.58\text{ seconds}$
- **Total Frames in Video**: **2,732 frames**
- **Bitrate**: $52.4\text{ Mbps}$

In Phase 3, `extract_frames.py` extracted at a fixed temporal rate of **3.0 FPS**, producing only **137 frames** (`frame_0001.jpg` to `frame_0137.jpg`). **95.0% of the raw captured temporal data was discarded.**

### 2. Trajectory Segmentation & The Unregistered Gaps

In `data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/rich_trajectory.json`:
- Total extracted frames: **137**
- Registered in Model 1: **71 frames (51.8%)**
- Unregistered in Model 1: **66 frames (48.2%)**

Analysis of the registered sequence reveals that Model 1 consists of **two isolated segments separated by an enormous spatial leap**:

```
[Frames 0001 – 0053]  ──────>  [GAP: Frames 0054 – 0076]  ──────>  [Frames 0077 – 0094]  ──────>  [TRUNCATED: Frames 0095 – 0137]
   (53 frames, path: 5.38m)           (23 frames DROPPED)              (18 frames, path: 6.21m)           (43 frames DROPPED)
   Desk & entry corridor             Turn across doorway               Second room section               Entire second half
                                     Trajectory jump: 5.53m!                                             Walkthrough ending
```

| Trajectory Metric | Segment 1 (`0001–0053`) | Segment 2 (`0077–0094`) | Inter-Segment Gap (`0053 -> 0077`) |
| :--- | :--- | :--- | :--- |
| **Frame Count** | 53 frames | 18 frames | 23 missing frames ($t = 17.7\text{s} - 25.3\text{s}$) |
| **$X$ (Lateral)** | $[+0.36, +1.71]\text{ m}$ | $[-4.19, -1.92]\text{ m}$ | Lateral leap: $\Delta X = 2.28\text{ m}$ |
| **$Y$ (Height)** | $[-0.97, -0.04]\text{ m}$ | $[+1.29, +2.59]\text{ m}$ | Height shift: $\Delta Y = 1.33\text{ m}$ |
| **$Z$ (Depth)** | $[+0.17, +3.60]\text{ m}$ | $[-9.24, -4.58]\text{ m}$ | Depth jump: $\Delta Z = 4.75\text{ m}$ |
| **Euclidean Baseline** | Mean step: $0.10\text{ m}$ | Mean step: $0.35\text{ m}$ | **Single-step jump: $5.53\text{ meters}$** |

### 3. Discovery: The Missing Geometry Exists in Discarded COLMAP Submodels

Inspection of `data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/experiment_metrics.json` uncovered the critical finding:

```json
{
  "total_submodels": 5,
  "best_model_sub": "1",
  "all_submodels": {
    "0": { "num_images": 5,  "num_points": 901,   "registered_frames": ["frame_0006.jpg", "..."] },
    "1": { "num_images": 71, "num_points": 11804, "registered_frames": ["frame_0001.jpg"..."0053", "0077"..."0094"] },
    "2": { "num_images": 39, "num_points": 5370,  "registered_frames": ["frame_0099.jpg"..."frame_0137.jpg"] },
    "3": { "num_images": 21, "num_points": 1271,  "registered_frames": ["frame_0052.jpg"..."frame_0072.jpg"] },
    "4": { "num_images": 24, "num_points": 3542,  "registered_frames": ["frame_0077.jpg"..."frame_0098.jpg"] }
  }
}
```

COLMAP **did register 133 of the 137 extracted frames** ($97.1\%$), but separated them into disjoint submodels because the fixed 3 FPS sampling created large angular steps during two sharp turns:
1. **`models/3`** registered frames 52 to 72 (the 21-frame transition through the doorway).
2. **`models/4`** registered frames 77 to 98 (24 frames bridging into the second chamber).
3. **`models/2`** registered frames 99 to 137 (39 frames containing **5,370 3D points** of the final room walkthrough).

Because the automated script simply took `best_model_sub = "1"`, **`models/2`, `models/3`, and `models/4` were completely discarded**. The 3D Gaussian Splatting pipeline in Phase 5 and Phase 8 only ever received `models/1`. The entire second room section (frames 99–137) was never trained upon.

### 4. Viewing Angle & Parallax Deficiency

Analysis of the camera optical directions for all 71 registered frames in `transforms.json`:
- **Pitch Angle**: Forward vector $Y$ component has a mean of **$+0.09$** (minimum $+0.02$, maximum $+0.26$). The camera was held nearly horizontal (tilted down by only $\approx 5.2^\circ$).
- **Forward Trajectory Dominance**: Forward vector $Z$ component has a mean of **$+0.88$** (up to $+1.00$).
- **Implication**:
  - The floor appears only in the lowest $20-30\%$ of each frame at a steep grazing angle.
  - Motion is predominantly longitudinal (walking along optical axis). Longitudinal camera motion provides very weak triangulation baseline for surfaces directly ahead (the aperture problem), resulting in high depth uncertainty.
  - No dedicated downward-looking passes were made to capture the floor plane, and no high-angle sweeps captured the ceiling.

---

## Audit B — Gaussian Initialization, Parameter Dynamics & Training Pipeline

### 1. Initialization Audit

Inspecting `reconstruction/train_gaussian.py` (lines 86–113) and `reconstruction/train_gaussian_dense.py`:

| Parameter | Initialization Rule | Physical Interpretation | Deficiency |
| :--- | :--- | :--- | :--- |
| **Position (`_xyz`)** | Direct copy of COLMAP `points3D.ply` | 11,804 sparse 3D tie points | Zero points on smooth plaster walls, ceiling, or floors |
| **Color (`_features_dc`)** | `(rgb - 0.5) / 0.28209` | Degree-0 Spherical Harmonics | Matches SIFT keypoint color accurately |
| **Scale (`_scaling`)** | `torch.full((N, 3), math.log(0.04))` | Isotropic radius of $4.0\text{ cm}$ | Wall/floor splats need large anisotropic discs ($0.2-1.0\text{ m}$) |
| **Rotation (`_rotation`)** | `[1.0, 0.0, 0.0, 0.0]` | Identity quaternion (axis-aligned) | Initialized with zero surface normal orientation |
| **Opacity (`_opacity`)** | `torch.full((N, 1), 1.386)` | $\text{sigmoid}(1.386) = 0.80$ | High initial opacity prevents background visibility |

### 2. Empirical Parameter Movement Audit

We conducted an empirical test tracking parameter displacement between the initial COLMAP checkpoint and iteration 250:

- **Position Displacement (`_xyz`)**:
  - **Mean displacement**: **$1.328\text{ cm}$**
  - **Median displacement**: **$1.240\text{ cm}$**
  - **Max displacement**: **$3.807\text{ cm}$**
  - **Gaussians that moved $< 1.0\text{ cm}$**: **$4,178 / 11,804$ ($35.4\%$)**
  - **Conclusion**: Gaussians essentially **never moved** from their initial sparse SIFT positions. They cannot migrate into textureless voids.

- **Rotation Parameter Drift (`_rotation`)**:
  - Mean absolute deviation from identity $[1, 0, 0, 0]$: **$0.046$** (Phase 5) $\to$ **$0.069$** (Phase 8).
  - Component gradient norm: $\lVert \nabla_{\text{rot}} \mathcal{L} \rVert \approx 5.80 \times 10^{-11}$.
  - **Conclusion**: Rotations remain virtually locked at their initial identity values.

### 3. PyTorch Rasterizer Deficiencies in `train_gaussian.py`

Inspecting `project_gaussians()` (lines 134–245):

```python
# Fixed 5x5 footprint clamp (line 212)
r = 2
dx = torch.arange(-r, r + 1, device=device) # [-2, -1, 0, 1, 2] -> 5x5 window
...
# Discrete integer indexing (line 226-228)
u_exp = (u.unsqueeze(1).float() + grid_x).long().clamp(0, img_w - 1)
v_exp = (v.unsqueeze(1).float() + grid_y).long().clamp(0, img_h - 1)
pixel_idx = v_exp * img_w + u_exp
...
# Order-independent additive accumulation (line 238-242)
color_flat.scatter_add_(0, flat_idx.expand(-1, 3), weighted_color.reshape(-1, 3))
alpha_flat.scatter_add_(0, flat_idx, weighted_alpha.reshape(-1, 1))
rendered_flat = color_flat / torch.clamp(alpha_clamped, min=1.0)
```

1. **Severed Spatial Gradients**: Casting `(u + grid_x).long()` truncates subpixel positions. Furthermore, `grid_x` is a fixed constant tensor, not $(x_{\text{pixel}} - u)$. The continuous position error does not backpropagate cleanly into $u, v$.
2. **Fixed 5x5 Window**: Regardless of how close a Gaussian is to the camera, it only touches 25 pixels. Large planar Gaussians cannot be rendered or learned during training.
3. **No Depth Sorting (Order-Independent Additive Averaging)**: Unlike the true 3DGS volume rendering equation ($C = \sum c_i \alpha_i \prod (1 - \alpha_j)$), this rasterizer adds all overlapping splats into an accumulator and normalizes by alpha. Points behind an opaque object shine through; occlusion relationships are never learned.
4. **No Loss Masking**: The loss `0.8 * L1 + 0.2 * (1 - SSIM)` is evaluated over the entire $266 \times 473$ image without masking unpopulated regions. Because $\sim 77\%$ of the image is black canvas `(0, 0, 0)` while the ground truth is white wall `(0.85, 0.85, 0.85)`, the loss is dominated by empty background error, starving the foreground Gaussians of fine photometric gradients.
5. **Resolution Discrepancy**: Training runs at downsampled $266 \times 473$ (`render_scale = 0.25`), whereas the browser WebGL viewer renders full-resolution $1080\text{p}$ with true depth-sorted EWA splatting.

### 4. Optimizer State Discard in Phase 8 Densification

In `reconstruction/train_gaussian_dense.py` (lines 272–285, 483):
- Every 50 iterations, `rebuild_optimizer()` instantiates a completely fresh `torch.optim.Adam()`.
- **All first ($m_t$) and second ($v_t$) momentum vectors are discarded and reset to zero.**
- Surviving Gaussians experience sudden learning rate shocks every 50 iterations, degrading convergence stability.

---

## Audit C — Quantitative and Visual Evaluation

### 1. Standardized 8-View Benchmark (Baseline vs Phase 8 Densified)

Re-evaluating the identical 8 held-out views from `transforms_val.json`:

| Validation Frame | Scene Regime Description | Baseline FG PSNR | Densified FG PSNR | Baseline Full PSNR | Densified Full PSNR | Baseline Coverage | Densified Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `frame_0001.jpg` | Initial doorway entry | $14.37\text{ dB}$ | **$15.37\text{ dB}$** | $3.60\text{ dB}$ | $3.75\text{ dB}$ | $27.1\%$ | **$30.0\%$** |
| `frame_0011.jpg` | **Furniture-Dominant (Desk)** | $17.69\text{ dB}$ | **$18.04\text{ dB}$** | $3.45\text{ dB}$ | $3.60\text{ dB}$ | $24.2\%$ | **$27.7\%$** |
| `frame_0021.jpg` | Furniture-Dominant (Monitors) | $14.53\text{ dB}$ | **$15.37\text{ dB}$** | $4.12\text{ dB}$ | $4.41\text{ dB}$ | $31.5\%$ | **$36.0\%$** |
| `frame_0031.jpg` | **Floor-Dominant (Carpet/Tiles)**| $13.77\text{ dB}$ | **$14.56\text{ dB}$** | $4.48\text{ dB}$ | $4.69\text{ dB}$ | $29.2\%$ | **$32.4\%$** |
| `frame_0041.jpg` | Floor-Dominant (Walkway) | $13.69\text{ dB}$ | **$14.22\text{ dB}$** | $3.65\text{ dB}$ | $3.78\text{ dB}$ | $18.1\%$ | **$20.9\%$** |
| `frame_0051.jpg` | **Wall-Dominant (Door Border)** | $14.81\text{ dB}$ | **$15.09\text{ dB}$** | $2.81\text{ dB}$ | $2.84\text{ dB}$ | $8.1\%$ | **$8.9\%$** |
| `frame_0084.jpg` | Workspace / Second Chamber | $15.15\text{ dB}$ | **$14.71\text{ dB}$** | $3.58\text{ dB}$ | $3.67\text{ dB}$ | $23.4\%$ | **$25.7\%$** |
| `frame_0094.jpg` | Wall-Dominant (Corridor End) | $13.05\text{ dB}$ | **$12.78\text{ dB}$** | $2.94\text{ dB}$ | $2.98\text{ dB}$ | $3.1\%$ | **$4.3\%$** |
| **8-View Mean** | **Reproducible Benchmark Suite**| **$14.63\text{ dB}$** | **$15.02\text{ dB}$** | **$3.58\text{ dB}$** | **$3.72\text{ dB}$** | **$20.6\%$** | **$23.2\%$** |

### 2. Side-by-Side Regime Analysis

#### A. Furniture-Dominant Regime (`frame_0011.jpg` — Desk Workspace)
- **Visual Appearance**: Peak quality across the dataset. The dark keyboard, monitor edges, laptop frame, and notebook are clearly recognizable.
- **Metrics**: Foreground PSNR reaches **$18.04\text{ dB}$**; Foreground L1 is **$0.0875$**.
- **Defects**: The desktop surface between objects is partially transparent; the whitewashed wall behind the desk is completely black canvas ($0\%$ coverage in top $40\%$ of frame).
- **Densification Effect**: Improved existing object sharpness (L1 on shared pixels dropped from $0.1383 \to 0.1164$), but fringe splits produced fuzzy boundaries on unpopulated background (L1 of new fringe pixels: $0.4085$).

#### B. Floor-Dominant Regime (`frame_0031.jpg` — Carpet & Walkway)
- **Visual Appearance**: Floor carpet displays sparse, disconnected patches of gray splats. The floor is not a continuous surface.
- **Metrics**: Foreground PSNR **$14.56\text{ dB}$**; Surface coverage **$32.4\%$**.
- **Defects**: Only carpet texture boundaries and baseboard edges have points. The central walkway where the camera looks down is a void.
- **Root Cause**: Shallow grazing angle ($5^\circ$ downward pitch) + absence of SIFT features on uniform carpet.

#### C. Wall-Dominant Regime (`frame_0051.jpg` & `frame_0094.jpg` — Walls & Corridor Ends)
- **Visual Appearance**: Near-total failure. Over **$91\%$ to $96\%$** of the frame is completely black. Only the rectangular door frame and a light switch appear as floating dots.
- **Metrics**: Surface coverage is only **$8.9\%$** (`frame_0051`) and **$4.3\%$** (`frame_0094`). Full-frame SSIM is virtually zero (**$0.0045$** on `frame_0094`).
- **Root Cause**: Zero SIFT keypoints on solid white plaster walls $\implies$ zero Gaussians initialized $\implies$ zero split/clone seeds.

### 3. Spatial Floaters & Outlier Point Analysis

Analyzing the 3D distribution of the initial 11,804 points:
- **Vertical Span**: In Three.js space ($+Y$ is up), points range from **$-15.71\text{ meters}$ to $+8.82\text{ meters}$** (a **$24.53\text{-meter}$ vertical span** for a room that is only $\sim 2.8\text{m}$ high).
- **Distant Outliers**:
  - Points within $3.0\text{ m}$ of any camera: **$3,641 / 11,804$ ($30.8\%$)**
  - Points $> 6.0\text{ m}$ away from any camera: **$3,311 / 11,804$ ($28.0\%$)**
  - Points $> 10.0\text{ m}$ away (extreme floaters): **$43 / 11,804$** (up to $30.98\text{ m}$)
- **Root Cause**: Low-parallax grazing-angle feature matches and specular reflections on fluorescent lights / monitor glass triangulated far outside the room. Neither Phase 5 nor Phase 8 pruned points based on physical room bounding box or camera distance.

### 4. Problem Attribution Matrix: Capture Deficiencies vs Pipeline Flaws

| Observed Defect | Primary Attribution | Contributing Mechanism |
| :--- | :--- | :--- |
| **Missing second half of room (frames 99-137)** | **Pipeline Flaw (70%)** / Capture (30%) | COLMAP reconstructed it into `models/2` (39 frames, 5,370 pts), but the pipeline discarded it |
| **Truncated walls (solid white plaster)** | **Pipeline Flaw (60%)** / Capture (40%) | No depth priors (Depth Anything) or planar initialization; SIFT cannot seed textureless walls |
| **Incomplete floor plane** | **Capture Deficiency (65%)** / Pipeline (35%) | Camera tilted only $5^\circ$ down; almost zero downward pitch during walkthrough |
| **Floating Gaussian clusters ($24\text{m}$ span)** | **Pipeline Flaw (80%)** / Capture (20%) | No spatial bounding-box pruning or camera-distance outlier filtering |
| **Blurry furniture edges** | **Pipeline Flaw (90%)** / Capture (10%) | Discretized `.long()` coordinates, fixed 5x5 footprint, and order-independent additive rasterizer |
| **5.53m jump between frame 53 and 77** | **Pipeline Flaw (80%)** / Capture (20%) | Rapid turn caused SIFT break at 3 FPS; `models/3` bridged the gap but was discarded |

---

## Findings Ranked by Likely Impact

| Rank | Issue | Impact Category | Primary Mechanism | Supporting Evidence & Source Files |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Orphaned Submodels (`models/2`, `3`, `4`) & 48.2% Missing Video Frames** | Critical Geometry Void | Submodel selection took only Model 1; 39 frames of the second half of the room were discarded | `exp1_3fps_singlecam/experiment_metrics.json`<br>`exp1_3fps_singlecam/rich_trajectory.json` |
| **2** | **Zero Initialization on Textureless Surfaces (White Walls & Ceiling)** | Severe Incompleteness | SIFT requires contrast; solid white walls have 0 points; densification cannot spawn points into empty voids | `phase5_gaussian/dataset/sparse/0/points3D.ply`<br>`compare_frame_0051.jpg` (coverage: 8.9%) |
| **3** | **Severed Spatial Gradients & Fixed 5x5 Footprint in Rasterizer** | Blur & Frozen Points | Integer truncation `.long()` and 5x5 footprint clamp points; mean movement across 250 iters was only 1.3 cm | `reconstruction/train_gaussian.py` (L212, L226)<br>`reconstruction/train_gaussian_dense.py` |
| **4** | **Unfiltered Background Outliers & Floating Clusters (24.5m vertical span)** | Visual Clutter | 28% of points are $> 6$m away; specular reflections triangulated into deep space | `phase5_gaussian/dataset/sparse/0/points3D.ply`<br>Elevation: min $-15.7$m, max $+8.8$m |
| **5** | **Order-Independent Additive Blending without Depth Sorting** | Occlusion Collapse | Scatter-add sums all overlapping splats without back-to-front sorting; foreground/background blend together | `reconstruction/train_gaussian.py` (L238-244)<br>WebGL viewer uses sorted volume rendering |
| **6** | **Optimizer Momentum Discard During Densification** | Training Instability | `rebuild_optimizer()` creates fresh Adam instance every 50 iters, resetting $m_t$ and $v_t$ to zero | `reconstruction/train_gaussian_dense.py` (L272-285) |

---

## Recommended Next Experiment: Dense MVS Seeding & Bounding-Box Pruned 3DGS

### Leading Hypothesis

> **Hypothesis**: Initializing 3D Gaussian Splatting from the **Phase 4 Filtered MVS Point Cloud** ($59,843$ points with dense planar surface coverage) rather than the sparse SIFT cloud ($11,804$ points), combined with **room bounding-box spatial pruning** ($Y \in [-2.0, +2.5]\text{ m}$, camera distance $\le 5.0\text{ m}$), will:
> 1. Increase surface coverage from **$23.2\% \to > 55\%$** across validation views.
> 2. Eliminate $> 95\%$ of the floating Gaussian clusters outside the room.
> 3. Provide dense initial Gaussian seeds across walls and floor without requiring a slow end-to-end retraining run.

### Experiment Specification

1. **Input Artifacts (Existing & Preserved)**:
   - Dense Point Cloud: `data/reconstruction_experiments/IMG_5449/phase4_dense/exports/dense_filtered_threejs.ply` ($59,843$ points with full RGB).
   - Validation Views: `data/reconstruction_experiments/IMG_5449/phase5_gaussian/dataset/transforms_val.json` (exact 8 held-out views).
2. **Execution Steps**:
   - Filter the $59,843$ MVS points by distance to camera trajectory ($\le 5.0\text{ m}$) and height ($Y \in [-2.0, +2.5]\text{ m}$ in Three.js space), yielding $\approx 42,000$ clean in-room points.
   - Initialize a new Gaussian model directly from these clean MVS points.
   - Run 150 iterations of fine-tuning with masked foreground loss (evaluating loss only within the bounding frustum).
   - Evaluate on the standardized 8 held-out views using `compare_densification.py`.
3. **Success Criteria**:
   - Surface coverage $> 50\%$ (up from $23.2\%$).
   - Foreground PSNR $> 16.0\text{ dB}$ on held-out views.
   - Zero floating clusters $> 6\text{ m}$ from trajectory.

### Expected Compute & Memory Cost on Apple Silicon M4 (16 GB Unified Memory)

| Resource | Value / Requirement | Feasibility on Apple Silicon M4 |
| :--- | :--- | :--- |
| **Gaussian Count** | $\approx 42,000$ points | Easily fits within GPU memory |
| **GPU Memory (MPS)** | $\approx 1.85\text{ GB}$ peak unified RAM | Well within 16 GB budget ($< 12\%$ allocation) |
| **Training Time (150 iters)** | **$\approx 35 - 45\text{ seconds}$** | Instant feedback loop on M4 MPS |
| **Disk Storage** | $\approx 4.5\text{ MB}$ for PLY export + checkpoint | Negligible |
| **Memory Swapping** | **$0\text{ MB}$ swap** | Completely in-memory execution |

---

## Conclusion & Next Actions

This audit establishes with concrete data that:
1. The **rendering failure** in the web app was caused by R3F component injection and double-update bugs in `GaussianSplatViewer.tsx` (now fully fixed and verified in Phase 9).
2. The **reconstruction quality limits** (fragmented walls, floaters, incomplete floor) stem from **discarding 3 of 4 COLMAP submodels** and relying on **sparse SIFT tie points with zero planar priors**.
3. All existing models, checkpoints, and evaluation artifacts remain strictly intact.
4. The smallest, high-impact path to dramatically improving visual quality on Apple Silicon M4 is to seed 3DGS from the existing $59.8\text{k}$ filtered MVS cloud with bounding-box floater pruning.

