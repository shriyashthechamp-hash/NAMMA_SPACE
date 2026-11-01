









Transmission Index







Sector



Destination





01



The Vision





02



Experience NAMMA SPACE





03



Reconstruction Showcase





04



How It Works





05



Standard Operating Procedure





06



System Architecture





07



Technology Stack





08



Project Structure





09



Getting Started





10



API Reference





11



Validation & Technical Evidence





12



Reproducibility & Testing





13



Roadmap





14



The Team





15



Final Call



01 — THE VISION

What if every physical space could have a digital counterpart?

Indoor spaces are dense with geometry that photographs flatten: doorways, desks, corridors, lighting, and the path a person actually walked. NAMMA SPACE treats a smartphone walkthrough as the seed of a digital twin — not a slideshow of frames, and not a static mesh sitting in a folder.

The hard part is not taking video. The hard part is recovering camera motion, building consistent 3D structure, and then giving someone a way to roam that structure instead of staring at it.

NAMMA SPACE is built around one chain:



Indoor reconstruction is unforgiving: textureless walls starve feature matchers, rapid turns break COLMAP registration, and a pretty point cloud still cannot be explored until it is loaded into a viewer with real camera poses.

Interactive exploration is the point of the product. A sparse cloud proves geometry exists. A Gaussian splat proves appearance can be optimized. A browser viewer with orbit, trajectory, and source-frame inspection proves a human can enter the result.

This repository is the Round 1 system for IIT Bombay Techfest — 3D Reconstruction & Roaming, built by THE UNDERDOCS.



02 — EXPERIENCE NAMMA SPACE

Don't just read about it. Explore it.



The frontend boots into a three-act cinematic presentation, then can fracture into the reconstruction product viewer.







Mode



What it is



What it is not





Presentation (default)



Synthwave landing, a timed cinematic office walkthrough (OfficeWalkthroughScene), and a synchronized reconstruction panel



Not a photogrammetry of that cinematic office





Product viewer



Real reconstruction of IMG_5449.MOV loaded as PLY / Gaussian models, with scene-mode switching



Not a live upload-to-reconstruct product

Presentation controls (Act 02)

When the walkthrough section is on screen:







Input



Action





Space



Play / pause





← / →



Step backward / forward





R



Replay from the start

Product viewer — verified capabilities

Screenshots below are genuine local viewer captures from reports/submission_screenshots/, not mockups.









Default reconstruction mode: Phase 8 densified splats (15,735 Gaussians)





Source Frame Inspector: registered pose + original keyframe







Phase 4 dense MVS cloud (72,756 RGB points)





Procedural CAD benchmark room: POI search and doorway-aware routes

Reconstruction roaming (implemented)





Orbit: left-drag rotate, right-drag pan, scroll zoom



Scene switcher: Phase 13 / 12 / 8 / 5 Gaussians, dense / filtered dense, Delaunay mesh, sparse SfM variants



Camera trajectory overlay, grid toggle, elevation / cyan / original coloring on point clouds



Fly-to registered pose and source-frame inspection (wired for sparse + selected Gaussian modes)



Start Walkthrough on sparse 3 fps / 2 fps modes: jump to the first registered camera

Benchmark roaming (implemented only in the CAD test room)





First-person WASD + look is implemented in ProceduralTestRoom



Five labeled POIs and an obstacle-aware waypoint path that routes through the doorway instead of cutting walls

Not implemented (do not expect these in the reconstructed room)





Browser file-drop reconstruction — Capture drawer is a placeholder (alert + copy files to data/raw/)



POI search / path planning on the real Gaussian or MVS scene



First-person WASD inside the Gaussian splat viewer (that path uses orbit controls)

Reconstruction models are served by FastAPI from data/ at http://127.0.0.1:8000/api/v1/data/.... Several viewer URLs are hardcoded to localhost, so the product viewer needs the local backend even if VITE_API_BASE_URL is set.



03 — THE RECONSTRUCTION SHOWCASE

From raw capture to three-dimensional reality.

