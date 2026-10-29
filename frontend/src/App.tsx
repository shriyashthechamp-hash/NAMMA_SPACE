import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { ProceduralTestRoom } from './components/ProceduralTestRoom';
import { PointCloudViewer } from './components/PointCloudViewer';
import { ViewerHeader, SceneMode } from './components/ViewerHeader';
import { NavigationSidebar } from './components/NavigationSidebar';
import { CaptureDrawer } from './components/CaptureDrawer';
import { ReconstructionMetricsHUD } from './components/ReconstructionMetricsHUD';
import { SourceFrameInspector } from './components/SourceFrameInspector';
import {
  PointOfInterest, BackendHealth, PipelineStatus,
  CameraPose, TrajectoryData, FirstCamera,
} from './types';
import { fetchHealth, fetchPipelineStatus } from './services/api';
import { Info, HelpCircle, PlayCircle, RotateCcw } from 'lucide-react';

const INITIAL_POIS: PointOfInterest[] = [
  { id: 'poi-1', name: 'Robotics Bench A',       category: 'desk',     position: [-4.5, 0, -4],  description: 'Hardware prototyping & sensor calibration desk', walkable: false },
  { id: 'poi-2', name: 'Control Desk B',          category: 'desk',     position: [4.5, 0, -4],   description: 'Ground telemetry & monitoring terminal',         walkable: false },
  { id: 'poi-3', name: 'Central Doorway',         category: 'door',     position: [0, 0, 0],      description: '2-meter wide opening connecting North & South chambers', walkable: true },
  { id: 'poi-4', name: 'Techfest Pedestal',       category: 'landmark', position: [0, 0, 4],      description: 'Central circular presentation monument',         walkable: false },
  { id: 'poi-5', name: 'South Corridor Entrance', category: 'corridor', position: [0, 0, 6.5],    description: 'Main facility entry/exit thoroughfare',          walkable: true },
];

