import React, { createContext } from 'react';
import {
  GeometryLine,
  InfractionLog,
  SystemLog,
  SystemStatus,
  AppStats,
  EngineConfig,
  Track,
  StandardDetection,
  PoseResult,
  LogType,
  IpCameraConfig,
  PresetType,
  AuditPresetType,
  KinematicPresetType,
} from '../types';

/**
 * Sentinel AI Global State Interface.
 */
export interface SentinelContextType {
  // State
  source: 'none' | 'live' | 'upload' | 'ip';
  isPlaying: boolean;
  isMeshRenderEnabled: boolean;
  directives: string;
  geometry: GeometryLine[];
  selectedLog: InfractionLog | null;
  isListening: boolean;
  isPoseEnabled: boolean;
  currentPreset: PresetType;
  engineConfig: EngineConfig;
  stats: AppStats;
  logs: InfractionLog[];
  systemLogs: SystemLog[];
  statusMsg: string | null;
  isAnalyzing: boolean;
  systemStatus: SystemStatus;
  statusLabel: string;
  hasApiKey: boolean;
  fps: number;
  latency: number;
  bufferStatus: {
    state: 'idle' | 'recording' | 'capturing' | 'saving';
    /** Two-phase forbidden-turn flow: roi_a = waiting for ROI B, confirmed = both crossed */
    phase: 'standby' | 'roi_a' | 'confirmed' | 'discarded' | 'saving';
    seconds: number;
    activeTracks: number;
    roiALabel?: string;
    roiBLabel?: string;
    capturedPhotos: number;
    plateCandidate?: string;
  };
  tracks: Track[];
  setTracks: (t: Track[]) => void;
  calibration: number;
  setCalibration: (c: number) => void;
  analysisGridSize: 1 | 2 | 3;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  viewerId?: string;
  helpMsg: string | null;
  selectedProtocolIds: string[];
  setSelectedProtocolIds: (ids: string[]) => void;

  // Actions
  setSource: (s: 'none' | 'live' | 'upload' | 'ip') => void;
  setIsPlaying: (p: boolean) => void;
  setIsMeshRenderEnabled: (e: boolean) => void;
  parseMeshDirectives: () => void;
  setDirectives: (d: string) => void;
  setGeometry: (g: GeometryLine[]) => void;
  setSelectedLog: (l: InfractionLog | null) => void;
  setIsListening: (l: boolean) => void;
  setIsPoseEnabled: (p: boolean) => void;
  setPreset: (p: PresetType) => void;
  setStats: React.Dispatch<React.SetStateAction<AppStats>>;
  addLog: (type: LogType, content: string) => void;
  generateGeometry: (instruction?: string, videoElement?: HTMLVideoElement | null) => Promise<void>;
  runAudit: (track: Track, line: GeometryLine) => Promise<void>;
  setStatusMsg: (msg: string | null) => void;
  setHelpMsg: (msg: string | null) => void;
  setPerformanceMetrics: (fps: number, latency: number) => void;
  setAnalysisGridSize: (size: 1 | 2 | 3) => void;
  isAuditEnabled: boolean;
  setIsAuditEnabled: (e: boolean) => void;
  currentAuditPreset: AuditPresetType;
  setAuditPreset: (p: AuditPresetType) => void;
  currentKinematicPreset: KinematicPresetType;
  setKinematicPreset: (p: KinematicPresetType) => void;
  startLiveFeed: (
    videoRef: React.RefObject<HTMLVideoElement | null>
  ) => Promise<MediaStream | undefined>;
  startScreenShare: (
    videoRef: React.RefObject<HTMLVideoElement | null>
  ) => Promise<MediaStream | undefined>;
  stopScreenShare: () => void;
  onFileChange: (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
  onFilesChange: (files: FileList, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
  loadNextInQueue: () => Promise<void>;
  videoQueue: File[];
  currentQueueIndex: number;
  isBatchMode: boolean;
  addInfraction: (log: InfractionLog) => void;
  exportBatchReport: () => void;
  finalizeVideoReport: () => Promise<void>;
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<StandardDetection[] | null>;
  detectPose: (source: HTMLVideoElement) => Promise<PoseResult[] | null>;
  startIpFeed: (
    config: IpCameraConfig,
    videoRef: React.RefObject<HTMLVideoElement | null>
  ) => Promise<void>;
  updateBufferStatus: (status: Partial<SentinelContextType['bufferStatus']>) => void;
  clearLogs: () => void;
  validateInfraction: (id: number, status: 'validated' | 'rejected') => void;
}

export const SentinelContext = createContext<SentinelContextType | undefined>(undefined);
