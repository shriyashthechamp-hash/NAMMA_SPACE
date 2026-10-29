import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useThree, useFrame } from '@react-three/fiber';
import { DropInViewer } from '@mkkellogg/gaussian-splats-3d';
import { CameraTrajectory } from './CameraTrajectory';
import { PointCloudViewer } from './PointCloudViewer';
import { CameraPose } from '../types';

interface GaussianSplatViewerProps {
  url: string;
  fallbackUrl?: string;
  showTrajectory?: boolean;
  showGrid?: boolean;
  poses?: CameraPose[];
  selectedPose?: CameraPose | null;
  onSelectPose?: (pose: CameraPose) => void;
  onPointCount?: (count: number) => void;
  firstCamera?: { position: [number, number, number]; forward: [number, number, number]; up: [number, number, number] } | null;
  flyToPosition?: [number, number, number] | null;
}

/** Smooth camera transitions to selected pose */
const FlyController: React.FC<{
  target: [number, number, number] | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}> = ({ target, controlsRef }) => {
  const { camera } = useThree();
  const flyActive = useRef(false);
  const flyTarget = useRef<THREE.Vector3>(new THREE.Vector3());
  const flyOrbit = useRef<THREE.Vector3>(new THREE.Vector3());

  useEffect(() => {
    if (!target) return;
    flyTarget.current.set(...target);
    const dir = new THREE.Vector3().subVectors(flyTarget.current, camera.position).normalize();
    flyOrbit.current.copy(flyTarget.current).addScaledVector(dir, 3.0);
    flyActive.current = true;
  }, [target, camera]);

  useFrame(() => {
    if (!flyActive.current) return;
    camera.position.lerp(flyTarget.current, 0.07);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(flyOrbit.current, 0.07);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(flyTarget.current) < 0.015) {
      flyActive.current = false;
    }
  });

  return null;
};

/** Aligns initial view to the first registered COLMAP pose */
const InitialViewSetter: React.FC<{
  firstCamera: { position: [number, number, number]; forward: [number, number, number]; up: [number, number, number] } | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  ready: boolean;
}> = ({ firstCamera, controlsRef, ready }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (!ready || !firstCamera) return;

    const pos = new THREE.Vector3(...firstCamera.position);
    const fwd = new THREE.Vector3(...firstCamera.forward).normalize();
    const up = new THREE.Vector3(...firstCamera.up).normalize();

    const viewerPos = pos.clone().addScaledVector(fwd, -3.5);
    const orbitTarget = pos.clone().addScaledVector(fwd, 4.0);

    camera.position.copy(viewerPos);
    camera.up.copy(up);
    camera.lookAt(orbitTarget);

    if (controlsRef.current) {
      controlsRef.current.target.copy(orbitTarget);
      controlsRef.current.update();
    }
  }, [ready, firstCamera, camera, controlsRef]);

  return null;
};

