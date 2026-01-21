export type EntityType = 'forbidden' | 'lane_divider' | 'stop_line';
export type LogType = 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE';
export type SeverityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface GeometryLine {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;
    type: EntityType;
}

export interface EngineConfig {
    confidenceThreshold: number;
    nmsThreshold: number;
    detectionSkip: number;
    persistence: number;
    predictionLookahead: number;
}

export interface TrackBBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Track {
    id: number;
    label: string;
    color: string;
    score: number;
    missedFrames: number;
    isCoasting: boolean;
    hits: number;
    tail: { x: number; y: number }[];
    bbox: TrackBBox;
    velocity: number;
    heading: number;
    processedLines: string[];
    snapshots: string[];
    isInfractor?: boolean;
    crossedLine?: boolean;
    kf: any; // AdvancedKalman instance
}

export interface InfractionLog {
    id: number;
    plate: string;
    description: string;
    severity: SeverityType;
    image: string;
    time: string;
    date: string;
    reasoning?: string[];
    legalArticle?: string;
    ruleCategory?: string;
    telemetry: {
        speedEstimated: string;
    };
    infraction: boolean;
}

export interface SystemLog {
    id: string;
    timestamp: string;
    type: LogType;
    content: string;
}

export interface SystemStatus {
    neural: 'loading' | 'ready' | 'error';
    forensic: 'ready' | 'error' | 'pending';
    bionics: 'ready' | 'pending';
    vector: 'ready' | 'pending';
    mediapipeReady: boolean;
}

export interface AppStats {
    det: number;
    inf: number;
}
