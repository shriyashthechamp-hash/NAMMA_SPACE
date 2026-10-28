import { BackendHealth, PipelineStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function fetchHealth(): Promise<BackendHealth> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Health check returned status ${response.status}`);
  }
  return response.json();
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const response = await fetch(`${API_BASE_URL}/api/v1/pipeline/status`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Pipeline status request failed with status ${response.status}`);
  }
  return response.json();
}
