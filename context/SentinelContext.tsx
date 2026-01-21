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

    // Actions
    setSource: (s: 'none' | 'live' | 'upload') => void;
    setIsPlaying: (p: boolean) => void;
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
        const saved = localStorage.getItem('sentinel_preset');
        return (saved as PresetType) || 'standard';
    });
    const [engineConfig, setEngineConfig] = useState<EngineConfig>(DETECTION_PRESETS[currentPreset].config);
    const [fps, setFps] = useState(0);
    const [latency, setLatency] = useState(0);

    const hasApiKey = !!((process.env.GEMINI_API_KEY) || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY);

    const [isDetecting, setIsDetecting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false); // Moved from useSentinelSystem to local state for better control

    const [logs, setLogs] = useState<InfractionLog[]>([]); // Moved from useSentinelSystem to local state
    const [stats, setStats] = useState<AppStats>({ det: 0, inf: 0 }); // Moved from useSentinelSystem to local state

    const {
        systemLogs,
        addLog,
        generateGeometry: aiGenerateGeometry, // Renamed to avoid conflict
        runAudit: aiRunAudit, // Renamed to avoid conflict
        statusMsg,
        setStatusMsg,
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
        setIsDetecting(true);
        try {
            return await mpDetect(source);
        } catch (error) {
            handleError('DETECTION', error);
            return null;
        } finally {
            setIsDetecting(false);
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
            await aiRunAudit(track, line, directives);
        } catch (error) {
            handleError('AUDIT', error);
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

                // DISPARO AUTOMÁTICO DE ANÁLISIS DE VÍA
                setTimeout(() => {
                    generateGeometry("Analiza la escena y define la geometría de la vía automáticamente.");
                }, 1000);
            };
            setIsPlaying(false);
            setSource('upload');
            setStatusMsg("VIDEO CARGADO");
            addLog('CORE', 'Subsector de Datos: Transmisión cargada. Iniciando análisis espacial automático...');
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
        setPerformanceMetrics
    };

    return (
        <SentinelContext.Provider value={value}>
            {children}
        </SentinelContext.Provider>
    );
};