Primary capture: data/raw/IMG_5449.MOV — 45.58 s iPhone walkthrough, 1080×1920, 30 fps, HEVC. Best SfM run: 137 extracted frames, 71 registered cameras (51.8%).

Capture frames (undistorted registered views)









frame_0001 — start of trajectory





frame_0031 — interior coverage view





frame_0084 — held-out evaluation view

Viewer representations







Representation



What it demonstrates



Viewer mode





Sparse SfM cloud



Camera-registered 3D points from sequential SIFT matching



Sparse (11.8k)





Dense MVS cloud



Fused RGB surface points after dense reconstruction



Dense (72.8k)





Filtered dense



Same cloud after statistical outlier removal



Dense Clean (59.8k)





Delaunay mesh



Surface mesh, 7,562 vertices / 15,298 faces



Mesh (15.3k)





Phase 5 Gaussians



Baseline 3DGS seed from sparse points, 250 iters



3D Splats (11.8k)





Phase 8 Gaussians



Densified production default in the viewer



Dense Splats (15.7k)





Phase 12 Gaussians



Hybrid MVS + sparse seed



Enhanced Room (30.4k)





Phase 13 Gaussians



Extended 5,000-iter hybrid — labeled ★ Best Model



★ Best Model (30.4k)



Phase 5 baseline splats (11,804) — same capture, earlier optimization

Novel-view evidence (held-out frame_0031)

These are evaluation renders, not web-viewer screenshots. Ground truth vs Phase 8 vs Phase 13 from data/reconstruction_experiments/IMG_5449/phase14_diagnostic/.









Ground truth





Phase 8 prediction





Phase 13 prediction



Diagnostic strip for frame_0031 — GT / predictions / error / coverage



Diagnostic strip for frame_0084 — a higher-coverage interior view

Assets that are not shown as fake gallery tiles







Asset



Status





Raw .MOV in-README embed



Omitted — gitignored, large binary





COLMAP camera-path render from COLMAP GUI



Not stored as a dedicated image; trajectory is visualized in the web viewer





Phase 15 adaptive PLY



Experimental export exists; not wired into the scene switcher





Photoreal “final environment” still that hides holes



Intentionally not fabricated — coverage gaps are part of the evidence



04 — HOW IT WORKS

The engineering behind the experience.

The reconstruction code is a phased local pipeline on Apple Silicon: FFmpeg/OpenCV frames → COLMAP SfM → CPU dense/mesh path → custom PyTorch 3DGS trainers → FastAPI static serving → React Three Fiber viewer.

flowchart TB
  subgraph CAPTURE[IMPLEMENTED Capture]
    V[Smartphone video IMG_5449.MOV]
  end

  subgraph INGEST[IMPLEMENTED Ingestion]
    FE[extract_frames.py]
    FR[frames metadata contact sheet]
  end

  subgraph SFM[IMPLEMENTED Structure from Motion]
    CM[run_sfm.py COLMAP]
    SIFT[SIFT extraction]
    MATCH[Sequential matcher]
    MAP[Incremental mapper]
    SPAR[sparse PLY and trajectory JSON]
  end

  subgraph DENSE[IMPLEMENTED Dense and mesh on CPU]
    UD[image_undistorter]
    PM[patch_match_stereo CUDA only]
    FUS[Delaunay mesher and fusion]
    EXP[export_dense.py Three.js PLY]
  end

  subgraph GS[IMPLEMENTED Custom 3DGS on MPS]
    P5[Phase 5 baseline]
    P8[Phase 8 densify]
    P12[Phase 12 hybrid seed]
    P13[Phase 13 extended]
  end

  subgraph EXP15[EXPERIMENTAL not in viewer]
    P15[Phase 15 adaptive rasterizer]
  end

  subgraph SERVE[IMPLEMENTED Serve and view]
    API[FastAPI health pipeline static data]
    UI[React presentation and product Canvas]
    SPLAT[gaussian-splats-3d]
  end

  subgraph PLANNED[NOT IMPLEMENTED]
    UP[Browser upload-to-reconstruct]
    NAV[POI graph on real reconstruction]
    XR[WebXR / AR]
  end

  V --> FE --> FR --> CM
  CM --> SIFT --> MATCH --> MAP --> SPAR
  SPAR --> UD --> PM
  PM -.-> FUS
  UD --> FUS --> EXP
  SPAR --> P5 --> P8
  EXP --> P12 --> P13
  P13 -.-> P15
  SPAR --> API
  EXP --> API
  P8 --> API
  P13 --> API
  API --> UI --> SPLAT

