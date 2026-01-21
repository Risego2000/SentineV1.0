import { useRef, useCallback, useState, useEffect } from 'react';
import { GeometryLine, InfractionLog, SystemLog, Track } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { lineIntersect } from '../utils';

const MAX_LOGS = 50;

export const useSentinelSystem = (hasApiKey: boolean) => {
    const [logs, setLogs] = useState<InfractionLog[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [stats, setStats] = useState({ det: 0, inf: 0 });
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

    const generateGeometry = useCallback(async (directives: string, instruction?: string) => {
        if (!hasApiKey) return [];
        setStatusMsg("GENERANDO VECTORES...");
        setIsAnalyzing(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY });
            const prompt = `INSTRUCCIÓN: "${directives} ${instruction || ''}". 
      Genera JSON con líneas (x1,y1,x2,y2 0-1), etiqueta y tipo ('forbidden','lane_divider','stop_line').`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                x1: { type: Type.NUMBER }, y1: { type: Type.NUMBER },
                                x2: { type: Type.NUMBER }, y2: { type: Type.NUMBER },
                                label: { type: Type.STRING },
                                type: { type: Type.STRING }
                            }
                        }
                    }
                }
            });
            setStatusMsg("ZONAS ACTUALIZADAS");
            return JSON.parse(response.text.trim()) as GeometryLine[];
        } catch (e) {
            setStatusMsg("ERROR AI GEOM");
            console.error(e);
            return [];
        } finally {
            setIsAnalyzing(false);
            setTimeout(() => setStatusMsg(null), 2000);
        }
    }, [hasApiKey]);

    const runAudit = useCallback(async (track: Track, line: GeometryLine, directives: string) => {
        if (!hasApiKey || track.snapshots.length === 0) return;
        setIsAnalyzing(true);

        try {
            addLog('AI', `Unidad Forense: Iniciando auditoría de sospecha (${line.label})...`);
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: track.snapshots[0] } },
                        { text: `AUDITORÍA SENTINEL: Vehículo cruzó "${line.label}". Reglas: ${directives}. Evalúa infracción y genera reporte JSON.` }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            infraction: { type: Type.BOOLEAN },
                            plate: { type: Type.STRING },
                            description: { type: Type.STRING },
                            severity: { type: Type.STRING },
                            legalArticle: { type: Type.STRING },
                            ruleCategory: { type: Type.STRING },
                            reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
                            telemetry: { type: Type.OBJECT, properties: { speedEstimated: { type: Type.STRING } } }
                        }
                    }
                }
            });
            const audit = JSON.parse(response.text.trim());
            if (audit.infraction) {
                addLog('WARN', `Unidad Forense: INFRACCIÓN CONFIRMADA [${audit.severity}] - ${audit.ruleCategory}`);
                setStats(prev => ({ ...prev, inf: prev.inf + 1 }));
                setLogs(prev => [{
                    ...audit, id: Date.now(),
                    image: `data:image/jpeg;base64,${track.snapshots[0]}`,
                    time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString()
                }, ...prev]);
                track.isInfractor = true;
            } else {
                addLog('INFO', `Unidad Forense: Auditoría completada. Sin violación regulatoria.`);
            }
        } catch (e: any) {
            console.error(e);
            addLog('ERROR', `Error Unidad Forense: ${e.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    }, [hasApiKey]);

    return {
        logs, systemLogs, stats, addLog,
        generateGeometry, runAudit,
        isAnalyzing, statusMsg, setStatusMsg, setStats
    };
};
