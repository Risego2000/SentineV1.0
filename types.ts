export interface GeometryLine {
    id: string;
    x1: number; y1: number; x2: number; y2: number;
    label: string;
    type: 'forbidden' | 'lane_divider' | 'stop_line';
}

export interface EngineConfig {
    confidenceThreshold: number;
    nmsThreshold: number;
    detectionSkip: number;
    persistence: number;
    predictionLookahead: number;
}

export interface TrackBBox { x: number; y: number; w: number; h: number; }

export interface Track {
    id: number;
    label: string;
    points: { x: number; y: number; time: number }[];
    lastSeen: number;
    color: string;
    snapshots: string[];
    velocity: { x: number; y: number; w: number; h: number };
    predictedTrajectory: { x: number; y: number }[];
    crossedLine: boolean;
    currentBBox: TrackBBox;
    lastDetection?: TrackBBox;
    framesSinceSeen: number;
    isInfractor?: boolean;
    isPotentialInfractor?: boolean;
}

export interface InfractionLog {
    id: number;
    plate: string;
    description: string;
    severity: string;
    image: string;
    time: string;
    date: string;
    reasoning?: string[];
    legalArticle?: string;
    ruleCategory?: string;
    telemetry: { speedEstimated: string };
}

export interface SystemLog {
    id: string;
    timestamp: string;
    type: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE';
    content: string;
}

export interface SystemStatus {
    neural: string;
    forensic: string;
    bionics: string;
    vector?: string;
    mediapipeReady?: boolean;
}
