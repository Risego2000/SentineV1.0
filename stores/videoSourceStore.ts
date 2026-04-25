/**
 * Video Source Store - Video input management
 * Separates video source state from UI and forensics logic.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type VideoSource = 'none' | 'upload' | 'live' | 'ip';

interface VideoSourceStateBase {
  // Current source type
  source: VideoSource;

  // Playback state
  isPlaying: boolean;

  // Batch processing
  isBatchMode: boolean;
  videoQueue: File[];
  currentQueueIndex: number;

  // IP Camera config
  ipCameraUrl: string | null;
  ipCameraUsername: string | null;
  ipCameraPassword: string | null;

  // Status
  statusMsg: string | null;
}

interface VideoSourceActions {
  setSource: (source: VideoSource) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setQueue: (files: File[], batchMode?: boolean) => void;
  addToQueue: (files: File[]) => void;
  advanceQueue: () => boolean;
  resetQueue: () => void;
  setIpCamera: (url: string, username?: string, password?: string) => void;
  clearIpCamera: () => void;
  setStatus: (msg: string | null) => void;
  reset: () => void;
}

type VideoSourceState = VideoSourceStateBase & VideoSourceActions;

const initialState: VideoSourceStateBase = {
  source: 'none',
  isPlaying: false,
  isBatchMode: false,
  videoQueue: [],
  currentQueueIndex: 0,
  ipCameraUrl: null,
  ipCameraUsername: null,
  ipCameraPassword: null,
  statusMsg: null,
};

export const useVideoSourceStore = create<VideoSourceState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setSource: (source) => set({ source }),

    setPlaying: (playing) => set({ isPlaying: playing }),

    togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),

    setQueue: (files, batchMode = false) =>
      set({
        videoQueue: files,
        currentQueueIndex: 0,
        isBatchMode: files.length > 1 ? batchMode : false,
      }),

    addToQueue: (files) =>
      set((s) => ({
        videoQueue: [...s.videoQueue, ...files],
        isBatchMode: s.videoQueue.length + files.length > 1,
      })),

    advanceQueue: () => {
      const { videoQueue, currentQueueIndex } = get();
      if (currentQueueIndex < videoQueue.length - 1) {
        set({ currentQueueIndex: currentQueueIndex + 1 });
        return true;
      }
      return false;
    },

    resetQueue: () =>
      set({
        videoQueue: [],
        currentQueueIndex: 0,
        isBatchMode: false,
      }),

    setIpCamera: (url, username, password) =>
      set({
        ipCameraUrl: url,
        ipCameraUsername: username || null,
        ipCameraPassword: password || null,
      }),

    clearIpCamera: () =>
      set({
        ipCameraUrl: null,
        ipCameraUsername: null,
        ipCameraPassword: null,
      }),

    setStatus: (msg) => set({ statusMsg: msg }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const selectSource = (s: VideoSourceState) => s.source;
export const selectIsPlaying = (s: VideoSourceState) => s.isPlaying;
export const selectCurrentVideo = (s: VideoSourceState) =>
  s.videoQueue[s.currentQueueIndex] || null;
export const selectQueueProgress = (s: VideoSourceState) => ({
  current: s.currentQueueIndex + 1,
  total: s.videoQueue.length,
});
export const selectIsIpCamera = (s: VideoSourceState) => s.source === 'ip';
