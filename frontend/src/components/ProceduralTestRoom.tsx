import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { PointOfInterest } from '../types';

interface ProceduralTestRoomProps {
  selectedPoi: PointOfInterest | null;
  pois: PointOfInterest[];
  onSelectPoi: (poi: PointOfInterest) => void;
  activePath: [number, number, number][] | null;
  cameraMode: 'orbit' | 'first-person';
}

// First person keyboard & mouse controller
function FirstPersonRig({ active }: { active: boolean }) {
  const { camera } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    const speed = 4.0 * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).negate().normalize();

    if (keys.current['KeyW'] || keys.current['ArrowUp']) camera.position.addScaledVector(forward, speed);
    if (keys.current['KeyS'] || keys.current['ArrowDown']) camera.position.addScaledVector(forward, -speed);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) camera.position.addScaledVector(right, speed);
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) camera.position.addScaledVector(right, -speed);

    // Keep camera at realistic eye height (1.65m)
    camera.position.y = 1.65;
  });

  return null;
}

export const ProceduralTestRoom: React.FC<ProceduralTestRoomProps> = ({
  selectedPoi,
  pois,
  onSelectPoi,
  activePath,
  cameraMode,
}) => {
  const controlsRef = useRef<any>(null);

  // Smoothly move orbit target to selected POI
  useEffect(() => {
    if (selectedPoi && controlsRef.current && cameraMode === 'orbit') {
      controlsRef.current.target.set(...selectedPoi.position);
    }
  }, [selectedPoi, cameraMode]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 8]} intensity={1.2} castShadow />
      <pointLight position={[0, 4, 0]} intensity={1.5} color="#38bdf8" distance={15} />
      <pointLight position={[-4, 3, -4]} intensity={0.8} color="#f59e0b" distance={10} />

      {cameraMode === 'orbit' ? (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          maxPolarAngle={Math.PI / 2 - 0.05} // Don't go below floor
          minDistance={1.5}
          maxDistance={25}
          dampingFactor={0.05}
        />
      ) : (
        <FirstPersonRig active={true} />
      )}

      {/* Test Environment Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#0b1120" roughness={0.7} metalness={0.2} />
      </mesh>
      <gridHelper args={[16, 32, '#38bdf8', '#1e293b']} position={[0, 0.01, 0]} />

      {/* Outer Boundary Walls */}
      <group>
        {/* North Wall */}
        <mesh position={[0, 1.75, -8]}>
          <boxGeometry args={[16, 3.5, 0.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        {/* South Wall */}
        <mesh position={[0, 1.75, 8]}>
          <boxGeometry args={[16, 3.5, 0.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        {/* West Wall */}
        <mesh position={[-8, 1.75, 0]}>
          <boxGeometry args={[0.2, 3.5, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        {/* East Wall */}
        <mesh position={[8, 1.75, 0]}>
          <boxGeometry args={[0.2, 3.5, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      </group>

      {/* Interior Divider / Room Partitions */}
      <group>
        {/* Corridor Partition with Doorway */}
        <mesh position={[-3, 1.75, 0]}>
          <boxGeometry args={[4, 3.5, 0.2]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        <mesh position={[3, 1.75, 0]}>
          <boxGeometry args={[4, 3.5, 0.2]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* Lintel over central door (2m wide opening from x=-1 to x=1) */}
        <mesh position={[0, 2.9, 0]}>
          <boxGeometry args={[2, 1.2, 0.2]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
      </group>

      {/* Obstacles (Desks, Workbenches) */}
      <group>
        {/* Lab Desk 1 */}
        <mesh position={[-4.5, 0.45, -4]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.9, 1.2]} />
          <meshStandardMaterial color="#475569" roughness={0.5} />
        </mesh>
        {/* Lab Desk 2 */}
        <mesh position={[4.5, 0.45, -4]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.9, 1.2]} />
          <meshStandardMaterial color="#475569" roughness={0.5} />
        </mesh>
        {/* Central Display Pedestal (Landmark) */}
        <mesh position={[0, 0.5, 4]} castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 1.1, 1.0, 32]} />
          <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* Points of Interest (POIs) Markers */}
      {pois.map((poi) => {
        const isSelected = selectedPoi?.id === poi.id;
        return (
          <group
            key={poi.id}
            position={poi.position}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPoi(poi);
            }}
          >
            {/* Pulsing Beacon Sphere */}
            <mesh position={[0, 0.8, 0]}>
              <sphereGeometry args={[isSelected ? 0.25 : 0.18, 16, 16]} />
              <meshStandardMaterial
                color={isSelected ? '#38bdf8' : '#10b981'}
                emissive={isSelected ? '#38bdf8' : '#10b981'}
                emissiveIntensity={isSelected ? 1.5 : 0.8}
              />
            </mesh>

            {/* Vertical Marker Stem */}
            <mesh position={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.8]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>

            {/* Label Billboard */}
            <Text
              position={[0, 1.25, 0]}
              fontSize={0.28}
              color={isSelected ? '#38bdf8' : '#f8fafc'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.03}
              outlineColor="#090d16"
            >
              {poi.name}
            </Text>
          </group>
        );
      })}

      {/* Active Navigation Path (Obstacle-Avoiding Route) */}
      {activePath && activePath.length > 1 && (
        <group>
          <Line
            points={activePath}
            color="#38bdf8"
            lineWidth={3.5}
            dashed={false}
          />
          {activePath.map((pt, i) => (
            <mesh key={`waypoint-${i}`} position={pt}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} />
            </mesh>
          ))}
        </group>
      )}

      {/* Test Room Disclaimer Label */}
      <Text
        position={[0, 0.05, -7.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#64748b"
        anchorX="center"
        anchorY="middle"
      >
        [ TEST GEOMETRY: PROCEDURAL BENCHMARK ROOM — NOT A RECONSTRUCTED TWIN ]
      </Text>
    </>
  );
};
