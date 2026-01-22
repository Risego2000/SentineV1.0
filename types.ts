export type EntityType = 'forbidden' | 'lane_divider' | 'stop_line' | 'box_junction';
export type LogType = 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE';
export type SeverityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface GeometryLine {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    points?: { x: number, y: number }[]; // Para polígonos/áreas complejas
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
    bbox: { x: number, y: number, w: number, h: number };
    label: string;
    conf: number;
    hits: number;
    age: number;
    tail: { x: number, y: number }[];
    snapshots: string[];
    audited: boolean;
    crossedLine?: boolean;
    isInfractor?: boolean;
    processedLines: string[];
    velocity: number;
    velocityHistory?: number[];
    avgVelocity: number;
    acceleration: number;
    heading: number;
    headingChange?: number;
    isAnomalous?: boolean;
    anomalyLabel?: string;
    potentialCollision?: boolean;
    futurePos?: { x: number, y: number };
    collisionTargetId?: number;
    auditStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    auditTimestamp?: number;
    dwellTime: number; // Tiempo de permanencia en zona (ms)
    lastIntersection?: string; // ID de la última línea/zona cruzada
    lastZoneId?: string; // ID de la zona en la que se encuentra actualmente
    kf: any; // AdvancedKalman instance
}

export interface InfractionLog {
    id: number;
    plate: string;
    description: string;
    severity: SeverityType;
    image: string;
    time: string;
    reasoning?: string[];
    legalArticle?: string;
    ruleCategory?: string;
    makeModel?: string; // Marca/Modelo identificado por IA
    color?: string; // Color identificado por IA
    legalBase?: string; // Artículos del RGC
    telemetry: {
        speedEstimated: string;
        acceleration?: string;
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
