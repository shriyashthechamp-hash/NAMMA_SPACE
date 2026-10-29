import React, { useState, useEffect } from 'react';
import { CameraPose, UnregisteredFrame } from '../types';
import { ChevronLeft, ChevronRight, Play, Pause, Eye, CheckCircle2, AlertCircle, X, Maximize2 } from 'lucide-react';

interface SourceFrameInspectorProps {
  trajectory: CameraPose[];
  unregistered: UnregisteredFrame[];
  selectedPose: CameraPose | null;
  onSelectPose: (pose: CameraPose) => void;
  onFlyToPose?: (pose: CameraPose) => void;
  onClose?: () => void;
}

export const SourceFrameInspector: React.FC<SourceFrameInspectorProps> = ({
  trajectory,
  unregistered,
  selectedPose,
  onSelectPose,
  onFlyToPose,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Combine and sort all frames by frame_number
  const allFrames = React.useMemo(() => {
    const combined: (CameraPose | UnregisteredFrame)[] = [...trajectory, ...unregistered];
    return combined.sort((a, b) => a.frame_number - b.frame_number);
  }, [trajectory, unregistered]);

  // Active pose default
  const activePose = selectedPose || (trajectory.length > 0 ? trajectory[0] : null);

  // Auto-play through trajectory
  useEffect(() => {
    if (!isPlaying || trajectory.length === 0) return;

    const interval = setInterval(() => {
      if (!activePose) {
        onSelectPose(trajectory[0]);
        return;
      }
      const currentIndex = trajectory.findIndex((p) => p.name === activePose.name);
      const nextIndex = (currentIndex + 1) % trajectory.length;
      onSelectPose(trajectory[nextIndex]);
    }, 600);

    return () => clearInterval(interval);
  }, [isPlaying, activePose, trajectory, onSelectPose]);

  const handlePrev = () => {
    if (!activePose || trajectory.length === 0) return;
    const currentIndex = trajectory.findIndex((p) => p.name === activePose.name);
    const prevIndex = (currentIndex - 1 + trajectory.length) % trajectory.length;
    onSelectPose(trajectory[prevIndex]);
  };

  const handleNext = () => {
    if (!activePose || trajectory.length === 0) return;
    const currentIndex = trajectory.findIndex((p) => p.name === activePose.name);
    const nextIndex = (currentIndex + 1) % trajectory.length;
    onSelectPose(trajectory[nextIndex]);
  };

  const filteredFrames = allFrames.filter((f) => {
    if (filterMode === 'registered') return f.registered;
    if (filterMode === 'unregistered') return !f.registered;
    return true;
  });

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: isExpanded ? 460 : 380,
        maxHeight: '82vh',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={16} color="#06b6d4" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.03em' }}>
            SOURCE FRAME INSPECTOR
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn"
            style={{ padding: '4px 6px', minWidth: 'auto', background: 'transparent' }}
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Compress View' : 'Expand View'}
          >
            <Maximize2 size={13} color="#94a3b8" />
          </button>
          {onClose && (
            <button
              className="btn"
              style={{ padding: '4px 6px', minWidth: 'auto', background: 'transparent' }}
              onClick={onClose}
              title="Close Frame Inspector"
            >
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>
      </div>

      {/* Frame Preview Image & Meta */}
      {activePose && (
        <div style={{ padding: '12px 14px 6px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Main Frame Image */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: isExpanded ? 240 : 180,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#040711',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <img
              src={`http://127.0.0.1:8000${activePose.image_url}`}
              alt={activePose.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                // Fallback direct static URL
                (e.target as HTMLElement).style.display = 'none';
              }}
            />

            {/* Status Overlay Badge */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: activePose.registered ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)',
                color: '#fff',
                backdropFilter: 'blur(4px)',
              }}
            >
              {activePose.registered ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              <span>{activePose.registered ? 'REGISTERED 3D POSE' : 'UNREGISTERED'}</span>
            </div>

            {/* Frame Index Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: '0.7rem',
                fontWeight: 600,
                background: 'rgba(7, 10, 18, 0.85)',
                color: '#38bdf8',
                backdropFilter: 'blur(4px)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {activePose.name} • {activePose.timestamp_sec}s
            </div>
          </div>

          {/* Frame Trajectory Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn"
                onClick={handlePrev}
                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                title="Previous Keyframe"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button
                className="btn"
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  borderColor: isPlaying ? '#10b981' : undefined,
                  color: isPlaying ? '#34d399' : undefined,
                }}
                title={isPlaying ? 'Pause Auto Walkthrough' : 'Play Walkthrough Along Path'}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                className="btn"
                onClick={handleNext}
                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                title="Next Keyframe"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {onFlyToPose && (
              <button
                className="btn btn-primary"
                onClick={() => onFlyToPose(activePose)}
                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                title="Move 3D viewpoint to this camera pose"
              >
                <span>Focus View</span>
              </button>
            )}
          </div>

          {/* Spatial Coordinates Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.4)',
              padding: '8px 10px',
              borderRadius: 6,
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Position: </span>
              <code style={{ color: '#38bdf8' }}>
                [{activePose.position.map((v) => v.toFixed(2)).join(', ')}]
              </code>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Forward: </span>
              <code style={{ color: '#34d399' }}>
                [{activePose.forward.map((v) => v.toFixed(2)).join(', ')}]
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Filmstrip Filter & Title */}
      <div
        style={{
          padding: '8px 14px 4px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>
          Keyframe Strip ({trajectory.length} registered / {allFrames.length} total)
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setFilterMode('all')}
            style={{
              padding: '2px 6px',
              fontSize: '0.65rem',
              borderRadius: 4,
              border: 'none',
              background: filterMode === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: filterMode === 'all' ? '#38bdf8' : '#64748b',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('registered')}
            style={{
              padding: '2px 6px',
              fontSize: '0.65rem',
              borderRadius: 4,
              border: 'none',
              background: filterMode === 'registered' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: filterMode === 'registered' ? '#34d399' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Active ({trajectory.length})
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Filmstrip */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 14px 12px 14px',
          overflowX: 'auto',
          scrollBehavior: 'smooth',
        }}
      >
        {filteredFrames.map((frame) => {
          const isSelected = activePose?.name === frame.name;
          const isRegistered = frame.registered;

          return (
            <div
              key={frame.name}
              onClick={() => {
                if (isRegistered) {
                  onSelectPose(frame as CameraPose);
                }
              }}
              style={{
                flexShrink: 0,
                width: 68,
                cursor: isRegistered ? 'pointer' : 'not-allowed',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                opacity: isRegistered ? 1.0 : 0.45,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: 68,
                  height: 48,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: isSelected
                    ? '2px solid #10b981'
                    : isRegistered
                    ? '1px solid rgba(6, 182, 212, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  background: '#040711',
                }}
              >
                <img
                  src={`http://127.0.0.1:8000${frame.image_url}`}
                  alt={frame.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(16, 185, 129, 0.25)',
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'center',
                  color: isSelected ? '#34d399' : isRegistered ? '#94a3b8' : '#64748b',
                }}
              >
                #{frame.frame_number}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
