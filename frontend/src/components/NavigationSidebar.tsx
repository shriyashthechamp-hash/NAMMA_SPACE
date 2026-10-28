import React, { useState } from 'react';
import { PointOfInterest, POICategory } from '../types';
import { Search, MapPin, Navigation, ShieldCheck, DoorOpen, LayoutGrid, Milestone } from 'lucide-react';

interface NavigationSidebarProps {
  pois: PointOfInterest[];
  selectedPoi: PointOfInterest | null;
  onSelectPoi: (poi: PointOfInterest) => void;
  onCalculateRoute: (startPoi: PointOfInterest, endPoi: PointOfInterest) => void;
  onClearRoute: () => void;
  hasActiveRoute: boolean;
}

const categoryIcons: Record<POICategory, React.ReactNode> = {
  room: <LayoutGrid size={15} color="#38bdf8" />,
  door: <DoorOpen size={15} color="#10b981" />,
  desk: <MapPin size={15} color="#f59e0b" />,
  corridor: <Navigation size={15} color="#a855f7" />,
  landmark: <Milestone size={15} color="#ec4899" />,
};

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  pois,
  selectedPoi,
  onSelectPoi,
  onCalculateRoute,
  onClearRoute,
  hasActiveRoute,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [routeStartId, setRouteStartId] = useState<string>(pois[0]?.id || '');
  const [routeEndId, setRouteEndId] = useState<string>(pois[1]?.id || '');

  const filteredPois = pois.filter((poi) => {
    const matchesSearch = poi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      poi.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || poi.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handlePlanRoute = () => {
    const start = pois.find(p => p.id === routeStartId);
    const end = pois.find(p => p.id === routeEndId);
    if (start && end) {
      onCalculateRoute(start, end);
    }
  };

  return (
    <aside className="glass-panel" style={{
      position: 'absolute',
      top: 90,
      left: 16,
      bottom: 24,
      width: 340,
      zIndex: 15,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      gap: '14px',
      overflow: 'hidden',
    }}>
      {/* Sidebar Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.02em' }}>Spatial Intelligence</h2>
          <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            {pois.length} POIs
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Search landmarks & plan obstacle-aware routes
        </p>
      </div>

      {/* Critical System Architecture Notice */}
      <div style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(56, 189, 248, 0.05)',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        fontSize: '0.72rem',
        lineHeight: 1.4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#38bdf8', marginBottom: 3 }}>
          <ShieldCheck size={14} />
          <span>Architectural Distinction</span>
        </div>
        <span style={{ color: 'var(--text-secondary)' }}>
          Photorealistic visual twin (Splats/Mesh) is decoupled from the geometrically validated 2D/3D navigation grid.
        </span>
      </div>

      {/* Search Input */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}>
        <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search rooms, desks, doors..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 32px',
            fontSize: '0.8rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {['all', 'room', 'door', 'desk', 'corridor', 'landmark'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '4px 8px',
              fontSize: '0.7rem',
              borderRadius: 'var(--radius-sm)',
              border: selectedCategory === cat ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
              background: selectedCategory === cat ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: selectedCategory === cat ? '#38bdf8' : 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* POI List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingRight: 4,
      }}>
        {filteredPois.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No points of interest match query.
          </div>
        ) : (
          filteredPois.map((poi) => {
            const isSelected = selectedPoi?.id === poi.id;
            return (
              <div
                key={poi.id}
                onClick={() => onSelectPoi(poi)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {categoryIcons[poi.category]}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? '#38bdf8' : 'var(--text-primary)' }}>
                      {poi.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {poi.description}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  [{poi.position[0]}, {poi.position[2]}]
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Route Planning Widget */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Route Planner</span>
          {hasActiveRoute && (
            <button
              onClick={onClearRoute}
              style={{
                fontSize: '0.7rem',
                color: '#f87171',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Clear Route
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <select
            value={routeStartId}
            onChange={(e) => setRouteStartId(e.target.value)}
            style={{
              padding: '6px',
              fontSize: '0.72rem',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
            }}
          >
            {pois.map((p) => (
              <option key={`start-${p.id}`} value={p.id}>From: {p.name}</option>
            ))}
          </select>

          <select
            value={routeEndId}
            onChange={(e) => setRouteEndId(e.target.value)}
            style={{
              padding: '6px',
              fontSize: '0.72rem',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
            }}
          >
            {pois.map((p) => (
              <option key={`end-${p.id}`} value={p.id}>To: {p.name}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handlePlanRoute}
          style={{ width: '100%', padding: '7px' }}
        >
          <Navigation size={14} />
          <span>Compute Walkable Route</span>
        </button>
      </div>
    </aside>
  );
};
