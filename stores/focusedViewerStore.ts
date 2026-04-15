import { create } from 'zustand';
import React from 'react';
import { InfractionLog } from '../types';

export interface FocusedViewerBridge {
  viewerId: string;
  isPlaying: boolean;
  source: 'none' | 'live' | 'upload' | 'ip';
  videoRef: React.RefObject<HTMLVideoElement | null> | null;
  logs: InfractionLog[];

  // Proxied actions — set by whichever viewer is currently focused
  setIsPlayingFn: ((v: boolean) => void) | null;
  onScreenShareFn: (() => void) | null;
  onIpCameraFn: (() => void) | null;
  onUploadFn: (() => void) | null;

  update: (patch: Partial<Omit<FocusedViewerBridge, 'update'>>) => void;
}

export const useFocusedViewerStore = create<FocusedViewerBridge>((set) => ({
  viewerId: 'visor_0',
  isPlaying: false,
  source: 'none',
  videoRef: null,
  logs: [],
  setIsPlayingFn: null,
  onScreenShareFn: null,
  onIpCameraFn: null,
  onUploadFn: null,
  update: (patch) => set(patch),
}));
