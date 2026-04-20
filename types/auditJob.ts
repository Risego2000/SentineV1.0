/**
 * Immutable Audit Job - Frozen snapshot of all context needed for forensic analysis.
 * Once created, this object NEVER mutates. All evidence is captured at creation time.
 */

import { GeometryLine, AuditPresetType, SeverityType } from '../types';

export interface AuditJobSnapshot {
  /** Immutable evidence at capture time */
  contextSnapshots: string[]; // [Initial, Mid, Final] full scene
  zoomSnapshots: string[]; // [Initial, Mid, Final] zoomed vehicle
  videoClip?: string; // 30s clip base64
  ocrResults: string[]; // OCR text for each zoom snapshot
  localTime: string; // Wall-clock when evidence was captured
  videoTimeCode: string; // OSD timestamp from video
  playbackTime: number; // Seconds from video start
}

export interface AuditJobTrackState {
  /** Frozen track ID */
  id: number;
  /** Primary vehicle type */
  label: string;
  /** Normalized bbox at capture moment */
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  /** Velocity telemetry snapshot */
  avgVelocity: number; // km/h
  velocityHistory?: readonly number[];
  /** Heading in radians */
  heading: number;
  /** Residence time in zone (ms) */
  dwellTime: number;
  /** Motion anomalies detected */
  isAnomalous: boolean;
  anomalyLabel?: string;
  /** All ROI entries up to capture (immutable history) */
  roiHistory: readonly string[];
  /** Tail trail positions (last 50) */
  tailPositions: readonly { x: number; y: number }[];
}

export interface AuditJobGeometryState {
  /** Frozen geometry line that triggered capture */
  lineId: string;
  lineLabel: string;
  lineType: string;
  /** Normalized coordinates */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: readonly { x: number; y: number }[];
  /** Violation kind (if applicable) */
  violationKind?: string;
  /** ROI sequence for forbidden turns */
  roiSequenceIds?: readonly string[];
  roiSequenceLabels?: readonly string[];
  /** Analysis context description */
  analysisContext?: string;
}

export type AuditJobStatus =
  | 'pending' // Created, waiting in queue
  | 'processing' // Currently being analyzed by AI
  | 'completed' // AI finished, infraction confirmed
  | 'cleared' // AI finished, no infraction
  | 'failed' // Processing error
  | 'aborted'; // Cancelled before processing

export interface AuditJob {
  /** Unique identifier - never reused */
  readonly id: string;
  /** Timestamp when job was created */
  readonly createdAt: number;
  /** Immutable snapshot of track state at capture time */
  readonly trackState: AuditJobTrackState;
  /** Immutable snapshot of geometry that triggered capture */
  readonly geometryState: AuditJobGeometryState;
  /** All evidence captured at creation time */
  readonly snapshot: AuditJobSnapshot;
  /** Audit configuration at creation time */
  readonly directives: string;
  readonly auditPreset: AuditPresetType;
  /** Audit rule that triggered this job */
  readonly ruleId?: string;
  /** Mutable status (tracks progress, not evidence) */
  status: AuditJobStatus;
  /** When status changed */
  statusChangedAt: number;
  /** AI audit result (filled after processing) */
  auditResult?: {
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
    videoTimeCode: string;
    localTime: string;
    telemetry: {
      speedEstimated: string;
      behaviorAnomalies?: string;
    };
  };
  /** Error message if failed */
  errorMessage?: string;
  /** Viewer instance that created this job */
  viewerId?: string;
}

/**
 * Factory to create AuditJob with frozen immutable parts.
 * Evidence and track/geometry state are frozen. Status fields remain mutable.
 */
export function createAuditJob(
  track: {
    id: number;
    label: string;
    bbox: { x: number; y: number; w: number; h: number };
    avgVelocity: number;
    velocityHistory?: number[] | readonly number[];
    heading: number;
    dwellTime: number;
    isAnomalous: boolean;
    anomalyLabel?: string;
    roiHistory: string[] | readonly string[];
    tail: { x: number; y: number }[] | readonly { x: number; y: number }[];
  },
  geometry: GeometryLine,
  snapshot: AuditJobSnapshot,
  directives: string,
  auditPreset: AuditPresetType,
  ruleId?: string,
  viewerId?: string
): AuditJob {
  // Create the base job object
  const job: AuditJob = {
    id: `audit_${track.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
    viewerId,
    // Freeze only the immutable evidence parts
    trackState: Object.freeze({
      id: track.id,
      label: track.label,
      bboxX: track.bbox.x,
      bboxY: track.bbox.y,
      bboxW: track.bbox.w,
      bboxH: track.bbox.h,
      avgVelocity: track.avgVelocity,
      velocityHistory: Object.freeze([...(track.velocityHistory || [])]),
      heading: track.heading,
      dwellTime: track.dwellTime,
      isAnomalous: track.isAnomalous,
      anomalyLabel: track.anomalyLabel,
      roiHistory: Object.freeze([...track.roiHistory]),
      tailPositions: Object.freeze([...track.tail]),
    }),
    geometryState: Object.freeze({
      lineId: geometry.id,
      lineLabel: geometry.label,
      lineType: geometry.type,
      x1: geometry.x1,
      y1: geometry.y1,
      x2: geometry.x2,
      y2: geometry.y2,
      points: geometry.points ? Object.freeze([...geometry.points]) : undefined,
      violationKind: geometry.violationKind,
      roiSequenceIds: geometry.roiSequenceIds
        ? Object.freeze([...geometry.roiSequenceIds])
        : undefined,
      roiSequenceLabels: geometry.roiSequenceLabels
        ? Object.freeze([...geometry.roiSequenceLabels])
        : undefined,
      analysisContext: geometry.analysisContext,
    }),
    snapshot: Object.freeze({ ...snapshot }),
    directives,
    auditPreset,
    ruleId,
    status: 'pending',
    statusChangedAt: Date.now(),
  };

  // Don't freeze the whole object - status needs to be mutable
  return job;
}

/**
 * Deep clone an AuditJob for storage/transmission (removes freeze).
 */
export function cloneAuditJob(job: AuditJob): AuditJob {
  return JSON.parse(JSON.stringify(job));
}
