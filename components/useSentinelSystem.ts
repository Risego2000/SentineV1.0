import { useCallback, useState, useEffect } from 'react';
import { GeometryLine, InfractionLog, SystemLog, Track, AppStats } from '../types';
import { AIService } from '../services/aiService';

const MAX_LOGS = 50;

export const useSentinelSystem = (hasApiKey: boolean) => {
    const [logs, setLogs] = useState<InfractionLog[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [stats, setStats] = useState<AppStats>({ det: 0, inf: 0 });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const addLog = useCallback((type: SystemLog['type'], content: string) => {
        setSystemLogs(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type,
            content
        }, ...prev].slice(0, MAX_LOGS));
    }, []);

    useEffect(() => {
        if (hasApiKey) {
            addLog('AI', 'Unidad Forense: Conexión Gemini AGI validada.');
        } else {
            addLog('ERROR', 'Unidad Forense: Sin acceso a Núcleo Forense (Falta API KEY).');
        }
    }, [hasApiKey, addLog]);

    const generateGeometry = useCallback(async (directives: string, instruction?: string) => {
        if (!hasApiKey) return { lines: [], suggestedDirectives: "" };
        setStatusMsg("GENERANDO VECTORES...");
        setIsAnalyzing(true);

        try {
            addLog('AI', 'Conectando con Gemini 2.0 Flash (Neural-V2) para análisis espacial...');
            const result = await AIService.generateGeometry(directives, instruction);
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

    const runAudit = useCallback(async (track: Track, line: GeometryLine, directives: string) => {
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
            addLog('AI', `[${timeCode}] Analizando infracción en "${line.label}" via Gemini...`);
            const audit = await AIService.runAudit(track, line, directives);

            if (audit.infraction) {
                addLog('WARN', `Unidad Forense: INFRACCIÓN CONFIRMADA [${audit.severity}] - ${audit.ruleCategory}`);
                setStats(prev => ({ ...prev, inf: prev.inf + 1 }));

                // Usar la primera captura (Contexto) para el log visual
                setLogs(prev => [{
                    ...audit,
                    id: Date.now(),
                    image: `data:image/jpeg;base64,${track.snapshots[0]}`,
                    time: new Date().toLocaleTimeString(),
                    date: new Date().toLocaleDateString()
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
