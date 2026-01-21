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
    startLiveFeed: () => Promise<void>;
    onFileChange: (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
}

const SentinelContext = createContext<SentinelContextType | undefined>(undefined);

export const SentinelProvider = ({ children }: { children: ReactNode }) => {
    const [source, setSource] = useState<'none' | 'live' | 'upload'>('none');
    const [isPlaying, setIsPlaying] = useState(false);
    const [directives, setDirectives] = useState(`- Sancionar invasión de carril bus.\n - Prohibido giros oblicuos peligrosos.`);
    const [geometry, setGeometry] = useState<GeometryLine[]>([]);
    const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isPoseEnabled, setIsPoseEnabled] = useState(false);
    const [currentPreset, setCurrentPreset] = useState<PresetType>('standard');
    const [engineConfig, setEngineConfig] = useState<EngineConfig>(DETECTION_PRESETS.standard.config);

    const hasApiKey = !!((process.env.GEMINI_API_KEY) || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY);

    const [isDetecting, setIsDetecting] = useState(false);

    const {
        logs,
        systemLogs,
        stats,
        addLog,
        generateGeometry: aiGenerateGeometry,
        runAudit: aiRunAudit,
        isAnalyzing,
        statusMsg,
        setStatusMsg,
        setStats
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

    const detect = useCallback(async (source: HTMLVideoElement) => {
        setIsDetecting(true);
        try {
            return await mpDetect(source);
        } finally {
            setIsDetecting(false);
        }
    }, [mpDetect]);

    const detectPose = useCallback(async (source: HTMLVideoElement) => {
        return await mpDetectPose(source);
    }, [mpDetectPose]);

    const setPreset = useCallback((preset: PresetType) => {
        setCurrentPreset(preset);
        setEngineConfig(DETECTION_PRESETS[preset].config);
        addLog('CORE', `Modo de operación cambiado a: ${DETECTION_PRESETS[preset].label} `);
    }, [addLog]);

    const generateGeometry = useCallback(async (instruction?: string) => {
        addLog('AI', 'Motor Vectorial: Analizando escena para definición de geometría...');
        const result = await aiGenerateGeometry(directives, instruction);
        if (result.lines.length) {
            setGeometry(result.lines);
            if (result.suggestedDirectives) {
                setDirectives(result.suggestedDirectives);
                addLog('AI', 'Protocolo Actualizado: Nuevas directivas de seguridad sincronizadas.');
            }
            addLog('AI', `Motor Vectorial: ${result.lines.length} zonas definidas exitosamente.`);
        } else {
            addLog('WARN', 'Motor Vectorial: No se generó geometría válida.');
        }
    }, [aiGenerateGeometry, directives, addLog, setDirectives]);

    const runAudit = useCallback(async (track: any, line: GeometryLine) => {
        await aiRunAudit(track, line, directives);
    }, [aiRunAudit, directives]);

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
    }, [addLog, setStatusMsg, generateGeometry]);

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
        currentPreset, setPreset,
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
        detect,
        detectPose
    };

    return (
        <SentinelContext.Provider value={value}>
            {children}
        </SentinelContext.Provider>
    );
};

export const useSentinel = () => {
    const context = useContext(SentinelContext);
    if (context === undefined) {
        throw new Error('useSentinel must be used within a SentinelProvider');
    }
    return context;
};
