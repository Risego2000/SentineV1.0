import { getApiBaseUrl } from './apiConfig';

export interface RealtimeEnvelope {
  type: string;
  payload?: any;
  ts?: number;
  viewerId?: string | null;
  siteId?: string | null;
}

const getRealtimeWsUrl = (viewerId?: string, siteId?: string): string => {
  const apiBase = getApiBaseUrl();
  const origin = apiBase || window.location.origin;
  const wsOrigin = origin.startsWith('https://')
    ? origin.replace('https://', 'wss://')
    : origin.replace('http://', 'ws://');
  const params = new URLSearchParams();
  if (viewerId) params.set('viewerId', viewerId);
  if (siteId) params.set('siteId', siteId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `${wsOrigin}/ws/realtime${suffix}`;
};

export const connectRealtime = (opts: {
  viewerId?: string;
  siteId?: string;
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (event: RealtimeEnvelope) => void;
}): (() => void) => {
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;
  let closed = false;

  const open = () => {
    try {
      socket = new WebSocket(getRealtimeWsUrl(opts.viewerId, opts.siteId));
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      opts.onOpen?.();
      socket?.send(
        JSON.stringify({
          type: 'subscribe',
          viewerId: opts.viewerId || null,
          siteId: opts.siteId || null,
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RealtimeEnvelope;
        opts.onMessage?.(parsed);
      } catch (error) {
        console.debug('[RealtimeSync] Ignored malformed WS message:', error);
      }
    };

    socket.onclose = () => {
      opts.onClose?.();
      if (!closed) scheduleReconnect();
    };

    socket.onerror = () => {
      try {
        socket?.close();
      } catch (error) {
        console.debug('[RealtimeSync] Socket close failed:', error);
      }
    };
  };

  const scheduleReconnect = () => {
    if (retryTimer !== null || closed) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      open();
    }, 2000);
  };

  open();

  return () => {
    closed = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    try {
      socket?.close();
    } catch (error) {
      console.debug('[RealtimeSync] Socket cleanup failed:', error);
    }
  };
};
