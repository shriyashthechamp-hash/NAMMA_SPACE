import React from 'react';
import { SceneMode } from './ViewerHeader';
import { CameraPose } from '../types';
import { Layers, Sliders, Eye, Cpu, ShieldCheck } from 'lucide-react';

interface ReconstructionMetricsHUDProps {
  sceneMode: SceneMode;
  realPointsCount: number | null;
  trajectory: CameraPose[];
  totalFramesCount: number;
  pointSize: number;
  onChangePointSize: (size: number) => void;
  showTrajectory: boolean;
  onToggleTrajectory: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  colorMode: 'elevation' | 'cyan' | 'original';
  onChangeColorMode: (mode: 'elevation' | 'cyan' | 'original') => void;
}

export const ReconstructionMetricsHUD: React.FC<ReconstructionMetricsHUDProps> = ({
  sceneMode,
  realPointsCount,
  trajectory,
  totalFramesCount,
  pointSize,
  onChangePointSize,
  showTrajectory,
  onToggleTrajectory,
  showGrid,
  onToggleGrid,
  colorMode,
  onChangeColorMode,
}) => {
  if (sceneMode === 'benchmark') return null;

  const isPhase8 = sceneMode === 'phase8-gaussian';
  const isPhase5 = sceneMode === 'phase5-gaussian';
  const isGaussian = isPhase8 || isPhase5;
  const isDense = sceneMode === 'phase4-dense';
  const isDenseFilt = sceneMode === 'phase4-dense-filtered';
  const isMesh = sceneMode === 'phase4-mesh';
  const is3fps = sceneMode === 'real-3fps';
  const is2fps = sceneMode === 'real-2fps';
  const is1fps = sceneMode === 'real-1fps';

  const title = isPhase8
    ? 'Phase 8: Adaptive Densified Splats'
    : isPhase5
    ? 'Phase 5: 3D Gaussian Splatting'
    : isDense
    ? 'Phase 4: Raw Fused Dense Cloud'
    : isDenseFilt
    ? 'Phase 4: Filtered Dense Cloud'
    : isMesh
    ? 'Phase 4: Delaunay Surface Mesh'
    : is3fps
    ? 'Phase 3: Curated 3.0 FPS Single-Cam SfM'
    : is2fps
    ? 'Phase 2: Improved Baseline (2.0 fps)'
    : is1fps
    ? 'Phase 1: Initial Baseline (1.0 fps)'
    : 'Synthetic Benchmark PLY';

  const badgeColor = isPhase8
    ? '#10b981'
    : isPhase5
    ? '#06b6d4'
    : isDense
    ? '#ec4899'
    : isDenseFilt
    ? '#8b5cf6'
    : isMesh
    ? '#f59e0b'
    : is3fps
    ? '#10b981'
    : is2fps
    ? '#38bdf8'
    : '#64748b';

  const camerasText = (isGaussian || isDense || isDenseFilt || isMesh || is3fps)
    ? `${trajectory.length || 71} / ${totalFramesCount || 137} (51.8%)`
    : is2fps
    ? `${trajectory.length || 47} / ${totalFramesCount || 91} (51.6%)`
    : is1fps
    ? '16 / 46 (34.8%)'
    : 'N/A';

  const pointsText = isPhase8
    ? `${realPointsCount ?? 15735} Densified Gaussians (+33%)`
    : isPhase5
    ? `${realPointsCount ?? 11804} 3D Gaussians (Cov + SH)`
    : isMesh
    ? `${realPointsCount ?? 7562} vertices • 15.3k faces`
    : isDense
    ? `${realPointsCount ?? 72756} pts (6.2x dense)`
    : isDenseFilt
    ? `${realPointsCount ?? 59843} pts (cleaned)`
    : (realPointsCount ?? (is3fps ? 11804 : is2fps ? 5274 : 1100));

  const reprojText = isPhase8
    ? 'PSNR: 15.02 dB (FG)'
    : isPhase5
    ? 'PSNR: 14.63 dB (FG)'
    : isMesh
    ? 'Graph-Cut Min-Cut'
    : (isDense || isDenseFilt)
    ? '100% RGB Colors'
    : (is3fps ? '0.98 px' : is2fps ? '0.98 px' : '0.72 px');

  const trackText = isPhase8
    ? '63 Train • 8 Val Views'
    : isPhase5
    ? '63 Training Views'
    : isMesh
    ? '15,298 Triangles'
    : isDense
    ? '72,756 Surface Pts'
    : isDenseFilt
    ? '59,843 Clean Pts'
    : (is3fps ? '7.66 obs/pt' : is2fps ? '6.26 obs/pt' : '4.12 obs/pt');

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        width: 380,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 12,
        borderLeft: `4px solid ${badgeColor}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
      }}
    >
      {/* Title & Phase Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color={badgeColor} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
            {title}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            background: `${badgeColor}22`,
            color: badgeColor,
            padding: '2px 6px',
            borderRadius: 4,
            border: `1px solid ${badgeColor}44`,
          }}
        >
          {isPhase8 ? 'PHASE 8 DENSE 3DGS' : isPhase5 ? 'PHASE 5 3DGS' : isDense || isDenseFilt || isMesh ? 'DENSE PHASE 4' : is3fps ? 'BEST SFM' : 'BASELINE'}
        </span>
      </div>

      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: -4 }}>
        Physical Source: <code>data/raw/IMG_5449.MOV</code> (Apple Silicon M4 MPS)
      </div>

      {/* Primary SfM Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '8px 10px',
          borderRadius: 8,
          fontSize: '0.74rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Cameras: </span>
          <strong style={{ color: '#f8fafc' }}>{camerasText}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>3D Points: </span>
          <strong style={{ color: '#38bdf8' }}>{pointsText.toLocaleString()}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Reproj Error: </span>
          <strong style={{ color: '#34d399' }}>{reprojText}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Track Strength: </span>
          <strong style={{ color: '#f59e0b' }}>{trackText}</strong>
        </div>
      </div>

      {/* Point Cloud & Trajectory Viewport Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
        {/* Point Size Slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#94a3b8' }}>
            <Sliders size={13} />
            <span>Point Size ({pointSize.toFixed(3)})</span>
          </div>
          <input
            type="range"
            min="0.015"
            max="0.12"
            step="0.005"
            value={pointSize}
            onChange={(e) => onChangePointSize(parseFloat(e.target.value))}
            style={{ width: 130, accentColor: '#06b6d4', cursor: 'pointer' }}
          />
        </div>

        {/* Display Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <button
            className="btn"
            onClick={onToggleTrajectory}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '0.7rem',
              borderColor: showTrajectory ? '#06b6d4' : undefined,
              color: showTrajectory ? '#38bdf8' : '#94a3b8',
              background: showTrajectory ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
            }}
          >
            <Eye size={12} />
            <span>Trajectory {showTrajectory ? 'ON' : 'OFF'}</span>
          </button>

          <button
            className="btn"
            onClick={onToggleGrid}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '0.7rem',
              borderColor: showGrid ? '#06b6d4' : undefined,
              color: showGrid ? '#38bdf8' : '#94a3b8',
              background: showGrid ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
            }}
          >
            <span>Grid {showGrid ? 'ON' : 'OFF'}</span>
          </button>

          <select
            value={colorMode}
            onChange={(e) => onChangeColorMode(e.target.value as any)}
            style={{
              padding: '4px 6px',
              fontSize: '0.7rem',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
            }}
          >
            <option value="elevation">Elevation Hue</option>
            <option value="cyan">Cyber Cyan</option>
            <option value="original">Original</option>
          </select>
        </div>
      </div>

      {/* Apple Silicon Hardware & MVS Diagnostics Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.68rem',
          color: '#64748b',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: 6,
        }}
      >
        <Cpu size={12} color="#06b6d4" />
        <span>Apple Silicon M4 • SIFT Sequential SfM • Real Camera Geometry</span>
        <ShieldCheck size={12} color="#10b981" style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  );
};
