import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import {
    GeometryLine,
    InfractionLog,
    SystemLog,
    SystemStatus,
    AppStats,
    EngineConfig
} from '../types';
import { DETECTION_PRESETS, PresetType } from '../constants';
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
    isEditingGeometry: boolean;
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

    // Actions
    setSource: (s: 'none' | 'live' | 'upload') => void;
    setIsPlaying: (p: boolean) => void;
    setIsEditingGeometry: (e: boolean) => void;
    setDirectives: (d: string) => void;
    setGeometry: (g: GeometryLine[]) => void;
    setSelectedLog: (l: InfractionLog | null) => void;
    setIsListening: (l: boolean) => void;
    setIsPoseEnabled: (p: boolean) => void;
    setPreset: (p: PresetType) => void;
    setStats: (s: (prev: AppStats) => AppStats) => void;
    addLog: (type: SystemLog['type'], content: string) => void;
    generateGeometry: (instruction?: string) => Promise<void>;
    runAudit: (track: any, line: GeometryLine) => Promise<void>;
    setStatusMsg: (msg: string | null) => void;
    setPerformanceMetrics: (fps: number, latency: number) => void;
    startLiveFeed: () => Promise<void>;
    onFileChange: (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
    addInfraction: (log: InfractionLog) => void;
    detect: (source: HTMLVideoElement) => Promise<any>;
    detectPose: (source: HTMLVideoElement) => Promise<any>;
}

export const SentinelContext = createContext<SentinelContextType | undefined>(undefined);

export const SentinelProvider = ({ children }: { children: ReactNode }) => {
    const [source, setSource] = useState<'none' | 'live' | 'upload'>('none');
    const [isPlaying, setIsPlaying] = useState(false);
    const [directives, setDirectives] = useState(() => localStorage.getItem('sentinel_directives') || `- Sancionar invasión de carril bus.\n - Prohibido giros oblicuos peligrosos.`);
    const [geometry, setGeometry] = useState<GeometryLine[]>(() => {
        const saved = localStorage.getItem('sentinel_geometry');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isPoseEnabled, setIsPoseEnabled] = useState(false);
    const [currentPreset, setPreset] = useState<PresetType>(() => {
        const saved = localStorage.getItem('sentinel_preset') as PresetType;
        // Validación táctica: Si el preset guardado no existe en el motor actual, usar default
        return (saved && DETECTION_PRESETS[saved]) ? saved : 'neural_core';
    });
    const [engineConfig, setEngineConfig] = useState<EngineConfig>(DETECTION_PRESETS[currentPreset]?.config || DETECTION_PRESETS.neural_core.config);
    const [fps, setFps] = useState(0);
    const [latency, setLatency] = useState(0);
    const [isEditingGeometry, setIsEditingGeometry] = useState(false);
    const [tracks, setTracks] = useState<any[]>([]);
    const [calibration, setCalibration] = useState(() => {
        const saved = localStorage.getItem('sentinel_calibration');
        return saved ? parseFloat(saved) : 0.05;
    });

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

    const generateGeometry = useCallback(async (instruction?: string) => {
        const cacheKey = CacheService.generateKey(directives, instruction);
        const cached = CacheService.get<any>(cacheKey);

        if (cached) {
            logger.info('SENTINEL_CONTEXT', 'Recuperando geometría de caché local.');
            setGeometry(cached.lines);
            if (cached.suggestedDirectives) setDirectives(cached.suggestedDirectives);
            return;
        }

        try {
            setStatusMsg("GENERANDO VECTORES...");
            setIsAnalyzing(true);
            const result = await aiGenerateGeometry(directives, instruction);
            if (result.lines.length > 0) {
                setGeometry(result.lines);
                if (result.suggestedDirectives) setDirectives(result.suggestedDirectives);
                CacheService.set(cacheKey, result);
            }
            setStatusMsg("ZONAS ACTUALIZADAS");
        } catch (error: any) {
            handleError('GEOMETRY', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [directives, aiGenerateGeometry, setStatusMsg, handleError]);

    const runAudit = useCallback(async (track: any, line: GeometryLine) => {
        try {
            setIsAnalyzing(true);
            await aiRunAudit(track, line, directives);
        } catch (error) {
            handleError('AUDIT', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [aiRunAudit, directives, handleError]);

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
        isEditingGeometry, setIsEditingGeometry,
        directives, setDirectives,
        geometry, setGeometry,
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
        calibration,
        setCalibration
    };

    return (
        <SentinelContext.Provider value={value}>
            {children}
        </SentinelContext.Provider>
    );
};