Implemented. Frame extraction CLI + API. COLMAP sequential SfM. Dense/mesh export on CPU. Custom 3DGS trainers (DC spherical harmonics, MPS). Viewer modes listed in Section 03. Health/tool detection.

Experimental. Phase 14 diagnostic rasterizer audit. Phase 15 covariance-adaptive rasterizer and densification (train_phase15_adaptive.py). Smoke tests pass; the model is not a product-viewer mode.

Planned / incomplete. Textureless-wall completion, corridor-gap recovery (COLMAP missed frames 54–76), browser upload, navigation on the real twin, WebXR.

This is not the official INRIA/CUDA 3D Gaussian Splatting stack. Training is a project-local PyTorch implementation documented in reconstruction/ and reports/.



05 — STANDARD OPERATING PROCEDURE

Reproducible capture. Consistent reconstruction.

Guidance below is what docs/reconstruction.md and the reconstruction reports actually specify. No unpublished numeric “quality gates” are invented here.

1. Environment selection

Choose an indoor volume you can walk slowly, with overlapping views of the same surfaces. The evaluated scene is a single-camera walkthrough of a real interior (IMG_5449.MOV).

2. Environment preparation

Stable lighting. Avoid leaving non-image files (contact sheets, metadata.json) inside the COLMAP image folder — a prior run failed because COLMAP treated contact_sheet.jpg as a camera frame (CAMERA_SINGLE_DIM_ERROR in reports/IMG_5449_metrics.json).

3. Camera positioning and movement

From docs/reconstruction.md:





Walk slowly and steadily (~0.5 m/s)



Avoid abrupt rotations



Keep ~70–80% visual overlap between successive views



Loop back when possible to help close drift

The corridor discontinuity in this dataset is a 23-frame registration gap (frames 54–76) after a rapid rotation. That gap is a capture lesson, not a UI bug.

4. Lighting

Keep indoor lighting uniform. Harsh glare and featureless plaster reduce SIFT tracks. Textureless walls remain a documented limitation.

5. Recording format

Documented target: 1080p or 4K, 30 or 60 fps, H.264 / HEVC .mp4 or .mov. The evaluated clip is 1080×1920 portrait @ 30 fps.

6. Frame extraction

./.venv/bin/python reconstruction/extract_frames.py data/raw/IMG_5449.MOV --fps 3.0

CLI flags: --fps (default 2.0), --max-frames (default 300), --scale, --blur-threshold (default 0 = disabled). Outputs frames, image_list.txt, metadata.json, and a contact sheet.

The winning SfM experiment used 3.0 fps (137 frames), not the 2.0 fps default.

7. Quality checks before SfM





Only .jpg/.jpeg/.png in the image directory



Chronological image_list.txt



Enough overlap; COLMAP needs at least 3–5 images (run_sfm.py refuses fewer)

8. Reconstruction validation

run_sfm.py scores sub-models by point count, writes reconstruction_metrics.json, and exports sparse_points.ply. Dense/mesh validation is reconstruction/validate_dense.py. Gaussian quality is the 8-view held-out suite in evaluate_phase13.py / evaluate_standard.py.



06 — SYSTEM ARCHITECTURE

A look under the hood.

