import React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    AppStats,
    SystemLog,
    InfractionLog,
    GeometryLine,
    EngineConfig,
    SystemStatus
} from '../types';
import { DETECTION_PRESETS, PresetType } from '../constants';
import { AIService } from '../services/aiService';

interface SentinelState {
    // Persistent Configuration
    directives: string;
    isPoseEnabled: boolean;
    currentPreset: PresetType;
    engineConfig: EngineConfig;

    // Volatile Operational State
    source: 'none' | 'live' | 'upload';
    isPlaying: boolean;
    geometry: GeometryLine[];
    stats: AppStats;
    logs: InfractionLog[];
    systemLogs: SystemLog[];
    statusMsg: string | null;
    isAnalyzing: boolean;
    isDetecting: boolean;
    systemStatus: SystemStatus;
    statusLabel: string;
    selectedLog: InfractionLog | null;
    isListening: boolean;

    // Error Handling
    lastError: { message: string; timestamp: string } | null;

    // Actions
    setSource: (s: 'none' | 'live' | 'upload') => void;
    setIsPlaying: (p: boolean) => void;
    setDirectives: (d: string) => void;
    setIsPoseEnabled: (e: boolean) => void;
    setPreset: (p: PresetType) => void;
    setStats: (updater: (prev: AppStats) => AppStats) => void;
    addLog: (type: SystemLog['type'], content: string) => void;
    addInfraction: (log: InfractionLog) => void;
    setGeometry: (g: GeometryLine[]) => void;
    setStatusMsg: (msg: string | null) => void;
    setIsAnalyzing: (a: boolean) => void;
    setIsDetecting: (d: boolean) => void;
    setSystemStatus: (status: Partial<SystemStatus>) => void;
    setStatusLabel: (label: string) => void;
    setSelectedLog: (log: InfractionLog | null) => void;
    setIsListening: (l: boolean) => void;
    setError: (msg: string) => void;
    resetOperationalState: () => void;

