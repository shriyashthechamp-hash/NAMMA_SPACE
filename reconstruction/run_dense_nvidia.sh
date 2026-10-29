#!/usr/bin/env bash
# ==============================================================================
# NAMMA SPACE — PHASE 4: NVIDIA CUDA DENSE RECONSTRUCTION HANDOFF SCRIPT
# ==============================================================================
# Run this script on any NVIDIA GPU server (AWS EC2 g4dn/g5, RunPod, Lambda Labs,
# or local Linux desktop with CUDA 11/12).
#
# Docker execution option:
#   docker run --gpus all -v $(pwd):/workspace -w /workspace colmap/colmap:latest \
#     bash reconstruction/run_dense_nvidia.sh
# ==============================================================================

set -euo pipefail

WORKSPACE_DIR="data/reconstruction_experiments/IMG_5449/phase4_dense/undistorted"
OUTPUT_DIR="data/reconstruction_experiments/IMG_5449/phase4_dense/exports"
LOGS_DIR="data/reconstruction_experiments/IMG_5449/phase4_dense/logs"

mkdir -p "$OUTPUT_DIR" "$LOGS_DIR"

echo "=========================================================="
echo " Starting COLMAP CUDA Dense Pipeline on NVIDIA GPU"
echo "=========================================================="

# Check GPU availability
nvidia-smi || { echo "ERROR: nvidia-smi failed. CUDA GPU required."; exit 1; }

# 1. PatchMatch Stereo Depth & Normal Estimation (GPU)
echo "[1/3] Running PatchMatch Stereo (CUDA)..."
colmap patch_match_stereo \
  --workspace_path "$WORKSPACE_DIR" \
  --workspace_format COLMAP \
  --PatchMatchStereo.max_image_size 2000 \
  --PatchMatchStereo.geom_consistency true \
  --PatchMatchStereo.gpu_index 0 2>&1 | tee "$LOGS_DIR/nvidia_patch_match.log"

# 2. Stereo Fusion into Fused Dense Point Cloud
echo "[2/3] Running Stereo Fusion..."
colmap stereo_fusion \
  --workspace_path "$WORKSPACE_DIR" \
  --workspace_format COLMAP \
  --input_type geometric \
  --output_path "$OUTPUT_DIR/colmap_fused_dense.ply" 2>&1 | tee "$LOGS_DIR/nvidia_stereo_fusion.log"

# 3. Poisson Surface Meshing
echo "[3/3] Running Poisson Mesher..."
colmap poisson_mesher \
  --input_path "$OUTPUT_DIR/colmap_fused_dense.ply" \
  --output_path "$OUTPUT_DIR/meshed-poisson-dense.ply" \
  --PoissonMeshing.trim 10 2>&1 | tee "$LOGS_DIR/nvidia_poisson_mesh.log"

echo "=========================================================="
echo " NVIDIA Dense Reconstruction Complete!"
echo " Outputs:"
echo "   - $OUTPUT_DIR/colmap_fused_dense.ply"
echo "   - $OUTPUT_DIR/meshed-poisson-dense.ply"
echo "=========================================================="