flowchart LR
  subgraph FE[Frontend Vite React 18]
    ACTS[Showcase acts]
    APP[App.tsx product Canvas]
    GSV[GaussianSplatViewer]
    PCV[PointCloudViewer]
    HUD[Metrics HUD and Frame Inspector]
  end

  subgraph BE[Backend FastAPI]
    H[GET /health]
    PSTAT[GET /pipeline/status]
    X[POST /pipeline/extract-frames]
    S[StaticFiles /api/v1/data]
  end

  subgraph DATA[data directory]
    RAW[raw videos]
    FRM[frames]
    EXP[IMG_5449 experiments]
  end

  subgraph REC[reconstruction scripts]
    CLI[extract_frames run_sfm run_dense]
    TR[Gaussian trainers]
  end

  subgraph DEP[Deployment files]
    VERCEL[pyproject Vercel FastAPI entry]
    RENDER[render.yaml uvicorn]
  end

  ACTS --> APP
  APP --> GSV
  APP --> PCV
  APP --> H
  APP --> PSTAT
  GSV --> S
  PCV --> S
  X --> RAW
  RAW --> CLI --> FRM --> EXP
  TR --> EXP
  S --> EXP
  RENDER --> BE
  VERCEL --> BE







Component



Responsibility





Frontend



Presentation narrative, WebGL reconstruction viewer, HUD, capture placeholder





Backend



Health, pipeline status, frame extraction API, static PLY/JSON serving





Reconstruction modules



Offline COLMAP + custom 3DGS; not invoked automatically by the UI





Data



Capture, frames, sparse/dense exports, experiment folders





Rendering



Three.js / R3F; Gaussian drop-in viewer; point/mesh fallback shaders





Deploy



Render blueprint for the API; Vercel Python entrypoint is configured in pyproject.toml (this is the likely cause of the current public 500)

Apple Silicon notes from project docs: COLMAP runs CPU SIFT (no CUDA). Dense patch_match_stereo requires NVIDIA CUDA and fails on this Mac. Delaunay meshing and the PyTorch MPS trainers are the CPU/Apple path.



07 — TECHNOLOGY STACK

Built with the right tools.

Only libraries and binaries found in dependency files or executed by scripts.







Layer



Verified tools





Frontend



React 18.3, Vite 5.4, TypeScript 5.6, Three.js 0.168, React Three Fiber 8.17, Drei 9.114, lucide-react, @mkkellogg/gaussian-splats-3d 0.4.7





Backend



FastAPI, Uvicorn, Pydantic v2, pydantic-settings, python-multipart





Computer vision



OpenCV headless, Pillow, NumPy, FFmpeg





3D reconstruction



COLMAP (SfM, undistorter, Delaunay mesher, model_converter)





Rendering / training



Custom PyTorch 3DGS on MPS; WebGL Gaussian viewer; Three.js points/mesh





Data processing



Frame extraction, blur Laplacian optional filter, trajectory JSON export





Quality



Pytest, Ruff (target-version = py312), ESLint, tsc && vite build





Infrastructure



render.yaml (Python web service), pyproject.toml Vercel FastAPI entrypoint, local Vite :5173

Torch is imported by training/eval scripts and is not pinned in backend/requirements.txt. Install PyTorch separately before running reconstruction/train_*.py.



08 — PROJECT STRUCTURE

Navigate the codebase.

NAMMA_IIT_BOM/
├── backend/app/main.py              # FastAPI app, CORS, /api/v1/data mount
├── backend/app/api/v1/endpoints/    # health.py, pipeline.py
├── backend/app/services/            # ReconstructionService
├── backend/app/core/config.py       # Settings from .env
├── backend/tests/                   # Pytest API tests
├── frontend/src/App.tsx             # Presentation vs product viewer
├── frontend/src/components/         # Viewers, HUD, showcase acts
├── frontend/src/services/api.ts     # VITE_API_BASE_URL client
├── reconstruction/extract_frames.py
├── reconstruction/run_sfm.py
├── reconstruction/run_dense.py
├── reconstruction/train_gaussian.py
├── reconstruction/train_phase13_extended.py
├── reconstruction/evaluate_phase13.py
├── reconstruction/test_rasterizer_smoke.py
├── data/reconstruction_experiments/IMG_5449/
├── docs/                            # Architecture, SOP, README assets
├── reports/                         # Metrics JSON + phase writeups
├── .env.example
├── pyproject.toml
├── pytest.ini
├── render.yaml
└── requirements.txt                 # -r backend/requirements.txt







