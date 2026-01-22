import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import {
    GeometryLine,
    InfractionLog,
    SystemLog,
    SystemStatus,
    AppStats,
    EngineConfig
} from '../types';
import { DETECTION_PRESETS, PresetType, AUDIT_PRESETS, AuditPresetType } from '../constants';
import { useSentinelSystem } from '../components/useSentinelSystem';
import { useNeuralCore } from '../components/useNeuralCore';
import { AIService } from '../services/aiService';
import { logger } from '../services/logger';
import { CacheService } from '../services/cacheService';
import { errorTracker } from '../services/errorTracker';

/**
 * Tipo que define el estado global y las acciones disponibles en Sentinel AI.
 */
interface SentinelContextType {
    // State
    source: 'none' | 'live' | 'upload';
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
    tracks: any[];
    setTracks: (t: any[]) => void;
    calibration: number;
    setCalibration: (c: number) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;

    // Actions
    setSource: (s: 'none' | 'live' | 'upload') => void;
    setIsPlaying: (p: boolean) => void;
    setIsMeshRenderEnabled: (e: boolean) => void;
    parseMeshDirectives: () => void;
    setDirectives: (d: string) => void;
    setGeometry: (g: GeometryLine[]) => void;
    setSelectedLog: (l: InfractionLog | null) => void;
    setIsListening: (l: boolean) => void;
    setIsPoseEnabled: (p: boolean) => void;
    setPreset: (p: PresetType) => void;
    setStats: (s: (prev: AppStats) => AppStats) => void;
    addLog: (type: SystemLog['type'], content: string) => void;
    generateGeometry: (instruction?: string, videoElement?: HTMLVideoElement | null) => Promise<void>;
    runAudit: (track: any, line: GeometryLine) => Promise<void>;
    setStatusMsg: (msg: string | null) => void;
    setPerformanceMetrics: (fps: number, latency: number) => void;
    isAuditEnabled: boolean;
    setIsAuditEnabled: (e: boolean) => void;
    currentAuditPreset: AuditPresetType;
    setAuditPreset: (p: AuditPresetType) => void;
    startLiveFeed: () => Promise<void>;
    onFileChange: (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
    addInfraction: (log: InfractionLog) => void;
    detect: (source: HTMLVideoElement) => Promise<any>;
    detectPose: (source: HTMLVideoElement) => Promise<any>;
}

export const SentinelContext = createContext<SentinelContextType | undefined>(undefined);

export const SentinelProvider = ({ children }: { children: ReactNode }) => {
    const [source, setSource] = useState<'none' | 'live' | 'upload'>('none');
    const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isPoseEnabled, setIsPoseEnabled] = useState(false);
    const [currentPreset, setPreset] = useState<PresetType>(() => {
        const saved = localStorage.getItem('sentinel_preset') as PresetType;
        return (saved && DETECTION_PRESETS[saved]) ? saved : 'standard';
    });
    const [engineConfig, setEngineConfig] = useState<EngineConfig>(DETECTION_PRESETS[currentPreset]?.config || DETECTION_PRESETS.standard.config);
    const [fps, setFps] = useState(0);
    const [latency, setLatency] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMeshRenderEnabled, setIsMeshRenderEnabled] = useState(true);
    const [directives, setDirectives] = useState('Monitoriza la vía principal...');
    const [geometry, setGeometry] = useState<GeometryLine[]>([]);
    const [tracks, setTracks] = useState<any[]>([]);
    const [calibration, setCalibration] = useState(() => {
        const saved = localStorage.getItem('sentinel_calibration');
        return saved ? parseFloat(saved) : 0.05;
    });

    const videoRef = useRef<HTMLVideoElement | null>(null);

    const hasApiKey = !!((process.env.GEMINI_API_KEY) || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY);

    const [isDetecting, setIsDetecting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const {
        logs,
        stats,
        setStats,
        systemLogs,
        addLog,
        generateGeometry: aiGenerateGeometry,
        runAudit: aiRunAudit,
        statusMsg,
        setStatusMsg,
        setLogs
    } = useSentinelSystem(hasApiKey);

    const {
        status: neuralStatus,
        statusLabel,
        detect: mpDetect,
        detectPose: mpDetectPose,
        mediapipeReady
    } = useNeuralCore({
        onLog: addLog,
        confidenceThreshold: engineConfig.confidenceThreshold,
        isPoseEnabled
    });

    // --- CENTRALIZED ERROR HANDLING ---
    const handleError = useCallback((scope: string, error: any) => {
        const errObject = error instanceof Error ? error : new Error(String(error));
        errorTracker.track(scope, errObject); // Tracking global

        const message = errObject.message;
        addLog('ERROR', `${scope}: ${message}`);
        setStatusMsg(`ERROR_${scope.toUpperCase()}`);
        setTimeout(() => setStatusMsg(null), 3000);
    }, [addLog, setStatusMsg]);

    const detect = useCallback(async (source: HTMLVideoElement) => {
        // PERF: No actualizamos estado isDetecting frame a frame para evitar colapso de React
        try {
            return await mpDetect(source);
        } catch (error) {
            handleError('DETECTION', error);
            return null;
        }
    }, [mpDetect, handleError]);

    const detectPose = useCallback(async (source: HTMLVideoElement) => {
        try {
            return await mpDetectPose(source);
        } catch (error) {
            handleError('POSE_DETECTION', error);
            return null;
        }
    }, [mpDetectPose, handleError]);

    const [isAuditEnabled, setIsAuditEnabled] = useState(true);
    const [currentAuditPreset, setAuditPreset] = useState<AuditPresetType>('standard');

    const setPresetAndConfig = useCallback((preset: PresetType) => {
        setPreset(preset); // Use the local setPreset
        setEngineConfig(DETECTION_PRESETS[preset].config);
        addLog('CORE', `Modo de operación cambiado a: ${DETECTION_PRESETS[preset].label} `);
    }, [addLog, setPreset]);

    const addInfraction = useCallback((log: InfractionLog) => {
        setLogs(prev => [log, ...prev]);
        setStats(prev => ({ ...prev, inf: prev.inf + 1 }));
        logger.ai('SENTINEL_CONTEXT', `Sanción Detectada: ${log.plate || 'SIN_PLACA'} - ${log.description}`);
        addLog('AI', `Sanción Detectada: ${log.plate || 'SIN_PLACA'} - ${log.description}`);
    }, [addLog, setLogs, setStats]);

    const setPerformanceMetrics = useCallback((f: number, l: number) => {
        setFps(f);
        setLatency(l);
    }, []);

    // --- PERSISTENCE ---
    useEffect(() => {
        localStorage.setItem('sentinel_directives', directives);
    }, [directives]);

    useEffect(() => {
        localStorage.setItem('sentinel_geometry', JSON.stringify(geometry));
    }, [geometry]);

    useEffect(() => {
        localStorage.setItem('sentinel_preset', currentPreset);
    }, [currentPreset]);

    useEffect(() => {
        localStorage.setItem('sentinel_calibration', calibration.toString());
    }, [calibration]);

    const generateGeometry = useCallback(async (instruction?: string, videoElement?: HTMLVideoElement | null) => {
        const cacheKey = CacheService.generateKey(directives, instruction);
        const cached = CacheService.get<any>(cacheKey);

        if (cached && !videoElement) {
            logger.info('SENTINEL_CONTEXT', 'Recuperando geometría de caché local.');
            setGeometry(cached.lines);
            if (cached.suggestedDirectives) setDirectives(cached.suggestedDirectives);
            return;
        }

        try {
            setStatusMsg("ANALIZANDO VÍA...");
            setIsAnalyzing(true);

            let base64Image: string | undefined = undefined;
            if (videoElement) {
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoElement, 0, 0);
                    base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                }
            }

            const result = await aiGenerateGeometry(directives, instruction, base64Image);
            if (result.lines.length > 0) {
                setGeometry(result.lines);
                if (result.suggestedDirectives) setDirectives(result.suggestedDirectives);
                if (!videoElement) CacheService.set(cacheKey, result);
            }
            setStatusMsg("GEOMETRÍA_SINCRONIZADA");
        } catch (error: any) {
            handleError('GEOMETRY', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [directives, aiGenerateGeometry, setStatusMsg, handleError]);

    const runAudit = useCallback(async (track: any, line: GeometryLine) => {
        try {
            setIsAnalyzing(true);
            await aiRunAudit(track, line, directives, currentAuditPreset);
        } catch (error) {
            handleError('AUDIT', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [aiRunAudit, directives, currentAuditPreset, handleError]);

    const startLiveFeed = useCallback(async () => {
        addLog('CORE', 'Solicitando acceso a Entrada Biónica (Cámara)...');
        setStatusMsg("ACCEDIENDO CÁMARA...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            return stream;
        } catch (e: any) {
            addLog('ERROR', `Acceso Biónico denegado: ${e.message} `);
            setStatusMsg("CÁMARA DENEGADA");
            throw e;
        }
    }, [addLog, setStatusMsg]);

    const onFileChange = useCallback((file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => {
        if (file && videoRef.current) {
            // REINICIO TÁCTICO TOTAL
            setStats({ det: 0, inf: 0 });
            setGeometry([]);
            setDirectives("");
            addLog('INFO', `Sistema de Archivos: Cargando video "${file.name}"...`);

            const url = URL.createObjectURL(file);
            videoRef.current.src = url;
            videoRef.current.currentTime = 0;

            videoRef.current.onloadeddata = () => {
                addLog('INFO', `Procesador Cápsula: Video "${file.name}" sincronizado.`);
                setStatusMsg("SISTEMA_LISTO");

                // AUTO-ANALYSIS: Generar protocolo y geometría inicial
                setTimeout(() => {
                    addLog('Core', 'Unidad Táctica: Escaneando escena para generar Protocolo de Seguridad...');
                    generateGeometry("PERFILADO DE ESCENA: Analiza el video, detecta el tipo de vía y genera un PROTOCOLO DE SEGURIDAD completo con su geometría asociada.");
                }, 1000);
            };
            setIsPlaying(false);
            setSource('upload');
            setStatusMsg("VIDEO CARGADO");
            addLog('CORE', 'Subsector de Datos: Transmisión cargada. Iniciando análisis de protocolos...');
            setTimeout(() => setStatusMsg(null), 2000);
        }
    }, [addLog, setStatusMsg, generateGeometry, setStats, setGeometry, setDirectives]);

    const parseMeshDirectives = useCallback(() => {
        addLog('CORE', 'Sincronizando Malla: Escaneando directivas textuales...');
        const newLines: GeometryLine[] = [];
        const text = directives.toLowerCase();

        // 1. Detección por Palabras Clave
        if (text.includes('continua') || text.includes('línea continua')) {
            newLines.push({ id: 'kw_solid_' + Date.now(), x1: 0.2, y1: 0.5, x2: 0.8, y2: 0.5, label: 'Línea Continua', type: 'lane_divider' });
        }
        if (text.includes('stop') || text.includes('detención')) {
            newLines.push({ id: 'kw_stop_' + Date.now(), x1: 0.3, y1: 0.4, x2: 0.7, y2: 0.4, label: 'Línea de STOP', type: 'stop_line' });
        }
        if (text.includes('peatones') || text.includes('cebra')) {
            newLines.push({ id: 'kw_ped_' + Date.now(), x1: 0.2, y1: 0.6, x2: 0.8, y2: 0.6, label: 'Paso Peatones', type: 'pedestrian' });
        }
        if (text.includes('bus') || text.includes('carril bus')) {
            newLines.push({ id: 'kw_bus_' + Date.now(), x1: 0.1, y1: 0.45, x2: 0.9, y2: 0.45, label: 'Carril BUS', type: 'bus_lane' });
        }

        // 2. Detección por Sintaxis Manual [LINE: Y=X, TYPE=Y, LABEL=Z]
        const lineRegex = /\[LINE:\s*Y=(\d+),\s*TYPE=(\w+),\s*LABEL=([^,\]]+)(?:,\s*INFRACTION=[^\]]+)?\]/gi;
        let match;
        while ((match = lineRegex.exec(directives)) !== null) {
            const y = parseInt(match[1]) / 1000;
            const type = match[2].toLowerCase() as any;
            const label = match[3].trim();
            newLines.push({
                id: 'sync_' + Math.random().toString(36).substr(2, 9),
                x1: 0.1, y1: y, x2: 0.9, y2: y,
                label: label,
                type: type === 'solid' ? 'lane_divider' : type as any
            });
        }

        if (newLines.length > 0) {
            setGeometry(prev => [...prev, ...newLines]);
            addLog('AI', `Malla Actualizada: ${newLines.length} sensores generados.`);
        } else {
            addLog('WARN', 'No se detectaron directivas de línea válidas en el prompt.');
        }
    }, [directives, addLog, setGeometry]);

    // --- PROTOCOL SYNC ---
    useEffect(() => {
        if (directives) {
            addLog('CORE', 'Unidad Forense: Protocolos de seguridad sincronizados y actualizados.');
            setStatusMsg("REGLAS ACTUALIZADAS");
            setTimeout(() => setStatusMsg(null), 1500);
        }
    }, [directives, addLog, setStatusMsg]);

    const systemStatus: SystemStatus = {
        neural: neuralStatus === 'ready' ? 'ready' : neuralStatus === 'error' ? 'error' : 'loading',
        forensic: hasApiKey ? 'ready' : 'error',
        bionics: source !== 'none' ? 'ready' : 'pending',
        vector: geometry.length > 0 ? 'ready' : 'pending',
        mediapipeReady
    };

    const value = {
        source, setSource,
        isPlaying, setIsPlaying,
        isMeshRenderEnabled, setIsMeshRenderEnabled,
        parseMeshDirectives,
        directives, setDirectives,
        geometry, setGeometry,
        videoRef,
        selectedLog, setSelectedLog,
        isListening, setIsListening,
        isPoseEnabled, setIsPoseEnabled,
        currentPreset, setPreset: setPresetAndConfig,
        engineConfig,
        stats, setStats,
        logs,
        systemLogs,
        statusMsg, setStatusMsg,
        isAnalyzing,
        isDetecting,
        systemStatus,
        statusLabel,
        hasApiKey,
        addLog,
        generateGeometry,
        runAudit,
        startLiveFeed,
        onFileChange,
        addInfraction,
        detect,
        detectPose,
        fps,
        latency,
        setPerformanceMetrics,
        tracks,
        setTracks,
        isAuditEnabled, setIsAuditEnabled,
        currentAuditPreset, setAuditPreset,
        calibration,
        setCalibration
    };

    return (
        <SentinelContext.Provider value={value}>
            {children}
        </SentinelContext.Provider>
    );
};


