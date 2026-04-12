import { useCallback, useState, useEffect, useRef } from 'react';
import {
  GeometryLine,
  InfractionLog,
  SystemLog,
  Track,
  AppStats,
  LogType,
  AuditResponse,
  AuditPresetType,
} from '../types';
import type { GeometryResponse } from '../services/aiService';
import { logger } from '../services/logger';

const MAX_LOGS = 50;

/**
 * Sentinel System Logic Hook.
 * Manages system logs, forensic audits, and telemetry stats.
 */
export const useSentinelSystem = (hasApiKey: boolean) => {
  const [logs, setLogs] = useState<InfractionLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<AppStats>({ det: 0, inf: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const aiServiceModuleRef = useRef<Promise<typeof import('../services/aiService')> | null>(null);
  const getAIService = useCallback(async () => {
    if (!aiServiceModuleRef.current) {
      aiServiceModuleRef.current = import('../services/aiService');
    }
    const module = await aiServiceModuleRef.current;
    return module.AIService;
  }, []);

  /**
   * Bridges UI logs with the Tactical Logger.
   */
  const addLog = useCallback((type: LogType, content: string) => {
    switch (type) {
      case 'INFO':
        logger.info('SYSTEM', content);
        break;
      case 'WARN':
        logger.warn('SYSTEM', content);
        break;
      case 'ERROR':
        logger.error('SYSTEM', content);
        break;
      case 'AI':
        logger.ai('SYSTEM', content);
        break;
      case 'CORE':
        logger.core('SYSTEM', content);
        break;
      case 'SUCCESS':
        logger.success('SYSTEM', content);
        break;
      case 'DEBUG':
        logger.debug('SYSTEM', content);
        break;
    }
  }, []);

  // Sync System Logs from Tactical Logger
  useEffect(() => {
    const unsubscribe = logger.subscribe((entry) => {
      setSystemLogs((prev) =>
        [
          {
            id: `log_${Math.random().toString(36).substring(2, 11)}`,
            timestamp: new Date(entry.timestamp).toLocaleTimeString(),
            type: entry.level === 'DEBUG' || entry.level === 'SUCCESS' ? 'INFO' : entry.level,
            content: entry.message,
          },
          ...prev,
        ].slice(0, MAX_LOGS)
      );
    });

    if (hasApiKey) {
      logger.ai('SENTINEL_SYSTEM', 'Unidad Forense: Conexión Gemini AGI validada.');
    } else {
      logger.warn(
        'SENTINEL_SYSTEM',
        'Unidad Forense: Sin acceso a Núcleo Gemini (VITE_GOOGLE_GENAI_KEY faltante).'
      );
    }

    return unsubscribe;
  }, [hasApiKey]);

  /**
   * Triggers AI Geometry Generation via Gemini.
   */
  const generateGeometry = useCallback(
    async (directives: string, instruction?: string, image?: string) => {
      if (!hasApiKey) return { lines: [], suggestedDirectives: '' } satisfies GeometryResponse;

      setStatusMsg('GENERANDO VECTORES...');
      setIsAnalyzing(true);

      try {
        addLog('AI', 'Sincronizando con Motor Geométrico Gemini 2.0...');
        const AIService = await getAIService();
        const result = await AIService.generateGeometry(directives, instruction, image);
        setStatusMsg('ZONAS_SINCRONIZADAS');
        return result;
      } catch (error) {
        setStatusMsg('FALLO_GEOMETRÍA_AI');
        logger.error('SENTINEL_SYSTEM', 'Error en generación geométrica', error);
        return { lines: [], suggestedDirectives: '' };
      } finally {
        setIsAnalyzing(false);
        setTimeout(() => setStatusMsg(null), 2000);
      }
    },
    [hasApiKey, addLog, getAIService]
  );

  /**
   * Executes a Supreme Forensic Audit for a specific track intersection.
   */
  const runAudit = useCallback(
    async (
      track: Track,
      line: GeometryLine,
      directives: string,
      auditPreset: AuditPresetType = 'flash'
    ) => {
      if (!hasApiKey) {
        addLog('ERROR', 'Auditoría Forense Requerida: API Key no detectada.');
        return;
      }

      // Initialize Audit State
      track.auditStatus = 'processing';
      track.auditTimestamp = Date.now();

      if (!track.snapshots || track.snapshots.length === 0) {
        addLog('WARN', `Evidencia insuficiente para vehículo #${track.id}. Abortando.`);
        track.auditStatus = 'failed';
        return;
      }

      setIsAnalyzing(true);

      try {
        const timeCode = new Date().toLocaleTimeString();
        addLog('AI', `[${timeCode}] Iniciando Peritaje Judicial [ID:${track.id}] via Gemini...`);

        const AIService = await getAIService();
        const audit: AuditResponse = await AIService.analyzeTrajectory(
          track,
          line,
          directives,
          auditPreset
        );

        if (audit.infraction) {
          addLog('WARN', `INFRACCIÓN CONFIRMADA [${audit.severity}] - ${audit.ruleCategory}`);

          // Create Certified Infraction Log
          const newInfraction: InfractionLog = {
            ...audit,
            id: Date.now(),
            image: `data:image/jpeg;base64,${track.snapshots[0]}`,
            videoClip: track.videoClip,
            time: new Date().toLocaleTimeString(),
          };

          setLogs((prev) => [newInfraction, ...prev]);
          setStats((prev) => ({ ...prev, inf: prev.inf + 1 }));
          track.isInfractor = true;
        } else {
          addLog(
            'SUCCESS',
            `Auditoría completada [ID:${track.id}]. Cumplimiento normativo validado.`
          );
        }

        track.auditStatus = 'completed';
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('SENTINEL_SYSTEM', `Fallo en Peritaje Judicial [#${track.id}]`, err);
        addLog('ERROR', `Error en Auditor Supervisor: ${err.message}`);
        track.auditStatus = 'failed';
      } finally {
        setIsAnalyzing(false);
      }
    },
    [hasApiKey, addLog, getAIService, setStats]
  );

  return {
    logs,
    systemLogs,
    stats,
    addLog,
    generateGeometry,
    runAudit,
    isAnalyzing,
    statusMsg,
    setStatusMsg,
    setStats,
    setLogs,
  };
};