Entry



Why it matters





backend/app/main.py



API + static reconstruction assets





frontend/src/App.tsx



Experience switch + all scene URLs





reconstruction/



Capture → SfM → dense → 3DGS





.env.example



CORS_ORIGINS, VITE_API_BASE_URL, tool paths





backend/tests/



Contract tests for health and extraction





data/reconstruction_experiments/IMG_5449/



Demo models the viewer loads





reports/



Numbers cited in Section 11





docs/assets/



This README’s visuals

Raw video, COLMAP databases, and training checkpoints are gitignored. Keep required PLY/JSON exports if you want the viewer to run after clone.



09 — GETTING STARTED

Run NAMMA SPACE locally.

Prerequisites





Python 3.12+ (pyproject.toml: requires-python = ">=3.12")



Node.js + npm (Vite 5 frontend)



FFmpeg on PATH (or set FFMPEG_PATH)



COLMAP on PATH for SfM (brew install colmap on macOS)



Optional: PyTorch with MPS/CPU for Gaussian training

1. Clone

git clone https://github.com/shriyashthechamp-hash/NAMMA_SPACE.git
cd NAMMA_SPACE
cp .env.example .env

2. Backend dependencies — repo-root terminal

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

Root requirements.txt only includes -r backend/requirements.txt (used by Render).

3. Environment variables

Names from .env.example — do not commit secrets.







Variable



Purpose





BACKEND_HOST / BACKEND_PORT



Documented local bind (127.0.0.1:8000)





ENVIRONMENT



Exposed on /health





CORS_ORIGINS



Comma-separated, JSON list, or *





DATA_DIR



Reconstruction/static root (default ./data)





FFMPEG_PATH / COLMAP_PATH



Binary locations





VITE_API_BASE_URL



Frontend health/status base URL

config.py defaults FFMPEG_PATH/COLMAP_PATH to /usr/bin/...; Homebrew installs usually live at /opt/homebrew/bin/... as in .env.example.

4. Run backend — Terminal 1

source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload





Health: http://127.0.0.1:8000/health



Swagger UI: http://127.0.0.1:8000/docs



OpenAPI: http://127.0.0.1:8000/api/v1/openapi.json

5. Frontend dependencies — Terminal 2

cd frontend
npm install

Create frontend/.env if needed:

VITE_API_BASE_URL=http://127.0.0.1:8000

6. Run frontend — Terminal 2

cd frontend
npm run dev

Open http://localhost:5173.

7. Reconstruction CLI (optional) — Terminal 3, venv on

./.venv/bin/python reconstruction/extract_frames.py data/raw/your_clip.mp4 --fps 2.0
./.venv/bin/python reconstruction/run_sfm.py data/frames/your_clip/

Dense / Gaussian stages have dedicated scripts (run_dense.py, train_gaussian.py, train_phase13_extended.py). See reconstruction/README.md.

Troubleshooting







Symptom



What to check





ModuleNotFoundError: backend



Run pytest from repo root; pytest.ini sets pythonpath = .





Frontend Connected badge is red



Backend not on :8000





Viewer loads but reconstruction is empty



Assets must exist under data/ and backend static mount must be up; many URLs ignore VITE_API_BASE_URL





FFmpeg extract fails



Install FFmpeg; service falls back to OpenCV





COLMAP missing



brew install colmap; /pipeline/status reports colmap_available





Dense stereo CUDA error



Expected on Apple Silicon — use the CPU Delaunay/export path already in run_dense.py





Public Vercel URL is 500



Observed FUNCTION_INVOCATION_FAILED; pyproject.toml sets a Python FastAPI Vercel entrypoint. Use local Vite for the experience.





