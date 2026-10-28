import React from 'react';
import { BackendHealth } from '../types';
import { Camera, Compass, RefreshCw, UploadCloud, Layers } from 'lucide-react';

interface ViewerHeaderProps {
  health: BackendHealth | null;
  healthLoading: boolean;
  cameraMode: 'orbit' | 'first-person';
  sceneMode: 'benchmark' | 'pointcloud';
  onToggleCameraMode: () => void;
  onToggleSceneMode: () => void;
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
  onToggleSceneMode,
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
        <button
          className="btn"
          onClick={onToggleSceneMode}
          title="Toggle between Procedural Benchmark Geometry and Reconstructed Point Cloud (PLY)"
          style={{
            borderColor: sceneMode === 'pointcloud' ? '#06b6d4' : 'var(--border-subtle)',
            background: sceneMode === 'pointcloud' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-surface)',
            color: sceneMode === 'pointcloud' ? '#38bdf8' : 'var(--text-primary)',
          }}
        >
          <Layers size={15} />
          <span>{sceneMode === 'benchmark' ? 'View: Benchmark Room' : 'View: Point Cloud (.PLY)'}</span>
        </button>

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
