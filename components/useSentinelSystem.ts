import { useCallback, useState, useEffect } from 'react';
import { GeometryLine, InfractionLog, SystemLog, Track, AppStats, AuditPresetType } from '../types';
import { AIService } from '../services/aiService';
import { logger } from '../services/logger';

const MAX_LOGS = 50;

export const useSentinelSystem = (hasApiKey: boolean) => {
    const [logs, setLogs] = useState<InfractionLog[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [stats, setStats] = useState<AppStats>({ det: 0, inf: 0 });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const addLog = useCallback((type: SystemLog['type'], content: string) => {
        // Ahora addLog es un wrapper de logger para mantener compatibilidad
        if (type === 'INFO') logger.info('SYSTEM', content);
        else if (type === 'WARN') logger.warn('SYSTEM', content);
        else if (type === 'ERROR') logger.error('SYSTEM', content);
        else if (type === 'AI') logger.ai('SYSTEM', content);
        else if (type === 'CORE') logger.core('SYSTEM', content);
    }, []);

    useEffect(() => {
        const unsubscribe = logger.subscribe((entry) => {
            setSystemLogs(prev => [{
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date(entry.timestamp).toLocaleTimeString(),
                type: (entry.level === 'DEBUG' || entry.level === 'SUCCESS') ? 'INFO' : entry.level as any,
                content: entry.message
            }, ...prev].slice(0, MAX_LOGS));
        });

        if (hasApiKey) {
            logger.ai('SENTINEL_SYSTEM', 'Unidad Forense: Conexión Gemini AGI validada.');
        } else {
            logger.error('SENTINEL_SYSTEM', 'Unidad Forense: Sin acceso a Núcleo Forense (Falta API KEY).');
        }

        return unsubscribe;
    }, [hasApiKey]);

    const generateGeometry = useCallback(async (directives: string, instruction?: string, image?: string) => {
        if (!hasApiKey) return { lines: [], suggestedDirectives: "" };
        setStatusMsg("GENERANDO VECTORES...");
        setIsAnalyzing(true);

        try {
            addLog('AI', 'Conectando con Gemini 2.0 Flash para análisis visual de la vía...');
            const result = await AIService.generateGeometry(directives, instruction, image);
            setStatusMsg("ZONAS ACTUALIZADAS");
            return result;
        } catch (e) {
            setStatusMsg("ERROR AI GEOM");
            console.error(e);
            return { lines: [], suggestedDirectives: "" };
        } finally {
            setIsAnalyzing(false);
            setTimeout(() => setStatusMsg(null), 2000);
        }
    }, [hasApiKey, addLog]);

    const runAudit = useCallback(async (track: Track, line: GeometryLine, directives: string, auditPreset?: AuditPresetType) => {
        if (!hasApiKey) {
            addLog('ERROR', 'Unidad Forense: Error de Acceso. API Key no detectada.');
            return;
        }

        // Actualizar estado del track
        track.auditStatus = 'processing';
        track.auditTimestamp = Date.now();

        if (!track.snapshots || track.snapshots.length === 0) {
            addLog('WARN', `Unidad Forense: Evidencia insuficiente para vehículo ${track.id}.`);
            track.auditStatus = 'failed';
            return;
        }
        setIsAnalyzing(true);

        try {
            const timeCode = new Date().toLocaleTimeString();
            addLog('AI', `[${timeCode}] Auditoría Táctica [ID:${track.id}] via Gemini...`);
            const audit = await AIService.runAudit(track, line, directives, auditPreset);

            if (audit.infraction) {
                addLog('WARN', `Unidad Forense: INFRACCIÓN CONFIRMADA [${audit.severity}] - ${audit.ruleCategory}`);
                setStats(prev => ({ ...prev, inf: prev.inf + 1 }));

                // Usar la primera captura (Contexto) para el log visual
                setLogs(prev => [{
                    ...audit,
                    id: Date.now(),
                    image: `data:image/jpeg;base64,${track.snapshots[0]}`,
                    videoClip: track.videoClip, // Adjuntar el clip de video de 8s
                    visualTimestamp: audit.visualTimestamp,
                    time: new Date().toLocaleTimeString(),
                }, ...prev]);

                track.isInfractor = true;
            } else {
                addLog('INFO', `Unidad Forense: Auditoría completada. Sin violación regulatoria.`);
            }

            track.auditStatus = 'completed';
        } catch (e: any) {
            console.error(e);
            addLog('ERROR', `Error Unidad Forense: ${e.message}`);
            track.auditStatus = 'failed';
        } finally {
            setIsAnalyzing(false);
        }
    }, [hasApiKey, addLog, setStats, setLogs]);

    return {
        logs, systemLogs, stats, addLog,
        generateGeometry, runAudit,
        isAnalyzing, statusMsg, setStatusMsg, setStats, setLogs
    };
};
