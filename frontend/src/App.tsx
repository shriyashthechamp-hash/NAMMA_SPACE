import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { ProceduralTestRoom } from './components/ProceduralTestRoom';
import { PointCloudViewer } from './components/PointCloudViewer';
import { ViewerHeader } from './components/ViewerHeader';
import { NavigationSidebar } from './components/NavigationSidebar';
import { CaptureDrawer } from './components/CaptureDrawer';
import { PointOfInterest, BackendHealth, PipelineStatus } from './types';
import { fetchHealth, fetchPipelineStatus } from './services/api';
import { Info, HelpCircle } from 'lucide-react';

const INITIAL_POIS: PointOfInterest[] = [
  {
    id: 'poi-1',
    name: 'Robotics Bench A',
    category: 'desk',
    position: [-4.5, 0, -4],
    description: 'Hardware prototyping & sensor calibration desk',
    walkable: false,
  },
  {
    id: 'poi-2',
    name: 'Control Desk B',
    category: 'desk',
    position: [4.5, 0, -4],
    description: 'Ground telemetry & monitoring terminal',
    walkable: false,
  },
  {
    id: 'poi-3',
    name: 'Central Doorway',
    category: 'door',
    position: [0, 0, 0],
    description: '2-meter wide opening connecting North & South chambers',
    walkable: true,
  },
  {
    id: 'poi-4',
    name: 'Techfest Pedestal',
    category: 'landmark',
    position: [0, 0, 4],
    description: 'Central circular presentation monument',
    walkable: false,
  },
  {
    id: 'poi-5',
    name: 'South Corridor Entrance',
    category: 'corridor',
    position: [0, 0, 6.5],
    description: 'Main facility entry/exit thoroughfare',
    walkable: true,
  },
];

export const App: React.FC = () => {
  const [pois] = useState<PointOfInterest[]>(INITIAL_POIS);
  const [selectedPoi, setSelectedPoi] = useState<PointOfInterest | null>(INITIAL_POIS[0]);
  const [activePath, setActivePath] = useState<[number, number, number][] | null>(null);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'first-person'>('orbit');
  const [sceneMode, setSceneMode] = useState<'benchmark' | 'pointcloud'>('benchmark');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  const loadBackendStatus = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }

    try {
      const p = await fetchPipelineStatus();
      setPipelineStatus(p);
    } catch {
      setPipelineStatus(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendStatus();
  }, [loadBackendStatus]);

  // Obstacle-aware route planning between POIs
  const handleCalculateRoute = (start: PointOfInterest, end: PointOfInterest) => {
    setSelectedPoi(end);

    const startPos = start.position;
    const endPos = end.position;
    const waypoints: [number, number, number][] = [];

    // Height offset so path line floats slightly above floor
    const y = 0.08;
    waypoints.push([startPos[0], y, startPos[2]]);

    // Obstacle avoidance check:
    // If start is in North room (z < 0) and end is in South room (z > 0),
    // or vice versa, the direct line hits the divider wall at z=0.
    // The path MUST route through the central doorway at [0, y, 0].
    const crossesDivider = (startPos[2] < 0 && endPos[2] > 0) || (startPos[2] > 0 && endPos[2] < 0);

    if (crossesDivider) {
      // Intermediate navigation waypoint before doorway
      waypoints.push([startPos[0] * 0.4, y, Math.sign(startPos[2]) * 0.8]);
      // Central doorway transit node
      waypoints.push([0, y, 0]);
      // Intermediate navigation waypoint after doorway
      waypoints.push([endPos[0] * 0.4, y, Math.sign(endPos[2]) * 0.8]);
    }

    waypoints.push([endPos[0], y, endPos[2]]);
    setActivePath(waypoints);
  };

  const handleClearRoute = () => {
    setActivePath(null);
  };

  const handleResetView = () => {
    setSelectedPoi(null);
    setActivePath(null);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Header */}
      <ViewerHeader
        health={health}
        healthLoading={healthLoading}
        cameraMode={cameraMode}
        sceneMode={sceneMode}
        onToggleCameraMode={() => setCameraMode(m => m === 'orbit' ? 'first-person' : 'orbit')}
        onToggleSceneMode={() => setSceneMode(s => s === 'benchmark' ? 'pointcloud' : 'benchmark')}
        onResetView={handleResetView}
        onOpenCapture={() => setIsCaptureOpen(true)}
        onRefreshHealth={loadBackendStatus}
      />

      {/* Spatial POI & Navigation Sidebar */}
      <NavigationSidebar
        pois={pois}
        selectedPoi={selectedPoi}
        onSelectPoi={(poi) => setSelectedPoi(poi)}
        onCalculateRoute={handleCalculateRoute}
        onClearRoute={handleClearRoute}
        hasActiveRoute={activePath !== null}
      />

      {/* 3D WebGL Canvas */}
      <div style={{ width: '100%', height: '100%' }}>
        <Canvas
          camera={{ position: [0, 8, 12], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <color attach="background" args={['#070a12']} />
          {sceneMode === 'benchmark' ? (
            <ProceduralTestRoom
              selectedPoi={selectedPoi}
              pois={pois}
              onSelectPoi={(poi) => setSelectedPoi(poi)}
              activePath={activePath}
              cameraMode={cameraMode}
            />
          ) : (
            <PointCloudViewer
              url="http://127.0.0.1:8000/api/v1/data/sparse/sample/benchmark_room.ply"
              pointSize={0.045}
            />
          )}
        </Canvas>
      </div>

      {/* Floating Viewport Legend & Controls Guide */}
      <div className="glass-panel" style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        padding: '10px 16px',
        fontSize: '0.74rem',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        color: 'var(--text-secondary)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HelpCircle size={14} color="#38bdf8" />
          <span>
            {cameraMode === 'orbit'
              ? 'Left-Click Drag: Rotate • Right-Click: Pan • Scroll: Zoom'
              : 'WASD / Arrow Keys: Move • Mouse: Look Around'}
          </span>
        </div>
        <div style={{ height: 12, width: 1, background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} color="#10b981" />
          <span>Click any 3D pin to focus</span>
        </div>
      </div>

      {/* Video Capture Drawer Modal */}
      <CaptureDrawer
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        pipelineStatus={pipelineStatus}
      />
    </div>
  );
};
export default App;
