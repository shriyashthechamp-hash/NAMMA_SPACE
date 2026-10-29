import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { CameraPose } from '../types';

interface CameraTrajectoryProps {
  poses: CameraPose[];
  selectedPose: CameraPose | null;
  onSelectPose: (pose: CameraPose) => void;
  visible?: boolean;
}

export const CameraTrajectory: React.FC<CameraTrajectoryProps> = ({
  poses,
  selectedPose,
  onSelectPose,
  visible = true,
}) => {
  const [hoveredPose, setHoveredPose] = useState<CameraPose | null>(null);

  // Continuous 3D path line through camera centers (already in Three.js space)
  const lineGeometry = useMemo(() => {
    if (!poses || poses.length < 2) return null;
    const points: THREE.Vector3[] = [];
    for (const p of poses) {
      // position is already in Three.js space (x, -y_colmap, -z_colmap)
      points.push(new THREE.Vector3(p.position[0], p.position[1], p.position[2]));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [poses]);

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
      }),
    []
  );

  // Camera body box (thin rectangle to suggest a lens)
  const camBoxGeom = useMemo(() => new THREE.BoxGeometry(0.12, 0.08, 0.06), []);

  if (!visible || !poses || poses.length === 0) return null;

  return (
    <group name="camera-trajectory-group">
      {/* Path line */}
      {lineGeometry && <primitive object={new THREE.Line(lineGeometry, lineMaterial)} />}

      {poses.map((pose) => {
        const isSelected = selectedPose?.name === pose.name;
        const isHovered  = hoveredPose?.name === pose.name;
        const accentColor = isSelected ? '#10b981' : isHovered ? '#38bdf8' : '#0284c7';
        const scale       = isSelected ? 1.7 : isHovered ? 1.35 : 1.0;

        // Build camera orientation from Three.js-space forward and up vectors
        // (both already transformed with (x, -y, -z) in the JSON generator)
        const fwd = new THREE.Vector3(...(pose.forward as [number, number, number])).normalize();
        const upVec = pose.up
          ? new THREE.Vector3(...(pose.up as [number, number, number])).normalize()
          : new THREE.Vector3(0, 1, 0);

        // Build a rotation quaternion: camera box points its -Z (back) face toward viewer
        // Three.js Matrix4.lookAt: builds a basis where the object's -Z faces the target
        const mat4 = new THREE.Matrix4();
        // We want the camera frustum pointing along `fwd`
        // Object local -Z should align with fwd → lookAt(pos + fwd, up)
        const pos3 = new THREE.Vector3(...(pose.position as [number, number, number]));
        mat4.lookAt(pos3, pos3.clone().add(fwd), upVec);
        const orientation = new THREE.Quaternion().setFromRotationMatrix(mat4);

        return (
          <group
            key={pose.name}
            position={pose.position as [number, number, number]}
            quaternion={orientation}
            scale={[scale, scale, scale]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPose(pose);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredPose(pose);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoveredPose(null);
              document.body.style.cursor = 'default';
            }}
          >
            {/* Camera body */}
            <mesh geometry={camBoxGeom}>
              <meshStandardMaterial
                color={accentColor}
                emissive={accentColor}
                emissiveIntensity={isSelected ? 0.9 : isHovered ? 0.5 : 0.2}
                roughness={0.2}
                metalness={0.7}
              />
            </mesh>

            {/* Lens cylinder pointing forward (local +Z after lookAt) */}
            <mesh position={[0, 0, 0.045]}>
              <cylinderGeometry args={[0.025, 0.025, 0.04, 12]} />
              <meshBasicMaterial color={isSelected ? '#34d399' : '#38bdf8'} />
            </mesh>

            {/* Optical center dot */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.022, 10, 10]} />
              <meshBasicMaterial color={isSelected ? '#34d399' : '#06b6d4'} />
            </mesh>

            {/* Selection pulse ring in the plane perpendicular to forward */}
            {isSelected && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.14, 0.17, 32]} />
                <meshBasicMaterial
                  color="#34d399"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            )}

            {/* Tooltip */}
            {(isHovered || isSelected) && (
              <Html distanceFactor={10} position={[0, 0.22, 0]} center>
                <div
                  style={{
                    background: 'rgba(7,10,18,0.92)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${isSelected ? '#10b981' : '#06b6d4'}`,
                    padding: '4px 8px',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: isSelected ? '#10b981' : '#38bdf8',
                    }}
                  />
                  <span>#{pose.frame_number}</span>
                  <span style={{ color: '#94a3b8', fontSize: '9px' }}>
                    ({pose.timestamp_sec}s)
                  </span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};