Gaussian training import error



Install PyTorch; it is not in backend/requirements.txt



10 — API REFERENCE

How the system communicates.

Routes from backend/app/main.py and backend/app/api/v1/. Interactive docs exist on the local FastAPI process at /docs. Do not assume the public Vercel host currently serves this API.







Method



Endpoint



Purpose



Body / params



Response





GET



/



Project card



—



{ project, description, version, docs, health }





GET



/health



Liveness + tool probe



—



HealthResponse: status, version, environment, tools{ffmpeg,colmap,opencv}, system, message





GET



/api/v1/health



Same health handler on the v1 router



—



identical





GET



/api/v1/pipeline/status



Raw videos, sessions, binaries



—



raw_videos_count, extracted_sessions[], reconstruction_available, ffmpeg_available, colmap_available





POST



/api/v1/pipeline/extract-frames



Extract frames from data/raw/<file>



JSON: video_filename (required), target_fps (0.5–10, default 2), max_frames (5–2000, default 200)



success, message, output_directory, extracted_frames_count, frame_paths[]





GET



/api/v1/data/...



Static mount of DATA_DIR



path to PLY/JSON/images



file bytes

video_filename is sanitized with os.path.basename (no directory traversal). Missing files return 404.

There is no REST endpoint that runs COLMAP, dense MVS, or Gaussian training. Those are CLI scripts.



11 — VALIDATION & TECHNICAL EVIDENCE

Engineering should be provable.

All figures below name the model variant and source file. Do not mix foreground-support PSNR with full-canvas PSNR. Full-canvas scores are low because unoccupied background pixels stay dark while the ground-truth interiors are bright — this is documented in reports/PHASE9_SUBMISSION_QA.md and reports/standard_evaluation_metrics.json.

Capture / SfM — exp1_3fps_singlecam

Source: reports/IMG_5449_metrics.json







Quantity



Value





Video duration



45.58 s





Native fps / resolution



30 fps · 1080×1920





Extracted frames



137





Registered images



71 (51.82%)





Unregistered



66





Sparse points



11,804





Observations



90,403





Mean track length



7.66





Mean reprojection error



0.9769 px





Camera model



SIMPLE_RADIAL, shared, f=1722 px

Earlier 1 fps / 2 fps baselines in the same file are different experiments (16 and 47 registered images). Do not average them with 3 fps.

Dense / mesh — Phase 4

Source: reports/IMG_5449_phase4_dense_metrics.json







Quantity



Value





Raw dense points



72,756





Filtered dense points



59,843





Outliers removed



12,913 (17.7%)





Mesh vertices / faces



7,562 / 15,298





COLMAP GPU



false — PatchMatch CUDA unavailable

Gaussian comparison — 8 held-out views

Source: reconstruction/README.md and reports/IMG_5449_phase13_extended_metrics.json







Model



Gaussians



Train steps



FG-PSNR (dB)



SSIM



Coverage %





Phase 5 baseline



11,804



250



14.31



0.0454



20.52





Phase 8 densified



15,735



250



14.67



0.0522



23.18





Phase 11 MVS-seeded



27,340



150



13.55



0.0602



13.54





Phase 12 hybrid



30,369



200



14.72



0.0676



15.61





Phase 13 extended



30,369



5,000



18.23



0.1060



18.81

Phase 8 still wins global canvas coverage. Phase 13 wins foreground PSNR/SSIM by concentrating Gaussians on observed surfaces. Phase 13 frame_0094 (corridor) is 10.88 dB FG-PSNR / 5.8% coverage — the registration gap is visible in the metric, not hidden.

Standardized full-canvas means from reports/standard_evaluation_metrics.json:







Model



Full-canvas PSNR



Full-canvas SSIM



Coverage %



Secondary FG-PSNR





Phase 8



3.71 dB



0.0522



23.17



14.67 dB





Phase 13



3.53 dB



0.1060



18.83



18.23 dB

Phase 15 — experimental only