    // Thunks (Async Actions)
    generateGeometry: (instruction?: string) => Promise<void>;
    runAudit: (track: any, line: GeometryLine) => Promise<void>;
    onFileChange: (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => void;
}

export const useSentinelStore = create<SentinelState>()(
    persist(
        (set, get) => ({
            // Persistent Defaults
            directives: "- Detectar excesos de velocidad\n- Sancionar invasión de carril\n- Vigilar comportamiento de peatones",
            isPoseEnabled: false,
            currentPreset: 'standard',
            engineConfig: DETECTION_PRESETS['standard'].config,

            // Volatile State
            source: 'none',
            isPlaying: false,
            geometry: [],
            stats: { det: 0, inf: 0 },
            logs: [],
            systemLogs: [],
            statusMsg: null,
            isAnalyzing: false,
            isDetecting: false,
            systemStatus: {
                neural: 'loading',
                forensic: 'pending',
                bionics: 'pending',
                vector: 'pending',
                mediapipeReady: false
            },
            statusLabel: 'INICIALIZANDO...',
            selectedLog: null,
            isListening: false,
            lastError: null,

            // Actions
            setSource: (source) => set({ source }),
            setIsPlaying: (isPlaying) => set({ isPlaying }),
            setDirectives: (directives) => set({ directives }),
            setIsPoseEnabled: (isPoseEnabled) => set({ isPoseEnabled }),

            setPreset: (preset) => set({
                currentPreset: preset,
                engineConfig: DETECTION_PRESETS[preset].config
            }),

            setStats: (updater) => set((state) => ({ stats: updater(state.stats) })),

            addLog: (type, content) => {
                const newLog: SystemLog = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    type,
                    content
                };
                set((state) => ({ systemLogs: [newLog, ...state.systemLogs].slice(0, 100) }));

                if (type === 'ERROR') {
                    get().setError(content);
                }
            },

            addInfraction: (log) => set((state) => ({
                logs: [log, ...state.logs],
                stats: { ...state.stats, inf: state.stats.inf + 1 }
            })),

            setGeometry: (geometry) => set({
                geometry,
                systemStatus: { ...get().systemStatus, vector: geometry.length > 0 ? 'ready' : 'pending' }
            }),

            setStatusMsg: (statusMsg) => set({ statusMsg }),
            setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
            setIsDetecting: (isDetecting) => set({ isDetecting }),

            setSystemStatus: (status) => set((state) => ({
                systemStatus: { ...state.systemStatus, ...status }
            })),

            setStatusLabel: (statusLabel) => set({ statusLabel }),
            setSelectedLog: (selectedLog) => set({ selectedLog }),
            setIsListening: (isListening) => set({ isListening }),

            setError: (message) => set({
                lastError: { message, timestamp: new Date().toISOString() }
            }),

            resetOperationalState: () => set({
                stats: { det: 0, inf: 0 },
                logs: [],
                geometry: [],
                systemLogs: [],
                statusMsg: 'SISTEMA_REINICIADO',
                isPlaying: false
            }),

            // Async Actions
            generateGeometry: async (instruction) => {
                const { directives, addLog, setStatusMsg, setIsAnalyzing, setGeometry, setDirectives } = get();
                addLog('AI', 'Motor Vectorial: Analizando escena para definición de geometría...');
                setIsAnalyzing(true);
                setStatusMsg("GENERANDO VECTORES...");

                try {
                    const result = await AIService.generateGeometry(directives, instruction);
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
                } catch (e: any) {
                    addLog('ERROR', `Motor Vectorial falló: ${e.message}`);
                } finally {
                    setIsAnalyzing(false);
                    setStatusMsg(null);
                }
            },

            runAudit: async (track, line) => {
                const { directives, addLog, addInfraction, setIsAnalyzing, setStatusMsg } = get();
                if (!track.snapshots || track.snapshots.length === 0) {
                    addLog('ERROR', 'Unidad Forense: No hay captura visual del evento.');
                    return;
                }

                setIsAnalyzing(true);
                setStatusMsg("AUDITANDO...");
                try {
                    addLog('AI', `Gemini 2.0 Flash: Auditando evento en "${line.label}"...`);
                    const result = await AIService.runAudit(track, line, directives);

                    if (result.infraction) {
                        const newInfraction: InfractionLog = {
                            id: Date.now(),
                            plate: result.plate || 'NO_PLATE',
                            description: result.description,
                            severity: result.severity || 'MEDIUM',
                            image: `data:image/jpeg;base64,${track.snapshots[0]}`,
                            time: new Date().toLocaleTimeString(),
                            date: new Date().toLocaleDateString(),
                            reasoning: result.reasoning,
                            legalArticle: result.legalArticle,
                            ruleCategory: result.ruleCategory,
                            telemetry: result.telemetry || { speedEstimated: 'N/A' },
                            infraction: true
                        };
                        addInfraction(newInfraction);
                        addLog('WARN', `Unidad Forense: INFRACCIÓN CONFIRMADA [${newInfraction.severity}] - ${newInfraction.ruleCategory}`);
                        track.isInfractor = true;
                    } else {
                        addLog('INFO', `Unidad Forense: Auditoría completada. Sin violación regulatoria.`);
                    }
                } catch (e: any) {
                    addLog('ERROR', `Fallo en Auditoría Forense: ${e.message}`);
                    console.error("AUDIT_THUNK_ERROR:", e);
                } finally {
                    setIsAnalyzing(false);
                    setStatusMsg(null);
                }
            },

            onFileChange: (file, videoRef) => {
                const { resetOperationalState, addLog, setStatusMsg, setSource, generateGeometry } = get();
                if (file && videoRef.current) {
                    resetOperationalState();
                    addLog('INFO', `Sistema de Archivos: Cargando video "${file.name}"...`);

                    const url = URL.createObjectURL(file);
                    videoRef.current.src = url;
                    videoRef.current.currentTime = 0;

                    videoRef.current.onloadeddata = () => {
                        addLog('INFO', `Procesador Cápsula: Video "${file.name}" sincronizado.`);
                        setStatusMsg("SISTEMA_LISTO");

                        setTimeout(() => {
                            generateGeometry("Analiza la escena y define la geometría de la vía automáticamente.");
                        }, 1000);
                    };
                    setSource('upload');
                    setStatusMsg("VIDEO CARGADO");
                    addLog('CORE', 'Subsector de Datos: Transmisión cargada. Iniciando análisis espacial automático...');
                }
            }
        }),
        {
            name: 'sentinel-terminal-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                directives: state.directives,
                isPoseEnabled: state.isPoseEnabled,
                currentPreset: state.currentPreset
            }),
        }
    )
);
