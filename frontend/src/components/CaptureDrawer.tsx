import React from 'react';
import { X, UploadCloud, Film, AlertTriangle, CheckCircle, Cpu } from 'lucide-react';
import { PipelineStatus } from '../types';

interface CaptureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineStatus: PipelineStatus | null;
}

export const CaptureDrawer: React.FC<CaptureDrawerProps> = ({
  isOpen,
  onClose,
  pipelineStatus,
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(4, 9, 20, 0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: 640,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <UploadCloud size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Indoor Video Capture Ingestion</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Stage 1: Smartphone Walkthrough Frame Extraction & Ingestion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Dropzone / Upload Placeholder */}
        <div style={{
          border: '2px dashed var(--border-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 12,
          background: 'rgba(15, 23, 42, 0.4)',
        }}>
          <Film size={36} color="#38bdf8" />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Drop smartphone walkthrough video (.mp4, .mov)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Or place video files directly into <code style={{ color: '#38bdf8' }}>data/raw/</code>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => alert('For hackathon Phase 0, copy your sample indoor video to data/raw/walkthrough.mp4')}>
            Select File from Device
          </button>
        </div>

        {/* Pipeline Pipeline Readiness Checklist */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
            <Cpu size={16} color="#38bdf8" />
            <span>Apple Silicon M4 Native</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
            {pipelineStatus?.ffmpeg_available ? (
              <CheckCircle size={16} color="#34d399" />
            ) : (
              <AlertTriangle size={16} color="#fbbf24" />
            )}
            <span>FFmpeg: {pipelineStatus?.ffmpeg_available ? 'Available' : 'Using OpenCV Fallback'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
            {pipelineStatus?.colmap_available ? (
              <CheckCircle size={16} color="#34d399" />
            ) : (
              <AlertTriangle size={16} color="#fbbf24" />
            )}
            <span>COLMAP SfM: {pipelineStatus?.colmap_available ? 'Available' : 'Pending brew install'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
            <CheckCircle size={16} color="#34d399" />
            <span>Raw Videos Found: {pipelineStatus?.raw_videos_count ?? 0}</span>
          </div>
        </div>

        {/* Engineering Caution Notice */}
        <div style={{
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          fontSize: '0.75rem',
          lineHeight: 1.4,
          color: '#fbbf24',
          display: 'flex',
          gap: 10,
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Technical Notice:</strong> Extracting video frames does not claim complete 3D reconstruction. Camera poses, sparse point clouds, dense mesh/splat generation, and navigation graphs are distinct sequential stages.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