Source: reports/PHASE15_ADAPTIVE_DENSIFICATION_REPORT.md. Adaptive rasterizer + 1,000 iters reported coverage 18.83% → 51.4% and full-canvas PSNR 3.53 → 5.16 dB on the same 8 views. Most of the jump is the rasterizer support radius, not extra geometry. Not exposed in the viewer switcher.

Tests observed in-repo





Backend: backend/tests/test_health.py, test_pipeline.py (root, health, v1 health, pipeline status, extract success on synthetic_sweep.mp4, extract 404)



Rasterizer: reconstruction/test_rasterizer_smoke.py



Frontend: npm run lint, npm run build

Viewer “performance fps” is not recorded as a benchmark in the reports, so it is omitted.



12 — REPRODUCIBILITY & TESTING

Built to be reproduced.

Sample / demo data





Synthetic extraction fixture used by pytest: data/frames/synthetic_sweep (API test posts synthetic_sweep.mp4 in data/raw/)



Demo reconstruction: data/reconstruction_experiments/IMG_5449/**/exports/*.ply



Trajectory: .../exp1_3fps_singlecam/rich_trajectory.json



Source video itself is gitignored (data/raw/)

Backend tests — repo-root terminal

./.venv/bin/pytest backend/tests -v
./.venv/bin/ruff check backend reconstruction

Frontend validation — frontend/ terminal

cd frontend
npm run lint
npm run build

Reconstruction validation

source .venv/bin/activate
python reconstruction/evaluate_phase13.py
python reconstruction/evaluate_standard.py
python reconstruction/test_rasterizer_smoke.py

Phase 13 reproduction (from reconstruction/README.md):

python reconstruction/train_phase13_extended.py --smoke
python reconstruction/train_phase13_extended.py --iterations 5000

Known limitations





51.8% frame registration; corridor gap frames 54–76



Textureless walls under-reconstructed



DC-only spherical harmonics (no view-dependent shine)



Dense PatchMatch stereo needs CUDA



Capture UI does not ingest video



Product viewer depends on localhost static files



Phase 15 is experimental



Public Vercel URL was down at README verification time



13 — ROADMAP

The next frontier.

No dates. Status is inferred from code and reports, not from a marketing calendar.

COMPLETED
├── Local FastAPI health + frame-extraction API
├── COLMAP sequential SfM wrapper + metrics export
├── CPU dense/mesh export path + Three.js PLY
├── Custom MPS Gaussian trainers (Phases 5, 8, 11, 12, 13)
├── Web viewer: splats, clouds, mesh, trajectory, frame inspector
├── Cinematic three-act frontend
├── Procedural benchmark room with POI routes
└── Held-out evaluation reports and submission screenshots

IN PROGRESS / EXPERIMENTAL
├── Phase 14 rendering diagnostics
└── Phase 15 adaptive rasterizer + densification (not viewer-integrated)

PLANNED / NOT BUILT
├── Recover unregistered corridor frames (higher fps / better matching)
├── Textureless-wall priors
├── Degree-1/2 spherical harmonics
├── Real-scene navigation graph (beyond the CAD room)
├── Working browser upload pipeline
└── WebXR / AR (explicitly out of current scope)



14 — THE TEAM

Built by THE UNDERDOCS.

Competition: IIT Bombay Techfest — Round 1: 3D Reconstruction & Roaming.

















Shriyash Deshmukh



THE UNDERDOCS





Aarushi Singh



THE UNDERDOCS





Krisha Jogiya



THE UNDERDOCS

Individual role titles and social profiles are not listed here because they are not verified in this repository.



15 — FINAL CALL TO ACTION



THE WORLD IS PHYSICAL. ITS DIGITAL COUNTERPART IS WAITING.

NAMMA SPACE — TURN REAL SPACES INTO DIGITAL WORLDS.

THE UNDERDOCS

   

EXPLORE THE LIVE EXPERIENCE · EXPLORE THE SOURCE CODE



Indoor 3D reconstruction, shown honestly — including the holes.
