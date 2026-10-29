import React, { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useThree, useFrame } from '@react-three/fiber';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { CameraTrajectory } from './CameraTrajectory';
import { CameraPose } from '../types';

/**
 * COORDINATE SYSTEM NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 * COLMAP uses OpenCV convention:
 *   World +Y = physically DOWN, +Z = forward (into scene)
 *   Camera local: +X right, +Y down, +Z into scene
 *
 * Three.js uses OpenGL convention:
 *   +Y = physically UP, +Z = out of screen
 *
 * Required transform (applied consistently to points, camera centers, and
 * direction vectors):
 *   threejs_pos = (colmap_x, -colmap_y, -colmap_z)
 *
 * The rich_trajectory.json is now pre-transformed into Three.js space.
 * The PLY file is still in COLMAP space, so we flip it below via geometry.
 */

interface PointCloudViewerProps {
  url: string;
  pointSize?: number;
  colorMode?: 'elevation' | 'cyan' | 'original';
  renderMode?: 'points' | 'mesh';
  isPreTransformed?: boolean;
  showWireframe?: boolean;
  showTrajectory?: boolean;
  showGrid?: boolean;
  poses?: CameraPose[];
  selectedPose?: CameraPose | null;
  onSelectPose?: (pose: CameraPose) => void;
  onPointCount?: (count: number) => void;
  firstCamera?: { position: [number, number, number]; forward: [number, number, number]; up: [number, number, number] } | null;
  flyToPosition?: [number, number, number] | null;
}

/** Internal: applies smooth fly-to whenever flyToPosition changes */
const FlyController: React.FC<{
  target: [number, number, number] | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}> = ({ target, controlsRef }) => {
  const { camera } = useThree();
  const flyActive  = useRef(false);
  const flyTarget  = useRef<THREE.Vector3>(new THREE.Vector3());
  const flyOrbit   = useRef<THREE.Vector3>(new THREE.Vector3());

  useEffect(() => {
    if (!target) return;
    flyTarget.current.set(...target);
    // Orbit target: 3 units ahead of fly destination in same direction as camera
    const dir = new THREE.Vector3().subVectors(flyTarget.current, camera.position).normalize();
    flyOrbit.current.copy(flyTarget.current).addScaledVector(dir, 3.0);
    flyActive.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

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

/** Internal: sets the initial camera view from the first registered COLMAP pose.
 *  Fires once on mount. The component is remounted (keyed by walkthroughKey in App)
 *  whenever the user clicks "Start Walkthrough" or "Reset to Start".
 */
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
    const up  = new THREE.Vector3(...firstCamera.up).normalize();

    // Viewer sits 3.5 units BEHIND the first camera, looking TOWARD the scene.
    // "Behind" = opposite of forward direction.
    const viewerPos = pos.clone().addScaledVector(fwd, -3.5);
    // OrbitControls target = a point 4 units ahead of the camera center.
    const orbitTarget = pos.clone().addScaledVector(fwd, 4.0);

    camera.position.copy(viewerPos);
    camera.up.copy(up);
    camera.lookAt(orbitTarget);

    if (controlsRef.current) {
      controlsRef.current.target.copy(orbitTarget);
      controlsRef.current.update();
    }
  // We intentionally only run this effect on mount (when ready flips true).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return null;
};

export const PointCloudViewer = forwardRef<
  { flyTo: (pos: [number, number, number], lookAt?: [number, number, number]) => void },
  PointCloudViewerProps
>(({
  url,
  pointSize = 0.045,
  colorMode = 'elevation',
  renderMode = 'points',
  isPreTransformed = false,
  showWireframe = false,
  showTrajectory = true,
  showGrid = true,
  poses = [],
  selectedPose = null,
  onSelectPose,
  onPointCount,
  firstCamera = null,
  flyToPosition = null,
}, ref) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Fly-to state passed from parent
  const [flyTarget, setFlyTarget] = useState<[number, number, number] | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo(pos, _lookAt) {
      setFlyTarget(pos);
    },
  }));

  // Sync flyToPosition prop -> internal state
  useEffect(() => {
    if (flyToPosition) setFlyTarget(flyToPosition);
  }, [flyToPosition]);

  useEffect(() => {
    setLoading(true);
    let active = true;
    const loader = new PLYLoader();

    loader.load(
      url,
      (geom) => {
        if (!active) return;

        // ── COORDINATE TRANSFORM ─────────────────────────────────────────────
        // PLY is in COLMAP world space: +Y physically DOWN, +Z forward.
        // Apply (x, -y, -z) if not already pre-transformed at export time.
        const positions = geom.getAttribute('position') as THREE.BufferAttribute;
        const count = positions.count;
        if (!isPreTransformed) {
          for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            positions.setXYZ(i, x, -y, -z);
          }
          positions.needsUpdate = true;
        }
        // ─────────────────────────────────────────────────────────────────────

        geom.computeVertexNormals();

        // Elevation-based coloring (after transform so Y is now "up")
        if (!geom.hasAttribute('color') || colorMode === 'elevation') {
          const posAttr = geom.getAttribute('position');
          const colors = new Float32Array(count * 3);
          let minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < count; i++) {
            const y = posAttr.getY(i);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const yRange = maxY - minY || 1.0;
          const color = new THREE.Color();
          for (let i = 0; i < count; i++) {
            const y = posAttr.getY(i);
            const t = (y - minY) / yRange;
            if (colorMode === 'elevation') {
              // floor=blue, mid=cyan, ceiling=gold
              color.setHSL(0.58 - t * 0.45, 0.88, 0.52 + t * 0.08);
            } else {
              color.setHSL(0.55, 0.9, 0.58);
            }
            colors[i * 3]     = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
          }
          geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        // Do NOT call geom.center() — the trajectory JSON is already in the same
        // pre-transform world space (not geometry-centered), so centering the PLY
        // separately would misalign it from the camera poses.
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        setGeometry(geom);
        if (onPointCount) onPointCount(count);
        setLoading(false);
      },
      undefined,
      (err) => {
        if (!active) return;
        console.error('Failed to load PLY:', err);
        setLoading(false);
      }
    );

    return () => { active = false; };
  }, [url, colorMode, onPointCount]);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: pointSize,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
  }), [pointSize]);

  if (loading || !geometry) return null;

  return (
    <group name="point-cloud-root">
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

      {/* Initial view from first registered COLMAP camera */}
      <InitialViewSetter
        firstCamera={firstCamera}
        controlsRef={controlsRef}
        ready={!loading && !!geometry}
      />

      {/* Smooth fly-to when a camera pose is selected */}
      <FlyController target={flyTarget} controlsRef={controlsRef} />

      {/* Geometry: Render as Mesh or Point Cloud based on renderMode */}
      {renderMode === 'mesh' ? (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            vertexColors={geometry.hasAttribute('color')}
            color={geometry.hasAttribute('color') ? undefined : '#38bdf8'}
            roughness={0.65}
            metalness={0.1}
            side={THREE.DoubleSide}
            wireframe={showWireframe}
          />
        </mesh>
      ) : (
        <primitive object={new THREE.Points(geometry, material)} />
      )}

      {/* Real Camera Trajectory & Frustums (poses already in Three.js space) */}
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
        <gridHelper args={[60, 60, '#06b6d4', '#1e293b']} position={[0, -0.05, 0]} />
      )}
    </group>
  );
});

PointCloudViewer.displayName = 'PointCloudViewer';
