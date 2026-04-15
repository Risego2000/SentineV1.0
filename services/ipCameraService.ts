import { IpCameraConfig, GeometryLine } from '../types';
import { supabase, SUPABASE_TABLES, isSupabaseConfigured } from './supabase';

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export const syncGeometryToSupabase = async (geometry: GeometryLine) => {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from(SUPABASE_TABLES.GEOMETRY_LINES).upsert(
      {
        id: geometry.id,
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
        points: geometry.points,
        label: geometry.label,
        type: geometry.type,
        violation_kind: geometry.violationKind,
        roi_sequence_ids: geometry.roiSequenceIds,
        roi_sequence_labels: geometry.roiSequenceLabels,
        analysis_context: geometry.analysisContext,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) console.error('[Supabase] Geometry sync failed:', error);
  } catch (err) {
    console.error('[Supabase] Geometry sync error:', err);
  }
};

export const sanitizeCameraUrlForLogs = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return rawUrl.replace(/\/\/.*@/, '//');
  }
};

export const getIpCameraProtocol = (rawUrl: string): string | null => {
  try {
    return new URL(rawUrl).protocol;
  } catch {
    return null;
  }
};

export const isSupportedIpCameraUrl = (rawUrl: string): boolean => {
  const protocol = getIpCameraProtocol(rawUrl);
  return protocol ? SUPPORTED_PROTOCOLS.has(protocol) : false;
};

export const createIpCameraSession = async (
  config: IpCameraConfig
): Promise<{ sessionId: string; streamUrl: string }> => {
  const response = await fetch('/api/ip-camera/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'No se pudo crear la sesión de cámara IP');
  }

  const payload = (await response.json()) as { sessionId: string; streamUrl: string };
  return payload;
};
