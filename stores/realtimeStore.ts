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
  setConnected: (connected) => set({ connected }),
  setStats: (patch) => set((state) => ({ stats: { ...state.stats, ...patch } })),
  setLastEventType: (type) => set({ lastEventType: type }),
  setHistory: (rows) => set({ history: rows }),
}));
