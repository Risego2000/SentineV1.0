import { GeometryLine, Track, AuditResponse, AuditPresetType } from '../types';

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

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Fallo en ${url}`);
  }

  return (await response.json()) as T;
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
    return postJson<AuditResponse>('/api/ai/audit', {
      track,
      line,
      directives,
      auditPreset,
    });
  },
};
