import { useEffect } from 'react';
import { connectRealtime } from '../services/realtimeSync';
import { getApiUrl } from '../services/apiConfig';
import { useLayoutStore } from '../stores/layoutStore';
import { useRealtimeStore } from '../stores/realtimeStore';

export const useRealtimeSync = (enabled = true) => {
  const viewerId = useLayoutStore((s) => s.focusedViewerId);
  const setConnected = useRealtimeStore((s) => s.setConnected);
  const setStats = useRealtimeStore((s) => s.setStats);
  const setLastEventType = useRealtimeStore((s) => s.setLastEventType);
  const setHistory = useRealtimeStore((s) => s.setHistory);

  useEffect(() => {
    if (!enabled) return;

    const siteId = localStorage.getItem('sentinel_site_id') || 'default-site';
    const disconnect = connectRealtime({
      viewerId,
      siteId,
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (event) => {
        setLastEventType(event.type);
        if (event.type === 'stats' && event.payload && typeof event.payload === 'object') {
          setStats(event.payload);
        }
      },
    });

    const canFetchHistory =
      !(typeof window !== 'undefined' && window.location.port === '3001') ||
      !!sessionStorage.getItem('sentinel_api_port');
    if (canFetchHistory) {
      void fetch(getApiUrl('/api/realtime/history?points=240'))
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => {
          if (Array.isArray(rows)) setHistory(rows);
        })
        .catch(() => {});
    }

    return disconnect;
  }, [enabled, viewerId, setConnected, setHistory, setLastEventType, setStats]);
};
