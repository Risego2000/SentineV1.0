/**
 * VideoSourceDomain - Manages video input sources
 * Separated from UI and forensics logic.
 */

import { create } from 'zustand';
import { VideoSource } from '../../stores/videoSourceStore';
import { logger } from '../../services/logger';

export interface VideoSourceConfig {
  type: VideoSource;
  url?: string;
  username?: string;
  password?: string;
}

interface VideoSourceState {
  source: VideoSource;
  isPlaying: boolean;
  isBatchMode: boolean;
  videoQueue: File[];
  currentQueueIndex: number;
  ipCameraConfig: {
    url: string | null;
    username: string | null;
    password: string | null;
  };
  statusMsg: string | null;
  onStatusChange?: (msg: string | null) => void;
  onSourceChange?: (source: VideoSource) => void;
  onPlayStateChange?: (playing: boolean) => void;
}

interface VideoSourceActions {
  setSource: (source: VideoSource) => void;
  setPlaying: (playing: boolean) => void;
  setQueue: (files: File[]) => void;
  advanceQueue: () => boolean;
  setIpCamera: (url: string, username?: string, password?: string) => void;
  clearIpCamera: () => void;
  setStatus: (msg: string | null) => void;
  setCallbacks: (callbacks: {
    onStatusChange?: (msg: string | null) => void;
    onSourceChange?: (source: VideoSource) => void;
    onPlayStateChange?: (playing: boolean) => void;
  }) => void;
  reset: () => void;
}

type VideoSourceStore = VideoSourceState & VideoSourceActions;

const initialState: VideoSourceState = {
  source: 'none',
  isPlaying: false,
  isBatchMode: false,
  videoQueue: [],
  currentQueueIndex: 0,
  ipCameraConfig: {
    url: null,
    username: null,
    password: null,
  },
  statusMsg: null,
};

export const createVideoSourceDomain = () => {
  return create<VideoSourceStore>((set, get) => ({
    ...initialState,

    setSource: (source) => {
      logger.info('VIDEO_SOURCE', `Source changed to: ${source}`);
      set({ source });
      get().onSourceChange?.(source);
    },

    setPlaying: (playing) => {
      logger.info('VIDEO_SOURCE', `Playback: ${playing ? 'PLAYING' : 'PAUSED'}`);
      set({ isPlaying: playing });
      get().onPlayStateChange?.(playing);
    },

    setQueue: (files) => {
      set({
        videoQueue: files,
        currentQueueIndex: 0,
        isBatchMode: files.length > 1,
      });
    },

    advanceQueue: () => {
      const { videoQueue, currentQueueIndex } = get();
      if (currentQueueIndex < videoQueue.length - 1) {
        set({ currentQueueIndex: currentQueueIndex + 1 });
        return true;
      }
      set({ isBatchMode: false });
      return false;
    },

    setIpCamera: (url, username, password) => {
      set({
        ipCameraConfig: { url, username: username || null, password: password || null },
        source: 'ip',
      });
    },

    clearIpCamera: () => {
      set({
        ipCameraConfig: { url: null, username: null, password: null },
      });
    },

    setStatus: (msg) => {
      set({ statusMsg: msg });
      get().onStatusChange?.(msg);
    },

    setCallbacks: (callbacks) => {
      set(callbacks as Partial<VideoSourceState>);
    },

    reset: () => {
      set({
        ...initialState,
        ipCameraConfig: { url: null, username: null, password: null },
      });
    },
  }));
};

export const videoSourceDomain = createVideoSourceDomain();
