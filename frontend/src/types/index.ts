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

export interface CameraPose {
  name: string;
  frame_number: number;
  timestamp_sec: number;
  registered: boolean;
  position: [number, number, number];
  raw_position: [number, number, number];
  forward: [number, number, number];
  up?: [number, number, number];
  right?: [number, number, number];
  image_url: string;
}

export interface UnregisteredFrame {
  name: string;
  frame_number: number;
  timestamp_sec: number;
  registered: false;
  image_url: string;
}

export interface FirstCamera {
  position: [number, number, number];
  forward: [number, number, number];
  up: [number, number, number];
}

export interface TrajectoryData {
  coordinate_system?: string;
  transform_applied?: string;
  first_camera?: FirstCamera;
  stats: {
    total_frames: number;
    registered_count: number;
    unregistered_count: number;
    points_count: number;
    pts_center: [number, number, number];
    pts_min: [number, number, number];
    pts_max: [number, number, number];
    fps: number;
  };
  trajectory: CameraPose[];
  unregistered: UnregisteredFrame[];
}


