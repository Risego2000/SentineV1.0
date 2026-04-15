/**
 * Tracking Store - High-frequency state for object tracking
 * Separated from UI state to avoid re-renders on every frame.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Track } from '../types';

interface TrackingState {
  // Track collection - updated every frame
  tracks: Track[];

  // Processed track IDs (for stats)
  seenTrackIds: Set<number>;

  // Currently suspected track (evidence capture in progress)
  suspectTrackId: number | null;

  // Frame counter
  frameCount: number;

  // Performance metrics
  fps: number;
  latency: number;

  // Actions
  setTracks: (tracks: Track[]) => void;
  addSeenTrack: (id: number) => void;
  setSuspect: (id: number | null) => void;
  incrementFrame: () => void;
  setPerformanceMetrics: (fps: number, latency: number) => void;
  reset: () => void;
}

const initialState = {
  tracks: [],
  seenTrackIds: new Set<number>(),
  suspectTrackId: null,
  frameCount: 0,
  fps: 0,
  latency: 0,
};

export const useTrackingStore = create<TrackingState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setTracks: (tracks) => set({ tracks }),

    addSeenTrack: (id) => {
      const seen = new Set(get().seenTrackIds);
      seen.add(id);
      set({ seenTrackIds: seen });
    },

    setSuspect: (id) => set({ suspectTrackId: id }),

    incrementFrame: () => set((s) => ({ frameCount: s.frameCount + 1 })),

    setPerformanceMetrics: (fps, latency) => set({ fps, latency }),

    reset: () => set(initialState),
  }))
);

// Selectors for optimized subscriptions
export const selectTracks = (s: TrackingState) => s.tracks;
export const selectTrackCount = (s: TrackingState) => s.tracks.length;
export const selectSuspect = (s: TrackingState) => s.suspectTrackId;
export const selectFPS = (s: TrackingState) => s.fps;
export const selectFrameCount = (s: TrackingState) => s.frameCount;
