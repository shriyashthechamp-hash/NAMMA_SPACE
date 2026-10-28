# Namma Space — Indoor 3D Digital Twin Platform

IIT Bombay Techfest Hackathon Project — Indoor 3D Digital Twin Platform that converts smartphone captures into an interactive, photorealistic indoor environment with POI search and obstacle-aware navigation.

---

## 1. System Requirements & Prerequisites

* **Hardware:** Apple Silicon Mac (M1/M2/M3/M4) or compatible ARM64/x86 workstation.
* **Operating System:** macOS Sonoma / Sequoia (detected: macOS 27.0.1 on Apple M4, 16 GB Unified Memory).
* **Python:** Python 3.12 (via Homebrew: `/opt/homebrew/bin/python3.12`).
* **Node.js:** Node.js v25+ (v25.8.1 installed, npm 11.11.0).
* **System Binaries:**
  - FFmpeg (v9.0.2 with VideoToolbox & NEON hardware acceleration enabled).
  - COLMAP (`brew install colmap` for Structure-from-Motion / Camera-pose estimation).

---

## 2. Quickstart & Installation

### Step A: Clone and Configure Environment
```bash
git clone <repo-url>
cd NAMMA_IIT_BOM
cp .env.example .env
```

### Step B: Setup Python Virtual Environment
```bash
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Step C: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 3. Running the Application Locally

### Terminal 1: Backend Server (FastAPI)
```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is accessible at:
- **Health Check:** `http://127.0.0.1:8000/health`
- **Interactive OpenAPI Docs:** `http://127.0.0.1:8000/docs`
- **Pipeline Status:** `http://127.0.0.1:8000/api/v1/pipeline/status`

### Terminal 2: Frontend Client (Vite + React Three Fiber)
```bash
cd frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 4. Verification & Running Tests

### Run Backend Automated Tests (Pytest)
```bash
./.venv/bin/pytest backend/tests -v
```

### Run Python Linting & Formatting (Ruff)
```bash
./.venv/bin/ruff check backend reconstruction
./.venv/bin/ruff format backend reconstruction
```

### Run Frontend TypeScript & Production Build
```bash
cd frontend
npm run lint
npm run build
```

---

## 5. Reconstruction Workflow: Video to Frames

### Step 1: Place Input Video
Place an indoor walkthrough video into `data/raw/` (e.g. `data/raw/room_tour.mp4`).

### Step 2: Extract Frames via CLI
```bash
./.venv/bin/python3 reconstruction/extract_frames.py data/raw/room_tour.mp4 --fps 2.0
```
Extracted frames are saved to `data/frames/room_tour/`.

### Step 3: Extract Frames via Backend API
```bash
curl -X POST http://127.0.0.1:8000/api/v1/pipeline/extract-frames \
  -H "Content-Type: application/json" \
  -d '{"video_filename": "room_tour.mp4", "target_fps": 2.0, "max_frames": 100}'
```

### Step 4: Run Structure-from-Motion (COLMAP)
```bash
./.venv/bin/python3 reconstruction/run_sfm.py data/frames/room_tour/
```

---

## 6. Implementation Status (Phase 0)

| Feature / Milestone | Status | Description |
| :--- | :--- | :--- |
| **Development Environment** | Complete | Apple Silicon M4 native environment, Python 3.12, Node.js v25 |
| **Backend API** | Complete | FastAPI with `/health`, `/pipeline/status`, CORS, and Pytest suite |
| **Hardware Acceleration** | Complete | FFmpeg 9.0.2 with VideoToolbox & NEON support |
| **Frame Extraction Pipeline** | Complete | CLI & API endpoints with path traversal validation & OpenCV fallback |
| **3D Web Viewer Shell** | Complete | React 18, Three.js, React Three Fiber, Orbit & First-Person controls |
| **Procedural Benchmark Room** | Complete | Clearly labeled test room with walls, doorways, desks, and landmarks |
| **Spatial POI Search** | Complete | Real-time POI search with filtering by category (room, desk, door) |
| **Obstacle-Aware Path Planning** | Complete | Demonstrates route routing through doorways rather than cutting walls |
| **Camera Pose Estimation (COLMAP)** | Script Ready | `reconstruction/run_sfm.py` prepared; install via `brew install colmap` |
| **Gaussian Splatting / Dense Mesh** | Next Phase | Planned for Phase 1 after capturing real IIT Bombay venue footage |

---

## 7. Troubleshooting

* **Issue:** `ModuleNotFoundError: No module named 'backend'` during manual pytest.
  - **Fix:** Run with pythonpath set, or invoke via `./.venv/bin/pytest backend/tests` (which reads `pytest.ini`).
* **Issue:** FFmpeg extraction fails.
  - **Fix:** Ensure FFmpeg is in PATH or `/opt/homebrew/bin/ffmpeg`. The pipeline includes an automatic OpenCV fallback if FFmpeg is absent.
