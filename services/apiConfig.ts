/**
 * API Configuration
 * Centralizes API endpoint URLs and base paths
 */

// Detect API base URL based on environment
const getApiBaseUrl = (): string => {
  // In development with Vite proxy, relative URLs work fine
  // In production or when proxy isn't available, use absolute URL

  // Check if we have an API_URL environment variable
  if (typeof window !== 'undefined' && (window as any).API_BASE_URL) {
    return (window as any).API_BASE_URL;
  }

  // Try to detect from current location
  const protocol = window.location.protocol; // 'http:' or 'https:'
  const hostname = window.location.hostname; // 'localhost'

  // If running on port 3001 (frontend), redirect API calls to port 3002 (backend)
  if (window.location.port === '3001') {
    return `${protocol}//${hostname}:3002`;
  }

  // If on same port, use relative URLs (will use Vite proxy or same origin)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Construct full API endpoint URL
 * @param endpoint - Relative endpoint path (e.g., '/api/transcode')
 * @returns Full URL or relative path
 */
export const getApiUrl = (endpoint: string): string => {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${endpoint}`;
  }
  return endpoint;
};

/**
 * Fetch wrapper that automatically handles API base URL
 */
export const apiFetch = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const url = getApiUrl(endpoint);
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });
};

// Export common endpoints
export const API_ENDPOINTS = {
  TRANSCODE: '/api/transcode',
  TRANSCODE_PROGRESS: '/api/transcode/progress',
  AI_GEOMETRY: '/api/ai/geometry',
  AI_AUDIT: '/api/ai/audit',
  HEALTH: '/api/health',
  SAVE_CONFIG: '/api/save-config',
  PRESETS: '/api/presets',
} as const;
