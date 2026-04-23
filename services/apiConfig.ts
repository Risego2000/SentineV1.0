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
  const currentPort = window.location.port;

  // In production (localhost:3002 or no port), use same origin
  if (!currentPort || currentPort === '3002') {
    return '';
  }

  // In development, detect backend port from sessionStorage (set by port auto-discovery)
  // This is populated by the port discovery mechanism
  if (typeof window !== 'undefined') {
    const detectedPort = sessionStorage.getItem('sentinel_api_port');
    if (detectedPort && hostname === 'localhost') {
      return `${protocol}//${hostname}:${detectedPort}`;
    }
  }

  // In development, if running on any port except 3002,
  // assume backend is on 3002 (standard Sentinel port configuration)
  // This handles all dev server ports: 3001, 3003, 3004, etc.
  if (hostname === 'localhost' && currentPort !== '3002') {
    return `${protocol}//${hostname}:3002`;
  }

  // Fallback: use relative URLs
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