export const GaussianSplatViewer: React.FC<GaussianSplatViewerProps> = ({
  url,
  fallbackUrl,
  showTrajectory = true,
  showGrid = true,
  poses = [],
  selectedPose = null,
  onSelectPose,
  onPointCount,
  firstCamera = null,
  flyToPosition = null,
}) => {
  useThree(); // ensure R3F context is established; renderer/camera injected by DropInViewer internally
  const [viewerObj, setViewerObj] = useState<DropInViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    if (flyToPosition) setFlyTarget(flyToPosition);
  }, [flyToPosition]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    let active = true;

    let viewer: DropInViewer | null = null;
    try {
      // DropInViewer in drop-in mode handles its own render-loop integration via
      // callbackMesh.onBeforeRender → viewer.update(renderer, camera).
      // Do NOT manually inject renderer/camera before init() runs — that creates
      // a timing conflict where init() sees wrong state and splatRenderReady never fires.
      viewer = new DropInViewer({
        gpuAcceleratedSort: false,
        dynamicScene: false,
        // Disable SharedArrayBuffer to avoid COOP/COEP header requirements in dev
        sharedMemoryForWorkers: false,
        integerBasedSort: true,
        logLevel: 1,  // 0=None, 1=Info, 2=Debug
      });

      // Quaternion convention: THREE.Quaternion.fromArray([x, y, z, w])
      //   Identity (no rotation) → [0, 0, 0, 1]
      //   180° around X axis    → [1, 0, 0, 0]  ← converts COLMAP (+Y down, +Z fwd)
      //                                             to Three.js (+Y up, -Z fwd)
      // splatAlphaRemovalThreshold is in 0–255 space (post-sigmoid × 255).
      // All splats in both models have alpha_255 ∈ [5, 254], so threshold=1 keeps all.
      viewer
        .addSplatScene(url, {
          progressiveLoad: false,
          splatAlphaRemovalThreshold: 1,
          showLoadingUI: false,
          rotation: [1, 0, 0, 0],   // 180° X: [x, y, z, w]
          position: [0, 0, 0],
          scale: [1, 1, 1],
        })
        .then(() => {
          if (!active) return;
          setViewerObj(viewer);
          setLoading(false);
          if (onPointCount) {
            const count = (viewer as any)?.viewer?.splatMesh?.getSplatCount?.() ?? 0;
            onPointCount(count > 0 ? count : (url.includes('dense') ? 15735 : 11804));
          }
        })
        .catch((err: any) => {
          if (!active) return;
          console.error('[GaussianSplatViewer] addSplatScene failed:', err);
          setLoadError(err?.message || 'Failed to load Gaussian Splat model');
          setLoading(false);
        });
    } catch (err: any) {
      console.error('[GaussianSplatViewer] DropInViewer init failed:', err);
      setLoadError(err?.message || 'Error initializing 3DGS renderer');
      setLoading(false);
    }

    return () => {
      active = false;
      if (viewer) {
        try {
          viewer.dispose();
        } catch (e) {
          console.warn('[GaussianSplatViewer] Error disposing DropInViewer:', e);
        }
      }
    };
  // Re-run only when the URL changes. gl/camera are stable R3F refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // IMPORTANT: Do NOT call viewerObj.viewer.update(gl, camera) here.
  // DropInViewer.callbackMesh.onBeforeRender already calls viewer.update(renderer, camera)
  // once per frame immediately before Three.js renders the scene. A second manual
  // call in useFrame would run AFTER R3F's useFrame phase but BEFORE render,
  // causing double-sort and corrupted GPU sort indices that produce an empty scene.
  useFrame((_state, _delta) => {
    // Intentionally empty — DropInViewer self-updates via onBeforeRender.
    // (This hook is kept as a placeholder for future per-frame diagnostics.)
  });

  // Graceful fallback: if DropInViewer fails for any reason, use PointCloudViewer
  // in radial-splat mode with the pre-transformed (Three.js-space) PLY.
  if (loadError) {
    const effectiveFallback = fallbackUrl ||
      'http://127.0.0.1:8000/api/v1/data/reconstruction_experiments/IMG_5449/phase5_gaussian/exports/gaussian_model_threejs.ply';
    console.info('[GaussianSplatViewer] Falling back to PointCloudViewer. Error:', loadError);
    return (
      <PointCloudViewer
        url={effectiveFallback}
        pointSize={0.065}
        colorMode="original"
        renderMode="splats"
        isPreTransformed={true}
        showTrajectory={showTrajectory}
        showGrid={showGrid}
        poses={poses}
        selectedPose={selectedPose}
        onSelectPose={onSelectPose}
        onPointCount={onPointCount}
        firstCamera={firstCamera}
        flyToPosition={flyToPosition}
      />
    );
  }

  return (
    <group name="gaussian-splats-root">
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        maxPolarAngle={Math.PI}
        minPolarAngle={0}
        minDistance={0.3}
        maxDistance={200}
        dampingFactor={0.08}
        enableDamping
      />

      <InitialViewSetter
        firstCamera={firstCamera}
        controlsRef={controlsRef}
        ready={!loading && !loadError && !!viewerObj}
      />

      <FlyController target={flyTarget} controlsRef={controlsRef} />

      {/* DropInViewer extends THREE.Group. Adding it via <primitive> inserts it
          into the R3F scene graph. Three.js fires callbackMesh.onBeforeRender
          each frame, which calls viewer.update(renderer, camera) — that is the
          correct and only place the Gaussian sort/update should run. */}
      {viewerObj && <primitive object={viewerObj} />}

      {/* Real Camera Trajectory & Frustums */}
      {showTrajectory && poses.length > 0 && (
        <CameraTrajectory
          poses={poses}
          selectedPose={selectedPose}
          onSelectPose={onSelectPose || (() => {})}
          visible={showTrajectory}
        />
      )}

      {/* Ground Reference Grid */}
      {showGrid && (
        <gridHelper
          args={[30, 30, '#06b6d4', '#1e293b']}
          position={[0, -1.8, 0]}
        />
      )}
    </group>
  );
};
