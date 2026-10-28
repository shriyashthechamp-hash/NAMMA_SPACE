# Namma Space — System Architecture

Namma Space is an indoor 3D digital-twin platform converting smartphone-captured walkthrough photos and videos into an interactive, photorealistic indoor environment with POI search and obstacle-aware navigation.

---

## 1. High-Level Architecture

```
[ Smartphone Indoor Walkthrough Video (.mp4/.mov) ]
                       │
                       ▼
    [ Phase 1: Frame Extraction (FFmpeg / OpenCV) ]
                       │
                       ▼
    [ Phase 2: Camera Pose Estimation (COLMAP SfM) ]
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
[ Visual Digital Twin ]     [ Navigation Intelligence ]
- Gaussian Splats / 3D Mesh   - 2D/3D Obstacle & Collision Map
- Three.js / WebGL Rendering  - Walkable Surface Mesh
- Photorealistic Visuals       - POI Graph & A* Route Planner
        │                             │
        └──────────────┬──────────────┘
                       ▼
   [ Namma Space Browser Client (React Three Fiber) ]
```

---

## 2. Key Architectural Decisions

### A. Separation of Visual Twin vs Walkable Navigation Graph
* A photorealistic 3D visual reconstruction (Gaussian splats or high-density textured meshes) does **not** provide valid physics or collision bounds by default.
* A separate, geometrically validated navigation plane (walkable surfaces and obstacle bounding volumes) is maintained to compute routes that avoid walls, tables, and partitions.

### B. Apple Silicon Native Optimization
* **Homebrew & Native Python 3.12:** All Python and computer-vision packages are ARM64 native wheels.
* **FFmpeg:** Built with Apple Clang with `--enable-videotoolbox` and `--enable-neon` for hardware-accelerated video decode.
* **No CUDA Requirement:** Avoids cloud GPU lock-in during local prototyping. COLMAP feature extraction runs in multi-threaded CPU SIFT mode.

---

## 3. Directory Structure

```
NAMMA_IIT_BOM/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # /health, /pipeline/status, /pipeline/extract-frames
│   │   ├── core/              # Settings & path configurations
│   │   ├── schemas/           # Pydantic v2 validation models
│   │   ├── services/          # Reconstruction and CV services
│   │   └── main.py            # FastAPI entry point & CORS
│   ├── tests/                 # Automated pytest suite
│   └── requirements.txt       # Pinned dependencies
├── frontend/
│   ├── src/
│   │   ├── components/        # ProceduralTestRoom, NavigationSidebar, ViewerHeader, CaptureDrawer
│   │   ├── services/          # Fetch API client
│   │   ├── types/             # TypeScript interfaces for POIs, Health, Routes
│   │   ├── App.tsx            # Root component with R3F Canvas
│   │   └── index.css          # Cyber-teal dark theme & glassmorphism
│   ├── package.json
│   └── vite.config.ts
├── reconstruction/
│   ├── extract_frames.py      # CLI tool for video-to-frames extraction
│   └── run_sfm.py             # CLI runner for COLMAP Structure-from-Motion
├── data/
│   ├── raw/                   # Input video captures (.mp4, .mov)
│   ├── frames/                # Extracted image frames by session
│   ├── sparse/                # Sparse point cloud models & poses
│   └── dense/                 # Dense reconstruction / splats
└── docs/                      # Architecture, capture & setup documentation
```
