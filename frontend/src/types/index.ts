export type POICategory = 'room' | 'door' | 'desk' | 'corridor' | 'landmark';

export interface PointOfInterest {
  id: string;
  name: string;
  category: POICategory;
  position: [number, number, number];
  description: string;
  walkable: boolean;
}

export interface BackendHealth {
  status: string;
  version: string;
  environment: string;
  tools: {
    ffmpeg: boolean;
    colmap: boolean;
    opencv: boolean;
  };
  system?: {
    platform?: string;
    machine?: string;
    python_version?: string;
  };
  message?: string;
}

export interface PipelineStatus {
  raw_videos_count: number;
  extracted_sessions: string[];
  reconstruction_available: boolean;
  ffmpeg_available: boolean;
  colmap_available: boolean;
}

export interface NavigationRoute {
  id: string;
  fromPoiId: string;
  toPoiId: string;
  waypoints: [number, number, number][];
  totalDistanceMeters: number;
  isObstacleClear: boolean;
}
