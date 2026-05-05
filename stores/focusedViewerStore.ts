import { create } from 'zustand';
import React from 'react';
import { InfractionLog } from '../types';

export interface FocusedViewerBridge {
  viewerId: string;
  isPlaying: boolean;
  playbackRate: 1 | 2 | 4 | 8;
  source: 'none' | 'live' | 'upload' | 'ip';
  videoRef: React.RefObject<HTMLVideoElement | null> | null;
  logs: InfractionLog[];

  // Proxied actions — set by whichever viewer is currently focused
  setIsPlayingFn: ((v: boolean) => void) | null;
  setPlaybackRateFn: ((rate: 1 | 2 | 4 | 8) => void) | null;
  onScreenShareFn: (() => void) | null;
  onStopScreenShareFn: (() => void) | null;
  onIpCameraFn: (() => void) | null;
  onUploadFn: (() => void) | null;

  update: (patch: Partial<Omit<FocusedViewerBridge, 'update'>>) => void;
}

export const useFocusedViewerStore = create<FocusedViewerBridge>((set) => ({
  viewerId: 'visor_0',
  isPlaying: false,
  playbackRate: 1,
  source: 'none',
  videoRef: null,
  logs: [],
  setIsPlayingFn: null,
  setPlaybackRateFn: null,
  onScreenShareFn: null,
  onStopScreenShareFn: null,
  onIpCameraFn: null,
  onUploadFn: null,
  update: (patch) => set(patch),
}));
