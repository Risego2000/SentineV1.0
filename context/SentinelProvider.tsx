import React, { useState, useCallback, ReactNode, useEffect, useRef, useMemo } from 'react';
import {
  GeometryLine,
  InfractionLog,
  SystemStatus,
  StandardDetection,
  PoseResult,
  IpCameraConfig,
  PresetType,
  AuditPresetType,
  KinematicPresetType,
  EngineConfig,
  Track,
  EntityType,
} from '../types';
import { DETECTION_PRESETS, AUDIT_PRESETS, KINEMATIC_PRESETS } from '../constants';
import { useSentinelSystem } from '../components/useSentinelSystem';
import { useNeuralCore } from '../components/useNeuralCore';
import type { GeometryResponse } from '../services/aiService';
import { logger } from '../services/logger';
import { CacheService } from '../services/cacheService';
import { forensicQueue } from '../services/ForensicQueue';
import { evidenceDB } from '../services/EvidenceDB';
import { ReportService } from '../services/ReportService';
import {
  createIpCameraSession,
  isSupportedIpCameraUrl,
  sanitizeCameraUrlForLogs,
} from '../services/ipCameraService';

import { SentinelContext, SentinelContextType } from './SentinelContext';

/**
 * Sentinel AI State Provider.
 */
export const SentinelProvider = ({ children }: { children: ReactNode }) => {
  const [source, _setSource] = useState<'none' | 'live' | 'upload' | 'ip'>('none');
  const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [helpMsg, setHelpMsg] = useState<string | null>(
    'Bienvenido a Sentinel AI. Pase el ratón sobre los elementos para obtener ayuda.'
  );
  const [isPoseEnabled, _setIsPoseEnabled] = useState(false);
  const [currentPreset, setPreset] = useState<PresetType>(() => {
    const saved = localStorage.getItem('sentinel_preset') as PresetType;
    return saved && DETECTION_PRESETS[saved] ? saved : 'sentinel';
  });
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(
    DETECTION_PRESETS[currentPreset]?.config || DETECTION_PRESETS.sentinel.config
  );
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [isPlaying, _setIsPlaying] = useState(false);
  const [isMeshRenderEnabled, _setIsMeshRenderEnabled] = useState(false);
  const [directives, _setDirectives] = useState(`[PROTOCOLO_ESTÁNDAR_V1.6]:
- Monitorización activa de línea de parada (STOP) y semáforos.
- Detección de invasión de carril contrario o línea continua.
- Vigilancia de prioridad peatonal en pasos cebra.
- Control de exceso de velocidad y aceleraciones bruscas.
- Auditoría de estacionamientos prohibidos en zonas de carga.`);
  const [geometry, setGeometry] = useState<GeometryLine[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [calibration, _setCalibration] = useState(() => {
    const saved = localStorage.getItem('sentinel_calibration');
    return saved ? parseFloat(saved) : 0.05;
  });

  const [bufferStatus, setBufferStatus] = useState<SentinelContextType['bufferStatus']>({
    state: 'idle',
    seconds: 0,
    activeTracks: 0,
  });

  const updateBufferStatus = useCallback((status: Partial<SentinelContextType['bufferStatus']>) => {
    setBufferStatus((prev) => ({ ...prev, ...status }));
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const logsRef = useRef<InfractionLog[]>([]);
  const reportGenerationRef = useRef(false);

  // Batch Processing State
  const [videoQueue, setVideoQueue] = useState<File[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const hasApiKey = !!import.meta.env.VITE_GOOGLE_GENAI_KEY;

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
    setLogs,
  } = useSentinelSystem(hasApiKey);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('INFO', 'Panel de infracciones reiniciado para nuevo análisis.');
  }, [setLogs, addLog]);

  const {
    status: neuralStatus,
    statusLabel,
    detect: mpDetect,
    detectPose: mpDetectPose,
    mediapipeReady,
  } = useNeuralCore({
    onLog: addLog,
    confidenceThreshold: engineConfig.confidenceThreshold,
    isPoseEnabled,
  });

  const handleError = useCallback(
    (scope: string, error: unknown) => {
      const errObject = error instanceof Error ? error : new Error(String(error));
      logger.error(scope, errObject.message, errObject);

      addLog('ERROR', `${scope}: ${errObject.message}`);
      setStatusMsg(`ERROR_${scope.toUpperCase()}`);
      setTimeout(() => setStatusMsg(null), 3000);
    },
    [addLog, setStatusMsg]
  );

  const detect = useCallback(
    async (source: HTMLVideoElement): Promise<StandardDetection[] | null> => {
      try {
        return await mpDetect(source);
      } catch (error) {
        handleError('DETECTION', error);
        return null;
      }
    },
    [mpDetect, handleError]
  );

  const detectPose = useCallback(
    async (source: HTMLVideoElement): Promise<PoseResult[] | null> => {
      try {
        return await mpDetectPose(source);
      } catch (error) {
        handleError('POSE_DETECTION', error);
        return null;
      }
    },
    [mpDetectPose, handleError]
  );

  const setSource = useCallback(
    (s: 'none' | 'live' | 'upload' | 'ip') => {
      _setSource(s);
      addLog('CORE', `Fuente de video cambiada a: ${s.toUpperCase()}`);
    },
    [addLog]
  );

  const setIsPlaying = useCallback(
    (p: boolean) => {
      _setIsPlaying(p);
      addLog('CORE', `Estado de reproducción: ${p ? 'PLAYING' : 'PAUSED'}`);
    },
    [addLog]
  );

  const setIsMeshRenderEnabled = useCallback(
    (e: boolean) => {
      _setIsMeshRenderEnabled(e);
      addLog('CORE', `Renderizado de malla: ${e ? 'ON' : 'OFF'}`);
    },
    [addLog]
  );

  const setDirectives = useCallback(
    (d: string) => {
      _setDirectives(d);
      addLog(
        'AI',
        `Directivas de protocolo actualizadas: "${d.substring(0, 50)}${d.length > 50 ? '...' : ''}"`
      );
    },
    [addLog]
  );

  const setIsPoseEnabled = useCallback(
    (p: boolean) => {
      _setIsPoseEnabled(p);
      addLog('CORE', `Motor cinemático (Pose): ${p ? 'ACTIVADO' : 'DESACTIVADO'}`);
    },
    [addLog]
  );

  const setCalibration = useCallback(
    (c: number) => {
      _setCalibration(c);
      addLog('CORE', `Calibración métrica actualizada: ${c} m/px`);
    },
    [addLog]
  );

  const [isAuditEnabled, _setIsAuditEnabled] = useState(true);
  const [currentAuditPreset, _setAuditPreset] = useState<AuditPresetType>('senior');
  const [currentKinematicPreset, _setKinematicPreset] = useState<KinematicPresetType>('full');

  const setIsAuditEnabled = useCallback(
    (e: boolean) => {
      _setIsAuditEnabled(e);
      addLog('AI', `Auditoría forense Gemini: ${e ? 'ACTIVADA' : 'DESACTIVADA'}`);
    },
    [addLog]
  );

  const setAuditPreset = useCallback(
    (p: AuditPresetType) => {
      _setAuditPreset(p);
      addLog('AI', `Preset de auditoría cambiado a: ${AUDIT_PRESETS[p].label}`);
    },
    [addLog]
  );

  const setKinematicPreset = useCallback(
    (p: KinematicPresetType) => {
      _setKinematicPreset(p);
      const presetLabel = KINEMATIC_PRESETS[p]?.model || p.toUpperCase();
      addLog('CORE', `Modelo cinemático MediaPipe: ${presetLabel}`);
    },
    [addLog]
  );

  const setPresetAndConfig = useCallback(
    (preset: PresetType) => {
      setPreset(preset);
      setEngineConfig(DETECTION_PRESETS[preset].config);
      addLog('CORE', `Modo de operación cambiado a: ${DETECTION_PRESETS[preset].label} `);
    },
    [addLog]
  );

  const addInfraction = useCallback(
    (log: InfractionLog) => {
      setLogs((prev) => [log, ...prev]);
      setStats((prev) => ({ ...prev, inf: prev.inf + 1 }));
      logger.ai(
        'SENTINEL_CONTEXT',
        `Sanción Detectada: ${log.plate || 'SIN_PLACA'} - ${log.description}`
      );
      addLog('AI', `Sanción Detectada: ${log.plate || 'SIN_PLACA'} - ${log.description}`);

      (async () => {
        try {
          // Permanently save to EvidenceDB
          await evidenceDB.saveInfraction(log);

          // Give the UI a bit of breathing room before heavy PDF generation
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const { filename, path } = await ReportService.generateAndSaveInfractionPdf(log);

          // Permanently save Video Evidence to disk
          if (log.videoClip) {
            try {
              const videoFilename = filename.replace('.pdf', '.webm');
              const videoBase64 = log.videoClip.split(',')[1];
              const videoBuffer = Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0)).buffer;
              await ReportService.saveVideoToDisk(videoBuffer, videoFilename);
              addLog('SUCCESS', `Evidencia de video guardada: ${videoFilename}`);
            } catch (vErr) {
              console.error('Error saving video evidence:', vErr);
            }
          }

          setLogs((prev) =>
            prev.map((entry) => (entry.id === log.id ? { ...entry, reportPath: path } : entry))
          );
          addLog('SUCCESS', `Expediente individual generado: ${filename}`);
          addLog('SUCCESS', `PDF individual guardado automáticamente en: ${path}`);
        } catch (error) {
          addLog(
            'ERROR',
            `No se pudo guardar el expediente individual: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })();
    },
    [addLog, setLogs, setStats]
  );

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Bind ForensicQueue to the infraction logging system
  useEffect(() => {
    forensicQueue.setCallback((log) => {
      addInfraction(log);
    });

    // Initial load of permanent infractions
    (async () => {
      const savedInfractions = await evidenceDB.getAllInfractions();
      if (savedInfractions.length > 0) {
        setLogs(savedInfractions.sort((a, b) => b.id - a.id));
        setStats((prev) => ({ ...prev, inf: savedInfractions.length }));
        addLog(
          'INFO',
          `Recuperadas ${savedInfractions.length} denuncias desde almacenamiento permanente.`
        );
      }
    })();

    // Initial cleanup of old evidence
    evidenceDB.purgeOldEvidence();
  }, [addInfraction, addLog, setLogs, setStats]);

  // Sync Forensic Queue Tactical Context
  useEffect(() => {
    forensicQueue.updateContext(directives, currentAuditPreset);
  }, [directives, currentAuditPreset]);

  const setPerformanceMetrics = useCallback((f: number, l: number) => {
    setFps(f);
    setLatency(l);
  }, []);

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

  const generateGeometry = useCallback(
    async (instruction?: string, videoElement?: HTMLVideoElement | null) => {
      const cacheKey = CacheService.generateKey(directives, instruction);
      const cached = CacheService.get<GeometryResponse>(cacheKey);

      if (cached && !videoElement) {
        logger.info('SENTINEL_CONTEXT', 'Recuperando geometría de caché local.');
        setGeometry(cached.lines);
        if (cached.suggestedDirectives) _setDirectives(cached.suggestedDirectives);
        return;
      }

      try {
        setStatusMsg('ANALIZANDO VÍA...');
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
          if (result.suggestedDirectives) _setDirectives(result.suggestedDirectives);
          if (!videoElement) CacheService.set(cacheKey, result);
        }
        setStatusMsg('GEOMETRÍA_SINCRONIZADA');
      } catch (error) {
        handleError('GEOMETRY', error);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [directives, aiGenerateGeometry, setStatusMsg, handleError]
  );

  const runAudit = useCallback(
    async (track: Track, line: GeometryLine) => {
      try {
        setIsAnalyzing(true);
        await aiRunAudit(track, line, directives, currentAuditPreset);
      } catch (error) {
        handleError('AUDIT', error);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [aiRunAudit, directives, currentAuditPreset, handleError]
  );

  const startScreenShare = useCallback(
    async (videoRef: React.RefObject<HTMLVideoElement | null>) => {
      addLog('CORE', 'Iniciando captura de pantalla/ventana para análisis de tráfico...');
      setStatusMsg('COMPARTIENDO...');
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setSource('live');
            setStatusMsg('STREAM_ACTIVO');
            addLog('CORE', 'Captura de pantalla sincronizada. Detectando flujo biónico...');

            // Auto-detect geometry for the shared window/application
            setTimeout(() => {
              generateGeometry(
                'Analiza esta ventana compartida de cámara de tráfico. Genera el PROTOCOLO DE SEGURIDAD ajustado a la perspectiva de esta cámara específica.',
                videoRef.current
              );
            }, 2000);
          };

          // Handle when user stops sharing via browser UI
          stream.getVideoTracks()[0].onended = () => {
            addLog('WARN', 'Captura de pantalla finalizada por el usuario.');
            setSource('none');
          };
        }
        return stream;
      } catch (e) {
        handleError('SCREEN_CAPTURE', e);
        throw e;
      }
    },
    [addLog, setStatusMsg, generateGeometry, handleError, setSource]
  );

  const startLiveFeed = useCallback(
    async (videoRef: React.RefObject<HTMLVideoElement | null>) => {
      // Per user request, "Señal en Vivo" now uses screen sharing to capture traffic cams
      return startScreenShare(videoRef);
    },
    [startScreenShare]
  );

  const loadVideo = useCallback(
    async (file: File, videoRef: React.RefObject<HTMLVideoElement | null>, keepConfig = false) => {
      if (!file || !videoRef.current) return;

      const video = videoRef.current;
      if (!keepConfig) {
        setStats({ det: 0, inf: 0 });
        setLogs([]);
        setGeometry([]);
        _setDirectives('');
        reportGenerationRef.current = false;
      }

      addLog('INFO', `Cargando video: "${file.name}"...`);
      setStatusMsg('CARGANDO_VIDEO...');

      const url = URL.createObjectURL(file);
      video.src = url;
      video.currentTime = 0;

      // H.265/HEVC Transcoding Logic
      const handleError = async () => {
        video.removeEventListener('error', handleError);
        const jobId = 'sentinel_' + Math.random().toString(36).substring(7);
        addLog('WARN', `Codec no soportado (H.265). Iniciando transcodificación...`);
        setStatusMsg('TRANSCODIFICANDO... (0%)');

        const pollInterval = setInterval(async () => {
          try {
            const pRes = await fetch(`/api/transcode/progress?id=${jobId}`);
            const pData = await pRes.json();
            if (pData.progress >= 0 && pData.progress < 100) {
              setStatusMsg(`TRANSCODIFICANDO... (${pData.progress}%)`);
            }
          } catch {
            // Progress polling is best-effort only.
          }
        }, 2000);

        try {
          const fileBuffer = await file.arrayBuffer();
          const response = await fetch(`/api/transcode?id=${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: fileBuffer,
          });
          clearInterval(pollInterval);
          if (!response.ok) throw new Error(`Transcode failed: ${response.statusText}`);

          const transcodedBlob = await response.blob();
          const transcodedUrl = URL.createObjectURL(transcodedBlob);
          URL.revokeObjectURL(url);
          video.src = transcodedUrl;
          video.onloadeddata = () => {
            addLog('SUCCESS', `Video transcodificado listo.`);
            setStatusMsg('CARGA_COMPLETA');
            if (keepConfig) setIsPlaying(true);
          };
        } catch (error) {
          clearInterval(pollInterval);
          addLog('ERROR', `Error en transcodificador: ${error}`);
          setStatusMsg('ERROR_CARGA');
        }
      };

      video.addEventListener('error', handleError, { once: true });
      video.onloadeddata = () => {
        video.removeEventListener('error', handleError);
        addLog('INFO', `Video "${file.name}" sincronizado.`);
        setStatusMsg('SISTEMA_LISTO');
        if (keepConfig) setIsPlaying(true);
      };

      setSource('upload');
    },
    [addLog, setStatusMsg, setSource, setIsPlaying, setStats, setLogs]
  );

  const onFileChange = useCallback(
    (file: File, videoRef: React.RefObject<HTMLVideoElement | null>) => {
      setVideoQueue([file]);
      setCurrentQueueIndex(0);
      setIsBatchMode(false);
      loadVideo(file, videoRef);
    },
    [loadVideo]
  );

  const onFilesChange = useCallback(
    (files: FileList, videoRef: React.RefObject<HTMLVideoElement | null>) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      setVideoQueue(fileList);
      setCurrentQueueIndex(0);
      setIsBatchMode(fileList.length > 1);
      loadVideo(fileList[0], videoRef);
    },
    [loadVideo]
  );

  const exportBatchReport = useCallback(async () => {
    if (logs.length === 0) {
      addLog('WARN', 'No hay infracciones para exportar.');
      return;
    }
    const filename = `Sentinel_Report_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    addLog('INFO', `Generando reporte CSV: ${filename}`);
    await ReportService.exportToCsv(logs, filename);
  }, [logs, addLog]);

  const finalizeVideoReport = useCallback(async () => {
    if (reportGenerationRef.current) return;
    reportGenerationRef.current = true;

    try {
      addLog('INFO', 'Esperando a que finalice la cola forense para consolidar denuncias...');
      await forensicQueue.waitForIdle();

      if (logsRef.current.length === 0) {
        addLog('WARN', 'El análisis finalizó sin infracciones confirmadas. No se genera PDF.');
        return;
      }

      const { filename, path } = await ReportService.generateAndSaveBatchPdf(logsRef.current);
      addLog('SUCCESS', `Informe PDF consolidado generado: ${filename}`);
      addLog('SUCCESS', `PDF guardado automáticamente en: ${path}`);
    } catch (error) {
      addLog(
        'ERROR',
        `No se pudo generar el informe consolidado: ${error instanceof Error ? error.message : String(error)}`
      );
      reportGenerationRef.current = false;
    }
  }, [addLog]);

  const loadNextInQueue = useCallback(async () => {
    if (currentQueueIndex < videoQueue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      const nextFile = videoQueue[nextIndex];
      await loadVideo(nextFile, videoRef, true); // keepConfig=true
      addLog(
        'INFO',
        `Iniciando análisis automático del video ${nextIndex + 1}/${videoQueue.length}`
      );
    } else {
      setIsBatchMode(false);
      await finalizeVideoReport();
      addLog('SUCCESS', 'Procesamiento por lotes finalizado.');
      setIsPlaying(false);
    }
  }, [currentQueueIndex, videoQueue, loadVideo, finalizeVideoReport, setIsPlaying, addLog]);

  const startIpFeed = useCallback(
    async (config: IpCameraConfig, videoRef: React.RefObject<HTMLVideoElement | null>) => {
      if (!videoRef.current) return;

      try {
        if (!isSupportedIpCameraUrl(config.url)) {
          throw new Error(
            'La cámara IP debe usar HTTP o HTTPS. RTSP directo no es reproducible de forma segura en el navegador.'
          );
        }

        setStatusMsg('CONECTANDO_IP...');
        addLog('CORE', `Conectando a cámara IP: ${sanitizeCameraUrlForLogs(config.url)}`);

        const { streamUrl } = await createIpCameraSession(config);

        videoRef.current.srcObject = null;
        videoRef.current.src = streamUrl;
        videoRef.current.onloadeddata = () => {
          addLog('SUCCESS', 'Conexión IP establecida. Transmisión activa.');
          setStatusMsg('SISTEMA_LISTO');
        };

        videoRef.current.onerror = () => {
          addLog('ERROR', 'Fallo en la recepción de la cámara IP. Verifique URL o credenciales.');
          setStatusMsg('ERROR_IP');
        };

        setSource('ip');
        setIsPlaying(true);
      } catch (error) {
        addLog(
          'ERROR',
          `Error al iniciar stream IP: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [addLog, setStatusMsg, setIsPlaying, setSource]
  );

  const parseMeshDirectives = useCallback(() => {
    const newLines: GeometryLine[] = [];

    // Manual Line Syntax Support: [LINE: Y=500, TYPE=lane_divider, LABEL=My Line]
    const lineRegex =
      /\[LINE:\s*Y=(\d+),\s*TYPE=(\w+),\s*LABEL=([^,\]]+)(?:,\s*INFRACTION=[^\]]+)?\]/gi;
    let match;
    while ((match = lineRegex.exec(directives)) !== null) {
      const y = parseInt(match[1]) / 1000;
      const typeValue = match[2].toLowerCase();
      const label = match[3].trim();
      const type: EntityType =
        typeValue === 'solid'
          ? 'lane_divider'
          : typeValue === 'roi' || typeValue === 'roi_general'
            ? 'roi_general'
            : typeValue === 'roi_turn'
              ? 'roi_turn'
              : (typeValue as EntityType);

      newLines.push({
        id: `sync_${Math.random().toString(36).substring(2, 11)}`,
        x1: 0.1,
        y1: y,
        x2: 0.9,
        y2: y,
        label: label,
        type: type,
      });
    }

    if (newLines.length > 0) {
      setGeometry((prev) => {
        // Remove older sync lines to prevent infinite stacking
        const filtered = prev.filter((l) => !l.id.startsWith('sync_'));
        const combined = [...filtered, ...newLines];
        return combined.slice(0, 20);
      });
    }
  }, [directives, setGeometry]);

  useEffect(() => {
    if (directives) {
      parseMeshDirectives();
      addLog('CORE', 'Unidad Forense: Protocolos de seguridad sincronizados y actualizados.');
      setStatusMsg('REGLAS ACTUALIZADAS');
      setTimeout(() => setStatusMsg(null), 1500);
    }
  }, [directives, addLog, setStatusMsg, parseMeshDirectives]);

  const systemStatus: SystemStatus = {
    neural: neuralStatus === 'ready' ? 'ready' : neuralStatus === 'error' ? 'error' : 'loading',
    forensic: hasApiKey ? 'ready' : 'error',
    bionics: source !== 'none' ? 'ready' : 'pending',
    vector: geometry.length > 0 ? 'ready' : 'pending',
    mediapipeReady,
  };

  useEffect(() => {
    const roiLines = geometry.filter((l) => l.type.startsWith('roi_'));
    let hasNewRoi = false;
    let updatedDirectives = directives;

    roiLines.forEach((roi) => {
      const roiTag = `[${roi.label}]`;
      if (!updatedDirectives.includes(roiTag)) {
        const desc =
          roi.type === 'roi_general'
            ? 'Vigilancia de Zona de Análisis General'
            : 'Análisis de Giro Prohibido (Secuencial)';
        updatedDirectives += `\n- ${roiTag}: ${desc}.`;
        hasNewRoi = true;
      }
    });

    if (hasNewRoi) {
      _setDirectives(updatedDirectives);
    }
  }, [geometry, directives]);

  // Memoize the context value so consumers only re-render when relevant slices change
  const value: SentinelContextType = useMemo(
    () => ({
      source,
      setSource,
      isPlaying,
      setIsPlaying,
      isMeshRenderEnabled,
      setIsMeshRenderEnabled,
      parseMeshDirectives,
      directives,
      setDirectives,
      geometry,
      setGeometry,
      videoRef,
      selectedLog,
      setSelectedLog,
      isListening,
      setIsListening,
      helpMsg,
      setHelpMsg,
      isPoseEnabled,
      setIsPoseEnabled,
      currentPreset,
      setPreset: setPresetAndConfig,
      engineConfig,
      stats,
      setStats,
      logs,
      systemLogs,
      statusMsg,
      setStatusMsg,
      isAnalyzing,
      systemStatus,
      statusLabel,
      hasApiKey,
      addLog,
      generateGeometry,
      runAudit,
      startLiveFeed,
      startScreenShare,
      onFileChange,
      onFilesChange,
      loadNextInQueue,
      videoQueue,
      currentQueueIndex,
      isBatchMode,
      addInfraction,
      exportBatchReport,
      finalizeVideoReport,
      detect,
      detectPose,
      startIpFeed,
      fps,
      latency,
      bufferStatus,
      setPerformanceMetrics,
      updateBufferStatus,
      clearLogs,
      tracks,
      setTracks,
      isAuditEnabled,
      setIsAuditEnabled,
      currentAuditPreset,
      setAuditPreset,
      currentKinematicPreset,
      setKinematicPreset,
      calibration,
      setCalibration,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      source, isPlaying, isMeshRenderEnabled, directives, geometry, selectedLog,
      isListening, helpMsg, isPoseEnabled, currentPreset, engineConfig, stats,
      logs, systemLogs, statusMsg, isAnalyzing, systemStatus, statusLabel,
      fps, latency, bufferStatus, tracks, isAuditEnabled, currentAuditPreset,
      currentKinematicPreset, calibration, videoQueue, currentQueueIndex, isBatchMode,
    ]
  );

  return <SentinelContext.Provider value={value}>{children}</SentinelContext.Provider>;
};
