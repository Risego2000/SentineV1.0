import { getApiUrl } from './apiConfig';

export const publishRealtimeEvent = async (
  type: string,
  payload: Record<string, unknown> = {},
  channels: { viewerId?: string; siteId?: string } = {}
): Promise<void> => {
  try {
    if (
      typeof window !== 'undefined' &&
      window.location.port === '3001' &&
      !sessionStorage.getItem('sentinel_api_port')
    ) {
      return;
    }
    const siteId = channels.siteId || localStorage.getItem('sentinel_site_id') || 'default-site';
    await fetch(getApiUrl('/api/realtime/publish'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        payload,
        viewerId: channels.viewerId || null,
        siteId,
      }),
    });
  } catch {
    // Best-effort telemetry channel: ignore network errors.
  }
};
