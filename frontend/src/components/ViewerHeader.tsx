import React from 'react';
import { BackendHealth } from '../types';
import { Camera, Compass, RefreshCw, UploadCloud, Layers } from 'lucide-react';

export type SceneMode = 
  | 'phase4-dense'
  | 'phase4-dense-filtered'
  | 'phase4-mesh'
  | 'real-3fps'
  | 'real-2fps'
  | 'real-1fps'
  | 'benchmark'
  | 'synthetic-ply';

interface ViewerHeaderProps {
  health: BackendHealth | null;
  healthLoading: boolean;
  cameraMode: 'orbit' | 'first-person';
  sceneMode: SceneMode;
  onToggleCameraMode: () => void;
  onSelectSceneMode: (mode: SceneMode) => void;
  onResetView: () => void;
  onOpenCapture: () => void;
  onRefreshHealth: () => void;
}

export const ViewerHeader: React.FC<ViewerHeaderProps> = ({
  health,
  healthLoading,
  cameraMode,
  sceneMode,
  onToggleCameraMode,
  onSelectSceneMode,
  onResetView,
  onOpenCapture,
  onRefreshHealth,
}) => {
  return (
    <header style={{
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      pointerEvents: 'none',
    }}>
      {/* Brand & Project Identity */}
      <div className="glass-panel" style={{
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        pointerEvents: 'auto',
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)',
        }}>
          <Layers size={20} color="#040914" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.04em' }}>NAMMA SPACE</h1>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '2px 6px',
              borderRadius: 4,
            }}>
              Techfest Digital Twin
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Smartphone 3D Reconstruction & Spatial Navigation
          </p>
        </div>
      </div>

      {/* Backend & Tool Status Badges */}
      <div className="glass-panel" style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Backend:</span>
          {healthLoading ? (
            <span className="badge badge-test-mode">
              <span className="pulse-dot" /> Checking...
            </span>
          ) : health ? (
            <span className="badge badge-connected" title={`FastAPI v${health.version} - ${health.environment}`}>
              <span className="pulse-dot" /> Connected (v{health.version})
            </span>
          ) : (
            <span className="badge badge-disconnected" title="Backend not reachable on http://127.0.0.1:8000">
              <span className="pulse-dot" /> Offline
            </span>
          )}
        </div>

        {health && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: 4,
                background: health.tools.opencv ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: health.tools.opencv ? '#34d399' : '#f87171',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
              title="OpenCV Python integration"
            >
              CV2: {health.tools.opencv ? 'READY' : 'ABSENT'}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: 4,
                background: health.tools.ffmpeg ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: health.tools.ffmpeg ? '#34d399' : '#fbbf24',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
              title="FFmpeg video extraction binary"
            >
              FFmpeg: {health.tools.ffmpeg ? 'OK' : 'ABSENT'}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: 4,
                background: health.tools.colmap ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: health.tools.colmap ? '#34d399' : '#fbbf24',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
              title="COLMAP Structure-from-Motion binary"
            >
              COLMAP: {health.tools.colmap ? 'OK' : 'STANDBY'}
            </span>
          </div>
        )}

        <button
          className="btn"
          onClick={onRefreshHealth}
          title="Refresh Backend Health"
          style={{ padding: '6px', minWidth: 'auto' }}
        >
          <RefreshCw size={14} className={healthLoading ? 'spin-anim' : ''} />
        </button>
      </div>

      {/* Action & Viewport Controls */}
      <div className="glass-panel" style={{
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'auto',
      }}>
        {/* Scene Mode Selector */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 8,
          padding: 3,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          gap: 2,
        }}>
          <button
            className="btn"
            id="btn-mode-phase4-dense"
            onClick={() => onSelectSceneMode('phase4-dense')}
            title="Phase 4: Raw Fused Dense Point Cloud (72,756 points with RGB)"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'phase4-dense' ? '#ec4899' : 'transparent',
              background: sceneMode === 'phase4-dense' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
              color: sceneMode === 'phase4-dense' ? '#f472b6' : 'var(--text-secondary)',
              fontWeight: sceneMode === 'phase4-dense' ? 700 : 500,
            }}
          >
            <Layers size={14} />
            <span>Dense (72.8k)</span>
          </button>

          <button
            className="btn"
            id="btn-mode-phase4-dense-filtered"
            onClick={() => onSelectSceneMode('phase4-dense-filtered')}
            title="Phase 4: Filtered Dense Point Cloud (59,843 points, outlier-cleaned)"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'phase4-dense-filtered' ? '#8b5cf6' : 'transparent',
              background: sceneMode === 'phase4-dense-filtered' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
              color: sceneMode === 'phase4-dense-filtered' ? '#a78bfa' : 'var(--text-secondary)',
              fontWeight: sceneMode === 'phase4-dense-filtered' ? 700 : 500,
            }}
          >
            <span>Dense Clean (59.8k)</span>
          </button>

          <button
            className="btn"
            id="btn-mode-phase4-mesh"
            onClick={() => onSelectSceneMode('phase4-mesh')}
            title="Phase 4: Delaunay Surface Mesh (7,562 vertices, 15,298 faces)"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'phase4-mesh' ? '#f59e0b' : 'transparent',
              background: sceneMode === 'phase4-mesh' ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
              color: sceneMode === 'phase4-mesh' ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: sceneMode === 'phase4-mesh' ? 700 : 500,
            }}
          >
            <span>Mesh (15.3k)</span>
          </button>

          <button
            className="btn"
            id="btn-mode-real-3fps"
            onClick={() => onSelectSceneMode('real-3fps')}
            title="Phase 3: Best Curated Reconstruction at 3 fps (71 cameras, 11,804 points)"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'real-3fps' ? '#10b981' : 'transparent',
              background: sceneMode === 'real-3fps' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: sceneMode === 'real-3fps' ? '#34d399' : 'var(--text-secondary)',
              fontWeight: sceneMode === 'real-3fps' ? 700 : 500,
            }}
          >
            <Layers size={14} />
            <span>Sparse (11.8k)</span>
          </button>

          <button
            className="btn"
            id="btn-mode-real-2fps"
            onClick={() => onSelectSceneMode('real-2fps')}
            title="Phase 2: Baseline Reconstruction at 2 fps (47 cameras, 5,274 points)"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'real-2fps' ? '#06b6d4' : 'transparent',
              background: sceneMode === 'real-2fps' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: sceneMode === 'real-2fps' ? '#38bdf8' : 'var(--text-secondary)',
            }}
          >
            <span>SfM (2 fps • 5.3k)</span>
          </button>

          <button
            className="btn"
            id="btn-mode-real-1fps"
            onClick={() => onSelectSceneMode('real-1fps')}
            title="Phase 1: Original Reconstruction at 1 fps (16 cameras, 1,100 points)"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'real-1fps' ? '#06b6d4' : 'transparent',
              background: sceneMode === 'real-1fps' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: sceneMode === 'real-1fps' ? '#38bdf8' : 'var(--text-secondary)',
            }}
          >
            <span>Real SfM (1 fps)</span>
          </button>

          <button
            className="btn"
            id="btn-mode-room"
            onClick={() => onSelectSceneMode('benchmark')}
            title="Procedural Interactive Benchmark Chamber"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'benchmark' ? '#06b6d4' : 'transparent',
              background: sceneMode === 'benchmark' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: sceneMode === 'benchmark' ? '#38bdf8' : 'var(--text-secondary)',
            }}
          >
            <span>Benchmark Room</span>
          </button>

          <button
            className="btn"
            id="btn-mode-synth-ply"
            onClick={() => onSelectSceneMode('synthetic-ply')}
            title="Synthetic 10k Benchmark Point Cloud PLY"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              borderColor: sceneMode === 'synthetic-ply' ? '#06b6d4' : 'transparent',
              background: sceneMode === 'synthetic-ply' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: sceneMode === 'synthetic-ply' ? '#38bdf8' : 'var(--text-secondary)',
            }}
          >
            <span>Benchmark PLY</span>
          </button>
        </div>

        <button
          className={`btn ${cameraMode === 'first-person' ? 'btn-primary' : ''}`}
          onClick={onToggleCameraMode}
          title={cameraMode === 'orbit' ? 'Switch to First-Person WASD Walkthrough' : 'Switch to Orbit Controls'}
        >
          {cameraMode === 'orbit' ? <Compass size={16} /> : <Camera size={16} />}
          <span>{cameraMode === 'orbit' ? 'Orbit View' : 'First-Person'}</span>
        </button>

        <button className="btn" onClick={onResetView} title="Reset camera to origin">
          <RefreshCw size={14} />
          <span>Reset</span>
        </button>

        <button className="btn btn-primary" onClick={onOpenCapture} title="Upload smartphone video capture">
          <UploadCloud size={16} />
          <span>Import Capture</span>
        </button>
      </div>
    </header>
  );
};
