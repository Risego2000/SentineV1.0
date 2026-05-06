import { getServerPortFromElectron, isElectron } from '../src/utils/electronDetect';

/**
 * API Configuration
 * Centralizes API endpoint URLs and base paths
 */

// Detect API base URL based on environment
export const getApiBaseUrl = (): string => {
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
    if (detectedPort && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return `${protocol}//${hostname}:${detectedPort}`;
    }
  }

  // In browser dev mode, let Vite proxy /api requests to the backend.
  // Electron sets sentinel_api_port before the app mounts, so this branch is
  // only for plain browser tabs such as http://127.0.0.1:3001.
  if (
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    currentPort &&
    currentPort !== '3002'
  ) {
    return '';
  }

  // In development, if running on any port except 3002,
  // assume backend is on 3002 (standard Sentinel port configuration)
  // This handles all dev server ports: 3001, 3003, 3004, etc.
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && currentPort !== '3002') {
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
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl) {
    return `${apiBaseUrl}${endpoint}`;
  }
  return endpoint;
};

/**
 * Fetch wrapper that automatically handles API base URL
 */
export const apiFetch = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const url = getApiUrl(endpoint);
  const doFetch = (target: string) =>
    fetch(target, {
      ...options,
      headers: {
        ...options?.headers,
      },
    });

  try {
    const response = await doFetch(url);
    if (response.ok || !isElectron() || !endpoint.startsWith('/api/')) {
      return response;
    }

    // In Electron dev, first render can race before port discovery and hit Vite proxy.
    // If that fails server-side, force direct backend URL using IPC-discovered port.
    if (response.status >= 500) {
      const port = await getServerPortFromElectron();
      sessionStorage.setItem('sentinel_api_port', String(port));
      return doFetch(`${window.location.protocol}//127.0.0.1:${port}${endpoint}`);
    }

    return response;
  } catch (error) {
    if (!isElectron() || !endpoint.startsWith('/api/')) {
      throw error;
    }
    const port = await getServerPortFromElectron();
    sessionStorage.setItem('sentinel_api_port', String(port));
    return doFetch(`${window.location.protocol}//127.0.0.1:${port}${endpoint}`);
  }
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
