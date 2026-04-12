/**
 * Supported entity types for geometric zones.
 */
export type EntityType =
  | 'forbidden'
  | 'lane_divider'
  | 'stop_line'
  | 'box_junction'
  | 'pedestrian'
  | 'bus_lane'
  | 'roi_general'
  | 'roi_turn';

/**
 * System log categories.
 */
export type LogType = 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE' | 'SUCCESS' | 'DEBUG';

/**
 * Infraction severity levels.
 */
export type SeverityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Represents a geometric detection zone or line.
 */
export interface GeometryLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: { x: number; y: number }[]; // For polygons/complex areas
  label: string;
  type: EntityType;
}

/**
 * Global engine configuration for detection and tracking.
 */
export interface EngineConfig {
  confidenceThreshold: number;
  nmsThreshold: number;
  detectionSkip: number;
  persistence: number;
  predictionLookahead: number;
}

/**
 * Normalized bounding box for tracking.
 */
export interface TrackBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Physics engine interface for Kalman filters.
 */
export interface IKalman {
  x: number;
  y: number;
  vx: number;
  vy: number;
  update(mx: number, my: number, dt?: number): void;
  step(dt?: number): void;
  getVelocity(): number;
  getHeading(): number;
}

/**
 * Detailed track state for a single entity.
 */
export interface Track {
  id: number;
  bbox: TrackBBox;
  label: string;
  conf: number;
  hits: number;
  age: number;
  tail: { x: number; y: number }[];
  snapshots: string[];
  contextSnapshots?: string[];
  zoomSnapshots?: string[];
  audited: boolean;
  crossedLine?: boolean;
  isInfractor?: boolean;
  processedLines: string[];
  velocity: number;
  velocityHistory?: number[]; // Velocity telemetry for smoothing and analysis
  avgVelocity: number;
  acceleration: number;
  heading: number;
  headingChange?: number;
  isAnomalous?: boolean;
  anomalyLabel?: string;
  potentialCollision?: boolean;
  futurePos?: { x: number; y: number };
  collisionTargetId?: number;
  auditStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  auditTimestamp?: number;
  dwellTime: number; // Residence time in zone (ms)
  lastIntersection?: string;
  lastZoneId?: string;
  kf: IKalman; // Concrete physics engine instance
  missedFrames: number; // Counter for persistence
  isCoasting: boolean; // Prediction mode without visual confirmation
  labelHistory?: string[]; // Class smoothing history (majority vote)
  roiHistory: string[]; // Sequential ROI entries [ROI A, ROI B...]
  hasInitialFrame?: boolean;
  hasMidFrame?: boolean;
  firstHitFrame?: number; // Frame count when ROI A was first hit
  roiAId?: string; // ID of the first ROI (ROI A)
  color?: string; // Assigned color for visualization
  videoClip?: string; // Infraction clip (Base64)
}

/**
 * Standard output from a detection model.
 */
export interface StandardDetection {
  label: string;
  score: number;
  box: TrackBBox;
}

/**
 * Pose estimation result from MediaPipe.
 */
export interface PoseResult {
  landmarks: { x: number; y: number; z: number }[];
  worldLandmarks: { x: number; y: number; z: number }[];
}

/**
 * Response from AI Auditor (Gemini).
 */
export interface AuditResponse {
  infraction: boolean;
  plate: string;
  makeModel: string;
  color: string;
  description: string;
  severity: SeverityType;
  ruleCategory: string;
  legalBase: string;
  reasoning: string[];
  visualTimestamp: string;
  videoTimeCode: string; // The time printed on the video (e.g., "12:02:48")
  localTime: string; // The local wall-clock time (e.g., "2026-03-08 05:32:00")
  telemetry: {
    speedEstimated: string;
    behaviorAnomalies?: string;
  };
}

/**
 * Record of a confirmed infraction.
 */
export interface InfractionLog extends AuditResponse {
  id: number;
  image: string;
  extraSnapshots?: string[]; // [Initial, Mid, Final] context frames
  zoomSnapshots?: string[]; // [Initial, Mid, Final] zoomed vehicle evidence
  ocrResults?: string[]; // OCR text for [Initial, Mid, Final] frames
  plateOcr?: string;
  plateOcrCandidates?: string[];
  videoClip?: string; // Base64 or Blob URL of the 8s clip
  time: string;
  playbackTime?: number; // Time in seconds from the start of the video
  reportPath?: string;
}

/**
 * System event log entry.
 */
export interface SystemLog {
  id: string;
  timestamp: string;
  type: LogType;
  content: string;
}

/**
 * Real-time health status of system modules.
 */
export interface SystemStatus {
  neural: 'loading' | 'ready' | 'error';
  forensic: 'ready' | 'error' | 'pending';
  bionics: 'ready' | 'pending';
  vector: 'ready' | 'pending';
  mediapipeReady: boolean;
}

/**
 * Application performance and detection metrics.
 */
export interface AppStats {
  det: number;
  inf: number;
}

/**
 * Data structure for Object Detection presets.
 */
export interface DetectionPresetData {
  label: string;
  description: string;
  config: EngineConfig;
}

/**
 * Data structure for Forensic Audit presets.
 */
export interface AuditPresetData {
  label: string;
  description: string;
  instructions: string;
}

/**
 * Data structure for Kinematic Analysis presets.
 */
export interface KinematicPresetData {
  label: string;
  description: string;
  model: string;
  pose: boolean;
}

export type PresetType = 'scout' | 'sentinel' | 'warden' | 'shadow';
export type AuditPresetType = 'flash' | 'tactical' | 'full' | 'standard' | 'neural' | 'senior';
export type KinematicPresetType = 'lite' | 'full' | 'heavy';

/**
 * Generic point in 2D space.
 */
export interface IpCameraConfig {
  url: string;
  username?: string;
  password?: string;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Report summary for a batch of videos.
 */
export interface BatchReport {
  startTime: string;
  endTime: string;
  totalVideos: number;
  totalInfractions: number;
  infractions: InfractionLog[];
  filename: string;
}
