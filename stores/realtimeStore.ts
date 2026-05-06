import { create } from 'zustand';

export interface RealtimeStats {
  detections: number;
  infractions: number;
  expedients: number;
  activeCameras: number;
  updatedAt: string;
}

interface RealtimeState {
  connected: boolean;
  lastEventType: string | null;
  stats: RealtimeStats;
  history: Array<{
    ts: number;
    detections: number;
    infractions: number;
    expedients: number;
    activeCameras: number;
  }>;
  setConnected: (connected: boolean) => void;
  setStats: (patch: Partial<RealtimeStats>) => void;
  setLastEventType: (type: string | null) => void;
  setHistory: (rows: RealtimeState['history']) => void;
}

const defaultStats: RealtimeStats = {
  detections: 0,
  infractions: 0,
  expedients: 0,
  activeCameras: 0,
  updatedAt: '',
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  lastEventType: null,
  stats: defaultStats,
  history: [],
  setConnected: (connected) =>
    set((state) => (state.connected === connected ? state : { connected })),
  setStats: (patch) =>
    set((state) => {
      const nextStats = { ...state.stats, ...patch };
      const same =
        state.stats.detections === nextStats.detections &&
        state.stats.infractions === nextStats.infractions &&
        state.stats.expedients === nextStats.expedients &&
        state.stats.activeCameras === nextStats.activeCameras &&
        state.stats.updatedAt === nextStats.updatedAt;
      return same ? state : { stats: nextStats };
    }),
  setLastEventType: (type) =>
    set((state) => (state.lastEventType === type ? state : { lastEventType: type })),
  setHistory: (rows) =>
    set((state) => {
      if (state.history.length === rows.length) {
        let equal = true;
        for (let i = 0; i < rows.length; i += 1) {
          const a = state.history[i];
          const b = rows[i];
          if (
            a.ts !== b.ts ||
            a.detections !== b.detections ||
            a.infractions !== b.infractions ||
            a.expedients !== b.expedients ||
            a.activeCameras !== b.activeCameras
          ) {
            equal = false;
            break;
          }
        }
        if (equal) return state;
      }
      return { history: rows };
    }),
}));
