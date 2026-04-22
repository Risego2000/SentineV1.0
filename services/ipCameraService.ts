import { IpCameraConfig } from '../types';
import { getApiUrl } from './apiConfig';

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

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
  const sessionUrl = getApiUrl('/api/ip-camera/session');
  const response = await fetch(sessionUrl, {
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
