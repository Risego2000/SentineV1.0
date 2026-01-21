import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useSentinelStore } from '../store/useSentinelStore';
import { useNeuralCore } from '../components/useNeuralCore';
import {
    GeometryLine,
    InfractionLog,
    SystemLog,
    SystemStatus,
    AppStats,
    EngineConfig
} from '../types';
import { PresetType } from '../constants';

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
    isDetecting: boolean;
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
    startLiveFeed: () => Promise<MediaStream>;
    onFileChange: (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
    detect: (source: HTMLVideoElement) => Promise<any>;
    detectPose: (source: HTMLVideoElement) => Promise<any>;
}

const SentinelContext = createContext<SentinelContextType | undefined>(undefined);

export const SentinelProvider = ({ children }: { children: ReactNode }) => {
    const store = useSentinelStore();

    const hasApiKey = !!((process.env.GEMINI_API_KEY) || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY);

    const {
        status: neuralStatus,
        statusLabel,
        detect: mpDetect,
        detectPose: mpDetectPose,
        mediapipeReady
    } = useNeuralCore({
        onLog: store.addLog,
        confidenceThreshold: store.engineConfig.confidenceThreshold,
        isPoseEnabled: store.isPoseEnabled
    });

    const detect = useCallback(async (videoSource: HTMLVideoElement) => {
        store.setIsDetecting(true);
        try {
            return await mpDetect(videoSource);
        } finally {
            store.setIsDetecting(false);
        }
    }, [mpDetect, store]);

    const detectPose = useCallback(async (videoSource: HTMLVideoElement) => {
        return await mpDetectPose(videoSource);
    }, [mpDetectPose]);

    const startLiveFeed = useCallback(async () => {
        store.addLog('CORE', 'Solicitando acceso a Entrada Biónica (Cámara)...');
        store.setStatusMsg("ACCEDIENDO CÁMARA...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            store.setSource('live');
            return stream;
        } catch (e: any) {
            store.addLog('ERROR', `Acceso Biónico denegado: ${e.message}`);
            store.setStatusMsg("CÁMARA DENEGADA");
            throw e;
        }
    }, [store]);

    // Sync complex system status
    useEffect(() => {
        store.setSystemStatus({
            neural: neuralStatus === 'ready' ? 'ready' : neuralStatus === 'error' ? 'error' : 'loading',
            forensic: hasApiKey ? 'ready' : 'error',
            bionics: store.source !== 'none' ? 'ready' : 'pending',
            vector: store.geometry.length > 0 ? 'ready' : 'pending',
            mediapipeReady
        });
        store.setStatusLabel(statusLabel);
    }, [neuralStatus, hasApiKey, store.source, store.geometry.length, mediapipeReady, statusLabel]);

    // Cleanup logic for status messages
    useEffect(() => {
        if (store.statusMsg) {
            const timer = setTimeout(() => store.setStatusMsg(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [store.statusMsg]);

    const value: SentinelContextType = {
        ...store,
        hasApiKey,
        detect,
        detectPose,
        startLiveFeed
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
