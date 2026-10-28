import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

interface PointCloudViewerProps {
  url: string;
  pointSize?: number;
  onPointCount?: (count: number) => void;
}

export const PointCloudViewer: React.FC<PointCloudViewerProps> = ({
  url,
  pointSize = 0.04,
  onPointCount,
}) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    let active = true;
    const loader = new PLYLoader();

    loader.load(
      url,
      (geom) => {
        if (!active) return;
        geom.computeVertexNormals();

        // Check if colors exist, otherwise create elevation-based coloring
        if (!geom.hasAttribute('color') && geom.hasAttribute('position')) {
          const positions = geom.getAttribute('position');
          const count = positions.count;
          const colors = new Float32Array(count * 3);

          let minY = Infinity;
          let maxY = -Infinity;
          for (let i = 0; i < count; i++) {
            const y = positions.getY(i);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const yRange = maxY - minY || 1.0;

          const color = new THREE.Color();
          for (let i = 0; i < count; i++) {
            const y = positions.getY(i);
            const normalizedY = (y - minY) / yRange;
            color.setHSL(0.55 - normalizedY * 0.45, 0.85, 0.55);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
          }
          geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        geom.center();
        geom.computeBoundingBox();
        if (geom.boundingBox) {
          const heightOffset = -geom.boundingBox.min.y;
          geom.translate(0, heightOffset, 0);
        }

        setGeometry(geom);
        if (onPointCount) {
          onPointCount(geom.getAttribute('position')?.count || 0);
        }
        setLoading(false);
      },
      undefined,
      (err) => {
        if (!active) return;
        console.error('Failed to load PLY:', err);
        setLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [url, onPointCount]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
    });
  }, [pointSize]);

  if (loading || !geometry) {
    return null;
  }

  return (
    <group>
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={1.0}
        maxDistance={35}
        dampingFactor={0.05}
      />
      <primitive object={new THREE.Points(geometry, material)} />
      {/* Visual Bounding Anchor */}
      <gridHelper args={[16, 32, '#06b6d4', '#1e293b']} position={[0, 0.01, 0]} />
    </group>
  );
};
