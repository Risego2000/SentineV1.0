import { GeometryLine, Track, AuditResponse, AuditPresetType } from '../types';
import { getApiUrl } from './apiConfig';
import { isElectron, getElectronAPI } from '../utils/electronDetect';

/**
 * Sanitizes text to prevent basic XSS and injection.
 */
export const sanitizeText = (text: string): string => {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export interface GeometryResponse {
  lines: GeometryLine[];
  suggestedDirectives: string;
}

const normalizeBackendAuditPreset = (
  preset: AuditPresetType
): 'standard' | 'strict' | 'permissive' => {
  switch (preset) {
    case 'flash':
      return 'permissive';
    case 'tactical':
    case 'full':
    case 'neural':
    case 'senior':
      return 'strict';
    default:
      return 'standard';
  }
};

const postJson = async <T>(endpoint: string, payload: unknown): Promise<T> => {
  // Use IPC if running in Electron
  if (isElectron()) {
    const api = getElectronAPI();
    const channelName = endpoint.replace(/\//g, ':').substring(1); // /api/ai/geometry -> api:ai:geometry
    try {
      const result = await api.ipc.invoke(channelName, payload);
      return result as T;
    } catch (error) {
      throw new Error(`IPC error on ${channelName}: ${error}`);
    }
  }

  // Use HTTP for web mode
  const fullUrl = getApiUrl(endpoint);
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Fallo en ${fullUrl}`);
  }

  return (await response.json()) as T;
};

const isRetryableAiError = (error: unknown): boolean => {
  const msg = String(error || '').toLowerCase();
  return (
    msg.includes('aborterror') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('econnreset')
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const postJsonWithRetry = async <T>(
  endpoint: string,
  payload: unknown,
  retries = 1
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await postJson<T>(endpoint, payload);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableAiError(error)) {
        break;
      }
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastError;
};

export const AIService = {
  /**
   * Sentinel AI Geometric Engine.
   * Analyzes road layout and generates detection geometries.
   */
  async generateGeometry(
    directives: string,
    instruction?: string,
    image?: string
  ): Promise<GeometryResponse> {
    return postJson<GeometryResponse>('/api/ai/geometry', {
      directives,
      instruction,
      image,
    });
  },

  /**
   * SUPREME FORENSIC AUDITOR of SENTINEL.AI v.1.0
   * Judicial Expert Unit - Daganzo de Arriba (Madrid).
   */
  /**
   * TRAJECTORY ANALYSIS ENGINE (New Forensic System)
   * Analyzes vehicle path vectors against road geometry to determine infractions.
   */
  async analyzeTrajectory(
    track: Track,
    line: GeometryLine,
    directives: string,
    auditPreset: AuditPresetType = 'standard'
  ): Promise<AuditResponse> {
    return postJsonWithRetry<AuditResponse>(
      '/api/ai/audit',
      {
        track,
        line,
        directives,
        auditPreset: normalizeBackendAuditPreset(auditPreset),
      },
      1
    );
  },
};