export const App: React.FC = () => {
  const [pois] = useState<PointOfInterest[]>(INITIAL_POIS);
  const [selectedPoi, setSelectedPoi] = useState<PointOfInterest | null>(INITIAL_POIS[0]);
  const [activePath, setActivePath] = useState<[number, number, number][] | null>(null);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'first-person'>('orbit');
  const [sceneMode, setSceneMode] = useState<SceneMode>('real-3fps');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [realPointsCount, setRealPointsCount] = useState<number | null>(null);

  // Trajectory & Frame Inspection
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryData | null>(null);
  const [selectedPose, setSelectedPose] = useState<CameraPose | null>(null);
  // firstCamera: derived from trajectory JSON — the first registered COLMAP pose, already in Three.js space
  const [firstCamera, setFirstCamera] = useState<FirstCamera | null>(null);
  // flyToPosition: set to trigger a smooth view transition in PointCloudViewer
  const [flyToPosition, setFlyToPosition] = useState<[number, number, number] | null>(null);
  // walkthroughActive: flags that viewer should snap to first-camera view
  const [walkthroughKey, setWalkthroughKey] = useState<number>(0);
  const [isFrameInspectorOpen, setIsFrameInspectorOpen] = useState(true);

  // Viewport customization
  const [pointSize, setPointSize] = useState<number>(0.045);
  const [showTrajectory, setShowTrajectory] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<'elevation' | 'cyan' | 'original'>('elevation');

  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  const loadBackendStatus = useCallback(async () => {
    setHealthLoading(true);
    try { setHealth(await fetchHealth()); } catch { setHealth(null); }
    try { setPipelineStatus(await fetchPipelineStatus()); } catch { setPipelineStatus(null); }
    finally { setHealthLoading(false); }
  }, []);

  useEffect(() => { loadBackendStatus(); }, [loadBackendStatus]);

  // ── Load rich trajectory whenever scene mode changes ───────────────────────
  useEffect(() => {
    let trajectoryUrl = '';
    if (sceneMode === 'real-3fps') {
      trajectoryUrl = 'http://127.0.0.1:8000/api/v1/data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/rich_trajectory.json';
    } else if (sceneMode === 'real-2fps') {
      trajectoryUrl = 'http://127.0.0.1:8000/api/v1/data/sparse/IMG_5449_2fps/rich_trajectory.json';
    }

    if (!trajectoryUrl) {
      setTrajectoryData(null);
      setSelectedPose(null);
      setFirstCamera(null);
      return;
    }

    fetch(trajectoryUrl)
      .then((res) => { if (!res.ok) throw new Error('Trajectory not found'); return res.json(); })
      .then((data: TrajectoryData) => {
        setTrajectoryData(data);
        const first = data.trajectory?.[0] ?? null;
        setSelectedPose(first);
        // Extract first_camera from JSON (already in Three.js space)
        if (data.first_camera) {
          setFirstCamera(data.first_camera);
        } else if (first) {
          setFirstCamera({
            position: first.position,
            forward:  first.forward,
            up:       first.up ?? [0, 1, 0],
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load rich trajectory:', err);
        setTrajectoryData(null);
        setSelectedPose(null);
        setFirstCamera(null);
      });
  }, [sceneMode]);

  // ── POI Route Planning ─────────────────────────────────────────────────────
  const handleCalculateRoute = (start: PointOfInterest, end: PointOfInterest) => {
    setSelectedPoi(end);
    const y = 0.08;
    const waypoints: [number, number, number][] = [[start.position[0], y, start.position[2]]];
    const crosses = (start.position[2] < 0 && end.position[2] > 0) || (start.position[2] > 0 && end.position[2] < 0);
    if (crosses) {
      waypoints.push([start.position[0] * 0.4, y, Math.sign(start.position[2]) * 0.8]);
      waypoints.push([0, y, 0]);
      waypoints.push([end.position[0] * 0.4, y, Math.sign(end.position[2]) * 0.8]);
    }
    waypoints.push([end.position[0], y, end.position[2]]);
    setActivePath(waypoints);
  };

  const handleClearRoute = () => setActivePath(null);

  // ── View Controls ──────────────────────────────────────────────────────────
  /** Reset view to global overview */
  const handleResetView = () => {
    setSelectedPoi(null);
    setActivePath(null);
    setFlyToPosition(null);
  };

  /** Fly viewer to a specific camera pose position */
  const handleFlyToPose = (pose: CameraPose) => {
    // Place the viewer 2.5 units behind the pose, looking through it
    const fwd = pose.forward;
    const pos = pose.position;
    const len  = Math.sqrt(fwd[0]**2 + fwd[1]**2 + fwd[2]**2) || 1;
    const behindPos: [number, number, number] = [
      pos[0] - (fwd[0] / len) * 2.5,
      pos[1] - (fwd[1] / len) * 2.5,
      pos[2] - (fwd[2] / len) * 2.5,
    ];
    setFlyToPosition(behindPos);
  };

  /** "Start Walkthrough" — snap back to first registered camera view */
  const handleStartWalkthrough = () => {
    if (!trajectoryData?.trajectory?.length) return;
    const first = trajectoryData.trajectory[0];
    setSelectedPose(first);
    // Increment walkthroughKey to force InitialViewSetter to re-fire
    setWalkthroughKey(k => k + 1);
    setFlyToPosition(null);  // let InitialViewSetter handle it
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* ── Top Header ── */}
      <ViewerHeader
        health={health}
        healthLoading={healthLoading}
        cameraMode={cameraMode}
        sceneMode={sceneMode}
        onToggleCameraMode={() => setCameraMode(m => m === 'orbit' ? 'first-person' : 'orbit')}
        onSelectSceneMode={mode => setSceneMode(mode)}
        onResetView={handleResetView}
        onOpenCapture={() => setIsCaptureOpen(true)}
        onRefreshHealth={loadBackendStatus}
      />

      {/* ── POI Sidebar (benchmark mode only) ── */}
      {sceneMode === 'benchmark' && (
        <NavigationSidebar
          pois={pois}
          selectedPoi={selectedPoi}
          onSelectPoi={poi => setSelectedPoi(poi)}
          onCalculateRoute={handleCalculateRoute}
          onClearRoute={handleClearRoute}
          hasActiveRoute={activePath !== null}
        />
      )}

      {/* ── 3D Canvas ── */}
      {/* We pass a far-away initial camera; InitialViewSetter inside PointCloudViewer
          will immediately move it to the first registered COLMAP camera. */}
      <div style={{ width: '100%', height: '100%' }}>
        <Canvas
          camera={{ position: [0, 2, 8], fov: 55 }}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <color attach="background" args={['#070a12']} />

          {sceneMode === 'benchmark' && (
            <ProceduralTestRoom
              selectedPoi={selectedPoi}
              pois={pois}
              onSelectPoi={poi => setSelectedPoi(poi)}
              activePath={activePath}
              cameraMode={cameraMode}
            />
          )}

          {sceneMode === 'phase4-dense' && (
            <PointCloudViewer
              key={`phase4-dense-${walkthroughKey}`}
              url="http://127.0.0.1:8000/api/v1/data/reconstruction_experiments/IMG_5449/phase4_dense/exports/dense_threejs.ply"
              pointSize={pointSize * 0.75}
              colorMode={colorMode}
              renderMode="points"
              isPreTransformed={true}
              showTrajectory={showTrajectory}
              showGrid={showGrid}
              poses={trajectoryData?.trajectory || []}
              selectedPose={selectedPose}
              onSelectPose={p => setSelectedPose(p)}
              onPointCount={setRealPointsCount}
              firstCamera={firstCamera}
              flyToPosition={flyToPosition}
            />
          )}

          {sceneMode === 'phase4-dense-filtered' && (
            <PointCloudViewer
              key={`phase4-dense-filt-${walkthroughKey}`}
              url="http://127.0.0.1:8000/api/v1/data/reconstruction_experiments/IMG_5449/phase4_dense/exports/dense_filtered_threejs.ply"
              pointSize={pointSize * 0.75}
              colorMode={colorMode}
              renderMode="points"
              isPreTransformed={true}
              showTrajectory={showTrajectory}
              showGrid={showGrid}
              poses={trajectoryData?.trajectory || []}
              selectedPose={selectedPose}
              onSelectPose={p => setSelectedPose(p)}
              onPointCount={setRealPointsCount}
              firstCamera={firstCamera}
              flyToPosition={flyToPosition}
            />
          )}

          {sceneMode === 'phase4-mesh' && (
            <PointCloudViewer
              key={`phase4-mesh-${walkthroughKey}`}
              url="http://127.0.0.1:8000/api/v1/data/reconstruction_experiments/IMG_5449/phase4_dense/exports/mesh_threejs.ply"
              pointSize={pointSize}
              colorMode={colorMode}
              renderMode="mesh"
              isPreTransformed={true}
              showTrajectory={showTrajectory}
              showGrid={showGrid}
              poses={trajectoryData?.trajectory || []}
              selectedPose={selectedPose}
              onSelectPose={p => setSelectedPose(p)}
              onPointCount={setRealPointsCount}
              firstCamera={firstCamera}
              flyToPosition={flyToPosition}
            />
          )}

          {sceneMode === 'real-3fps' && (
            <PointCloudViewer
              key={`3fps-${walkthroughKey}`}
              url="http://127.0.0.1:8000/api/v1/data/reconstruction_experiments/IMG_5449/exp1_3fps_singlecam/sparse_points.ply"
              pointSize={pointSize}
              colorMode={colorMode}
              showTrajectory={showTrajectory}
              showGrid={showGrid}
              poses={trajectoryData?.trajectory || []}
              selectedPose={selectedPose}
              onSelectPose={p => { setSelectedPose(p); }}
              onPointCount={setRealPointsCount}
              firstCamera={firstCamera}
              flyToPosition={flyToPosition}
            />
          )}

          {sceneMode === 'real-2fps' && (
            <PointCloudViewer
              key={`2fps-${walkthroughKey}`}
              url="http://127.0.0.1:8000/api/v1/data/sparse/IMG_5449_2fps/sparse_points.ply"
              pointSize={pointSize}
              colorMode={colorMode}
              showTrajectory={showTrajectory}
              showGrid={showGrid}
              poses={trajectoryData?.trajectory || []}
              selectedPose={selectedPose}
              onSelectPose={p => setSelectedPose(p)}
              onPointCount={setRealPointsCount}
              firstCamera={firstCamera}
              flyToPosition={flyToPosition}
            />
          )}

          {sceneMode === 'real-1fps' && (
            <PointCloudViewer
              url="http://127.0.0.1:8000/api/v1/data/sparse/IMG_5449/sparse_points.ply"
              pointSize={pointSize * 1.3}
              colorMode={colorMode}
              showTrajectory={false}
              showGrid={showGrid}
              onPointCount={setRealPointsCount}
            />
          )}

          {sceneMode === 'synthetic-ply' && (
            <PointCloudViewer
              url="http://127.0.0.1:8000/api/v1/data/sparse/sample/benchmark_room.ply"
              pointSize={pointSize}
              colorMode={colorMode}
              showGrid={showGrid}
            />
          )}
        </Canvas>
      </div>

      {/* ── Reconstruction Metrics HUD (bottom-left) ── */}
      <ReconstructionMetricsHUD
        sceneMode={sceneMode}
        realPointsCount={realPointsCount}
        trajectory={trajectoryData?.trajectory || []}
        totalFramesCount={trajectoryData?.stats.total_frames || 0}
        pointSize={pointSize}
        onChangePointSize={setPointSize}
        showTrajectory={showTrajectory}
        onToggleTrajectory={() => setShowTrajectory(!showTrajectory)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        colorMode={colorMode}
        onChangeColorMode={setColorMode}
      />

      {/* ── Source Frame Inspector (bottom-right) ── */}
      {(sceneMode === 'real-3fps' || sceneMode === 'real-2fps') && isFrameInspectorOpen && trajectoryData && (
        <SourceFrameInspector
          trajectory={trajectoryData.trajectory}
          unregistered={trajectoryData.unregistered}
          selectedPose={selectedPose}
          onSelectPose={p => { setSelectedPose(p); handleFlyToPose(p); }}
          onFlyToPose={handleFlyToPose}
          onClose={() => setIsFrameInspectorOpen(false)}
        />
      )}

      {/* Re-open frame inspector */}
      {(sceneMode === 'real-3fps' || sceneMode === 'real-2fps') && !isFrameInspectorOpen && (
        <button
          className="btn glass-panel"
          onClick={() => setIsFrameInspectorOpen(true)}
          style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 20, padding: '8px 14px', fontSize: '0.75rem' }}
        >
          <Info size={14} color="#06b6d4" />
          <span>Open Frame Inspector</span>
        </button>
      )}

      {/* ── Start Walkthrough / Reset to Start (bottom-center) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Controls guide */}
        <div className="glass-panel" style={{ padding: '8px 14px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
          <HelpCircle size={13} color="#38bdf8" />
          <span>
            {cameraMode === 'orbit'
              ? 'Left-Drag: Rotate • Right-Drag: Pan • Scroll: Zoom'
              : 'WASD: Move • Mouse: Look Around'}
          </span>
        </div>

        {/* Start Walkthrough — only visible in real reconstruction modes */}
        {(sceneMode === 'real-3fps' || sceneMode === 'real-2fps') && firstCamera && (
          <>
            <button
              id="btn-start-walkthrough"
              className="btn btn-primary"
              onClick={handleStartWalkthrough}
              title="Jump to the first registered camera's viewpoint"
              style={{ padding: '8px 14px', fontSize: '0.75rem', gap: 6 }}
            >
              <PlayCircle size={15} />
              <span>Start Walkthrough</span>
            </button>

            {selectedPose && selectedPose !== trajectoryData?.trajectory?.[0] && (
              <button
                id="btn-reset-to-start"
                className="btn"
                onClick={handleStartWalkthrough}
                title="Reset to first camera position"
                style={{ padding: '8px 14px', fontSize: '0.75rem', gap: 6 }}
              >
                <RotateCcw size={14} />
                <span>Reset to Start</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Video Capture Modal ── */}
      <CaptureDrawer
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        pipelineStatus={pipelineStatus}
      />
    </div>
  );
};

export default App;
