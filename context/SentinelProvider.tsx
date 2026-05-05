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
import { getExpedientService } from '../services/ExpedientService';
import { getApiUrl } from '../services/apiConfig';
import { supabase } from '../services/supabase';
import { publishRealtimeEvent } from '../services/realtimeEvents';
import { detectVideoCodec } from '../services/videoCodecDetector';
import {
  createIpCameraSession,
  isSupportedIpCameraUrl,
  sanitizeCameraUrlForLogs,
} from '../services/ipCameraService';
import {
  canPlayHevcNatively,
} from '../services/hevcDirectPlayback';

import { SentinelContext, SentinelContextType } from './SentinelContext';

/**
 * Sentinel AI State Provider.
 */
export const SentinelProvider = ({
  children,
  viewerId,
}: {
  children: ReactNode;
  viewerId?: string;
  key?: React.Key;
}) => {
  const IS_ELECTRON =
    typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
  const AUTO_SERVER_TRANSCODE_FALLBACK = IS_ELECTRON;
  const expedientImagesPersistenceDisabledRef = useRef(false);
  useEffect(() => {
    try {
      const persisted = window.localStorage.getItem('sentinel_expedient_images_disabled');
      expedientImagesPersistenceDisabledRef.current = persisted === '1';
    } catch {
      expedientImagesPersistenceDisabledRef.current = false;
    }
  }, []);
  const [source, _setSource] = useState<'none' | 'live' | 'upload' | 'ip'>('none');
  const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
  const [isListening, setIsListening] = useState(false);
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
  const [analysisGridSize, _setAnalysisGridSize] = useState<1 | 2 | 3>(() => {
    const saved = Number(localStorage.getItem('sentinel_analysis_grid') || '1');
    return saved === 2 || saved === 3 ? saved : 1;
  });
  const [selectedProtocolIds, setSelectedProtocolIds] = useState<string[]>([]);

  const [bufferStatus, setBufferStatus] = useState<SentinelContextType['bufferStatus']>({
    state: 'idle',
    phase: 'standby',
    seconds: 0,
    activeTracks: 0,
    capturedPhotos: 0,
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
  const [helpMsg, setHelpMsg] = useState<string | null>(null);

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
    async (source: HTMLVideoElement | HTMLCanvasElement): Promise<StandardDetection[] | null> => {
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

  const setAnalysisGridSize = useCallback(
    (size: 1 | 2 | 3) => {
      _setAnalysisGridSize(size);
      addLog('CORE', `Modo de análisis en cuadrícula: ${size}x${size}`);
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
      addLog(
        'CORE',
        `Modo de operación cambiado a: ${DETECTION_PRESETS[preset].label.toUpperCase()}`
      );
    },
    [addLog]
  );

  const saveValidatedInfractionArtifacts = useCallback(
    async (log: InfractionLog) => {
      try {
        const { filename, path } = await ReportService.generateAndSaveInfractionPdf(log);

        if (log.videoClip) {
          try {
            const videoFilename = filename.replace('.pdf', '.mp4');
            const videoBase64 = log.videoClip.split(',')[1];
            const videoBuffer = Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0)).buffer;

            let dateStr;
            if (log.localTime) {
              const match = log.localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (match) {
                dateStr = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
              }
            }

            await ReportService.saveVideoToDisk(videoBuffer, videoFilename, dateStr);
            addLog('SUCCESS', `Evidencia de video guardada: ${videoFilename}`);
          } catch (videoError) {
            logger.error('SENTINEL_CONTEXT', 'Error saving validated video evidence', videoError);
            addLog('ERROR', 'No se pudo guardar la evidencia de video validada.');
          }
        }

        setLogs((prev) =>
          prev.map((entry) => (entry.id === log.id ? { ...entry, reportPath: path } : entry))
        );
        addLog('SUCCESS', `Expediente validado generado: ${filename}`);
        addLog('SUCCESS', `PDF validado guardado en: ${path}`);
      } catch (error) {
        addLog(
          'ERROR',
          `No se pudo generar el expediente validado: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [addLog, setLogs]
  );

  const addInfraction = useCallback(
    (log: InfractionLog) => {
      // Wait, I need to pass viewerId to addInfraction so it's recorded correctly.
      // And the forensic queue needs to only process callbacks if they belong to this viewerId!
      // But `forensicQueue.setCallback` overwrites the global callback!
      // To support multiple viewers, we should use `forensicQueue.addEventListener` or check viewerId.
      // For now, let's keep it simple.
      // In a true multi-viewer setup, ForensicQueue needs an Event Emitter architecture.

      const infractionWithViewer = { ...log, viewerId };

      // Use video OSD timestamp if available, otherwise use system time
      const videoTimestamp = infractionWithViewer.videoTimeCode || infractionWithViewer.visualTimestamp;
      const infraredTimestamp = videoTimestamp || new Date().toISOString();

      console.log('[ADD_INFRACTION] Called with:', {
        id: infractionWithViewer.id,
        plate: infractionWithViewer.plate,
        ruleCategory: infractionWithViewer.ruleCategory,
        timestamp: infraredTimestamp,
        videoTimeCode: infractionWithViewer.videoTimeCode,
      });
      setLogs((prev) => {
        console.log('[ADD_INFRACTION] Adding to logs. Previous count:', prev.length, ', New count:', prev.length + 1);
        return [infractionWithViewer, ...prev];
      });
      setStats((prev) => ({ ...prev, inf: prev.inf + 1 }));
      const livePhotos =
        1 +
        (infractionWithViewer.extraSnapshots?.length || 0) +
        (infractionWithViewer.zoomSnapshots?.length || 0);
      updateBufferStatus({
        capturedPhotos: livePhotos,
        plateCandidate:
          infractionWithViewer.plateOcr ||
          (infractionWithViewer.plate && infractionWithViewer.plate !== 'UNKNOWN'
            ? infractionWithViewer.plate
            : undefined),
      });
      logger.ai(
        'SENTINEL_CONTEXT',
        `[${viewerId || 'GLOBAL'}] Sanción Detectada: ${log.plate || 'SIN_PLACA'} - ${log.description}`
      );
      addLog('AI', `Sanción Detectada: ${log.plate || 'SIN_PLACA'} - ${log.description}`);

      // Sync infraction to backend cache (so FORENSE module can access it without RLS issues)
      (async () => {
        try {
          const syncResponse = await fetch('http://localhost:3002/api/infractions/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: infractionWithViewer.id,
              plate: infractionWithViewer.plate,
              make_model: infractionWithViewer.makeModel,
              color: infractionWithViewer.color,
              description: infractionWithViewer.description,
              severity: infractionWithViewer.severity,
              rule_category: infractionWithViewer.ruleCategory,
              legal_base: infractionWithViewer.legalBase,
              image_url: infractionWithViewer.image,
              extra_snapshots: infractionWithViewer.extraSnapshots,
              zoom_snapshots: infractionWithViewer.zoomSnapshots,
              video_clip_url: infractionWithViewer.videoClip,
              created_at: new Date().toISOString(),
            }),
          });
          if (syncResponse.ok) {
            console.log('[INFRACTION_SYNC] ✓ Synced to backend cache:', infractionWithViewer.id);
          } else {
            console.warn('[INFRACTION_SYNC] ✗ Failed to sync to backend:', await syncResponse.text());
          }
        } catch (syncErr) {
          console.warn('[INFRACTION_SYNC] ✗ Error syncing to backend:', syncErr);
        }
      })();
      void publishRealtimeEvent(
        'infraction_confirmed',
        {
          infractionId: log.id,
          plate: log.plate || null,
          severity: log.severity || null,
          ruleCategory: log.ruleCategory || null,
          ts: Date.now(),
        },
        { viewerId: viewerId || undefined }
      );

      (async () => {
        try {
          const toImageUrl = (value: string): string => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            if (
              raw.startsWith('data:') ||
              raw.startsWith('http://') ||
              raw.startsWith('https://') ||
              raw.startsWith('blob:')
            ) {
              return raw;
            }
            return `data:image/jpeg;base64,${raw}`;
          };

          const persistExpedientImages = async (expedientId: string, infraction: InfractionLog) => {
            if (expedientImagesPersistenceDisabledRef.current) return;
            const main = infraction.image ? [infraction.image] : [];
            const general = Array.isArray(infraction.extraSnapshots)
              ? infraction.extraSnapshots
              : [];
            const detail = Array.isArray(infraction.zoomSnapshots) ? infraction.zoomSnapshots : [];
            const allRows = [
              ...main.map((img) => ({ kind: 'OTRA', image_url: toImageUrl(img) })),
              ...general.map((img) => ({ kind: 'GENERAL', image_url: toImageUrl(img) })),
              ...detail.map((img) => ({ kind: 'DETALLE', image_url: toImageUrl(img) })),
            ].filter((r) => !!r.image_url);

            if (!allRows.length) return;

            // Replace current gallery with latest complete set for this expedient
            await supabase.from('expedient_images').delete().eq('expedient_id', expedientId);
            const payload = allRows.map((row) => ({
              expedient_id: expedientId,
              kind: row.kind,
              image_url: row.image_url,
            }));
            const { error } = await supabase.from('expedient_images').insert(payload as any);
            if (error) {
              const message = String(error.message || '');
              const code = String((error as any).code || '');
              if (
                code === '42501' ||
                message.includes('row-level security') ||
                message.includes('permission')
              ) {
                expedientImagesPersistenceDisabledRef.current = true;
                try {
                  window.localStorage.setItem('sentinel_expedient_images_disabled', '1');
                } catch {
                  // ignore
                }
                console.warn(
                  '[EXPEDIENT_IMAGES] Persist disabled for current session due to RLS/policy.'
                );
                return;
              }
              if (
                code === '23503' ||
                message.includes('foreign key') ||
                message.includes('violates foreign key constraint')
              ) {
                expedientImagesPersistenceDisabledRef.current = true;
                try {
                  window.localStorage.setItem('sentinel_expedient_images_disabled', '1');
                } catch {
                  // ignore
                }
                console.warn(
                  '[EXPEDIENT_IMAGES] Persist disabled for current session due to FK mismatch.'
                );
                return;
              }
              console.warn('[EXPEDIENT_IMAGES] Persist failed:', error.message);
            } else {
              console.log(`[EXPEDIENT_IMAGES] Stored ${payload.length} images for ${expedientId}`);
            }
          };

          await evidenceDB.saveInfraction(infractionWithViewer);

          // Guardar evidencia en Storage + URLs en tabla evidence
          const saveEvidenceToSupabase = async (expedientId: string, infraction: InfractionLog) => {
            try {
              const { SupabaseStorageService } = await import('../services/SupabaseStorageService');
              const evidenceInserts = [];

              // Guardar imagen principal
              if (infraction.image) {
                const uploadResult = await SupabaseStorageService.uploadImage(
                  infraction.image,
                  expedientId,
                  'ORIGINAL',
                  'FULL'
                );
                if (uploadResult.success && uploadResult.url) {
                  evidenceInserts.push({
                    expedient_id: expedientId,
                    infraction_id: String(infraction.id),
                    kind: 'ORIGINAL',
                    image_url: uploadResult.url,
                    storage_path: uploadResult.path,
                    description: 'Imagen principal de la infracción',
                    capture_type: 'FULL',
                    file_size_bytes: uploadResult.size || 0,
                    content_type: 'image/jpeg',
                    captured_at: new Date().toISOString(),
                  });
                }
              }

              // Guardar snapshots generales
              if (infraction.extraSnapshots && infraction.extraSnapshots.length > 0) {
                for (let idx = 0; idx < infraction.extraSnapshots.length; idx++) {
                  const snap = infraction.extraSnapshots[idx];
                  const captureType = idx === 0 ? 'INITIAL' : idx === Math.floor(infraction.extraSnapshots.length / 2) ? 'MID' : 'FINAL';
                  const uploadResult = await SupabaseStorageService.uploadImage(
                    snap,
                    expedientId,
                    'GENERAL',
                    captureType
                  );
                  if (uploadResult.success && uploadResult.url) {
                    evidenceInserts.push({
                      expedient_id: expedientId,
                      infraction_id: String(infraction.id),
                      kind: 'GENERAL',
                      image_url: uploadResult.url,
                      storage_path: uploadResult.path,
                      description: `Snapshot de contexto ${captureType}`,
                      capture_type: captureType,
                      file_size_bytes: uploadResult.size || 0,
                      content_type: 'image/jpeg',
                      captured_at: new Date().toISOString(),
                    });
                  }
                }
              }

              // Guardar snapshots zoom
              if (infraction.zoomSnapshots && infraction.zoomSnapshots.length > 0) {
                for (let idx = 0; idx < infraction.zoomSnapshots.length; idx++) {
                  const snap = infraction.zoomSnapshots[idx];
                  const captureType = idx === 0 ? 'INITIAL' : idx === Math.floor(infraction.zoomSnapshots.length / 2) ? 'MID' : 'FINAL';
                  const uploadResult = await SupabaseStorageService.uploadImage(
                    snap,
                    expedientId,
                    'DETALLE',
                    captureType
                  );
                  if (uploadResult.success && uploadResult.url) {
                    evidenceInserts.push({
                      expedient_id: expedientId,
                      infraction_id: String(infraction.id),
                      kind: 'DETALLE',
                      image_url: uploadResult.url,
                      storage_path: uploadResult.path,
                      description: `Snapshot zoom ${captureType}`,
                      capture_type: captureType,
                      file_size_bytes: uploadResult.size || 0,
                      content_type: 'image/jpeg',
                      captured_at: new Date().toISOString(),
                    });
                  }
                }
              }

              // Guardar video
              if (infraction.videoClip) {
                const uploadResult = await SupabaseStorageService.uploadVideo(
                  infraction.videoClip,
                  expedientId,
                  'FULL'
                );
                if (uploadResult.success && uploadResult.url) {
                  evidenceInserts.push({
                    expedient_id: expedientId,
                    infraction_id: String(infraction.id),
                    kind: 'VIDEO',
                    image_url: uploadResult.url,
                    storage_path: uploadResult.path,
                    description: 'Video clip de 8 segundos',
                    capture_type: 'FULL',
                    file_size_bytes: uploadResult.size || 0,
                    content_type: 'video/mp4',
                    captured_at: new Date().toISOString(),
                  });
                }
              }

              if (evidenceInserts.length > 0) {
                const { error } = await supabase.from('evidence').insert(evidenceInserts as any);
                if (error) {
                  console.warn('[EVIDENCE] Failed to save evidence:', error.message);
                } else {
                  console.log(`[EVIDENCE] Saved ${evidenceInserts.length} evidence items for ${expedientId}`);
                }
              }
            } catch (error) {
              console.warn('[EVIDENCE] Error saving evidence:', error);
            }
          };

          const rule =
            `${infractionWithViewer.operativeCode || ''} ${infractionWithViewer.ruleCategory || ''}`.toUpperCase();
          const violationType = rule.includes('GIRO')
            ? 'FORBIDDEN_TURN'
            : rule.includes('STOP')
              ? 'STOP'
              : 'OTHER';
          const expedientService = getExpedientService();
          console.log('[EXPEDIENT] Creating from infraction:', {
            infractionId: infractionWithViewer.id,
            plate: infractionWithViewer.plate,
            violationType,
          });

          let expedient;
          let createError: unknown = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              // Use video OSD timestamp for expedient (when infraction actually occurred)
              const videoTimestamp = infractionWithViewer.videoTimeCode || infractionWithViewer.visualTimestamp;
              const expedientTimestamp = videoTimestamp
                ? new Date(videoTimestamp).getTime()
                : (infractionWithViewer.validatedAt || Date.now());

              expedient = await expedientService.createExpedient({
                infractionId: String(infractionWithViewer.id),
                violationType,
                location: 'Daganzo de Arriba',
                timestamp: expedientTimestamp,
                evidenceId: String(infractionWithViewer.id),
                licensePlate:
                  infractionWithViewer.plate || infractionWithViewer.plateOcr || 'DESCONOCIDO',
              });
              createError = null;
              break;
            } catch (err) {
              createError = err;
              if (attempt < 3) {
                await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
              }
            }
          }
          if (!expedient) {
            throw createError || new Error('No se pudo crear expediente tras reintentos');
          }

          console.log('[EXPEDIENT] Created successfully:', expedient.id);

          // Copiar TODA la información del PREINFORME DE REVISIÓN IA
          expedient.makeModel = infractionWithViewer.makeModel || '';
          expedient.vehicleDescription = infractionWithViewer.makeModel || '';
          expedient.color = infractionWithViewer.color || '';
          expedient.description = infractionWithViewer.description || '';
          expedient.descripcionDetalladaHechos = infractionWithViewer.description || '';
          expedient.severity = infractionWithViewer.severity || 'MEDIUM';
          expedient.gravedad =
            infractionWithViewer.severity === 'CRITICAL'
              ? 'Muy Grave'
              : infractionWithViewer.severity === 'LOW'
                ? 'Leve'
                : 'Grave';
          expedient.ruleCategory = infractionWithViewer.ruleCategory || '';
          expedient.legalBase = infractionWithViewer.legalBase || '';
          expedient.reasoning = infractionWithViewer.reasoning || [];
          expedient.videoTimeCode = infractionWithViewer.videoTimeCode || '';
          expedient.visualTimestamp = infractionWithViewer.visualTimestamp || '';
          expedient.ocrResults = infractionWithViewer.ocrResults || [];
          expedient.plateOcr = infractionWithViewer.plateOcr || '';
          expedient.plateOcrCandidates = infractionWithViewer.plateOcrCandidates || [];
          expedient.validationStatus = infractionWithViewer.validationStatus || 'pending';
          expedient.playbackTime = infractionWithViewer.playbackTime;
          expedient.videoClip = infractionWithViewer.videoClip;
          expedient.telemetrySpeedEstimated = infractionWithViewer.telemetry?.speedEstimated || '';
          expedient.telemetryBehaviorAnomalies =
            infractionWithViewer.telemetry?.behaviorAnomalies || '';
          expedient.operativeCode = infractionWithViewer.operativeCode || '';
          expedient.priority = infractionWithViewer.priority;
          expedient.priorityLevel = infractionWithViewer.priorityLevel;
          expedient.fineAmount = infractionWithViewer.fineAmount;
          expedient.pointsDeducted = infractionWithViewer.pointsDeducted;
          expedient.image = infractionWithViewer.image;
          expedient.extraSnapshots = infractionWithViewer.extraSnapshots;
          expedient.zoomSnapshots = infractionWithViewer.zoomSnapshots;
          expedient.photosCount =
            1 +
            (infractionWithViewer.extraSnapshots?.length || 0) +
            (infractionWithViewer.zoomSnapshots?.length || 0);
          await expedientService.updateExpedient(expedient);
          await persistExpedientImages(expedient.id, infractionWithViewer);
          await saveEvidenceToSupabase(expedient.id, infractionWithViewer);
          console.log('[EXPEDIENT] Updated successfully:', expedient.id);

          // Sync expedient to backend cache (so FORENSE module can access it without RLS issues)
          try {
            const syncResponse = await fetch('http://localhost:3002/api/expedients/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: expedient.id,
                state: expedient.state || 'DETECTED',
                created_at: expedient.createdAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                infraction_id: expedient.infractionId,
                license_plate: expedient.licensePlate,
                violation_type: expedient.violationType,
                location: expedient.location,
                timestamp: expedient.timestamp,
              }),
            });
            if (syncResponse.ok) {
              console.log('[EXPEDIENT_SYNC] ✓ Synced to backend cache:', expedient.id);
            } else {
              console.warn('[EXPEDIENT_SYNC] ✗ Failed to sync to backend:', await syncResponse.text());
            }
          } catch (syncErr) {
            console.warn('[EXPEDIENT_SYNC] ✗ Error syncing to backend:', syncErr);
          }

          addLog('INFO', `Expediente #${expedient.id} creado desde infracción #${log.id}`);
        } catch (error) {
          addLog(
            'ERROR',
            `No se pudo guardar el preinforme: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })();
    },
    [addLog, setLogs, setStats, updateBufferStatus, viewerId]
  );

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Bind ForensicQueue to the infraction logging system
  useEffect(() => {
    const handleInfraction = (log: InfractionLog) => {
      // Only process if the infraction belongs to this viewer, or if neither has viewerId (fallback)
      if (log.viewerId && viewerId && log.viewerId !== viewerId) return;
      addInfraction(log);
    };

    forensicQueue.addListener(handleInfraction);
    forensicQueue.setEventCallback((event) => {
      // Broadcast events are harder to filter, but we do our best
      if (event.jobId && viewerId) {
        // If we wanted strict filtering we'd need to know which job belongs to which viewer
      }
      if (event.type === 'queue_overflow' || event.type === 'retry') {
        addLog('WARN', event.message);
      } else {
        addLog('ERROR', event.message);
      }
    });

    // Initial cleanup of old evidence
    evidenceDB.purgeOldEvidence();

    const purgeInterval = window.setInterval(
      () => {
        evidenceDB.purgeOldEvidence();
      },
      60 * 60 * 1000
    );

    return () => {
      window.clearInterval(purgeInterval);
      forensicQueue.removeListener(handleInfraction);
      forensicQueue.setEventCallback(undefined);
    };
  }, [addInfraction, addLog, setLogs, setStats, viewerId]);

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
    localStorage.setItem('sentinel_geometry', JSON.stringify(geometry));
    localStorage.setItem('sentinel_preset', currentPreset);
    localStorage.setItem('sentinel_calibration', calibration.toString());
    localStorage.setItem('sentinel_analysis_grid', analysisGridSize.toString());
  }, [directives, geometry, currentPreset, calibration, analysisGridSize]);

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
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getDisplayMedia !== 'function'
        ) {
          const notSupportedError = new DOMException(
            'Screen capture API is not available in this environment',
            'NotSupportedError'
          );
          handleError('SCREEN_CAPTURE', notSupportedError);
          return undefined;
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false,
        });

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;

          // Handle both loadeddata and playing events
          const onVideoReady = () => {
            addLog(
              'CORE',
              `Video ready - readyState: ${video.readyState}, playing: ${!video.paused}`
            );
            setSource('live');
            setStatusMsg('STREAM_ACTIVO');
            addLog('CORE', 'Captura de pantalla sincronizada. Señal en vivo lista.');
            setIsPlaying(true); // Activate detection automatically for live streams
            setStats({ det: 0, inf: 0 }); // Reset stats for new stream
            setLogs([]); // Clear logs for new stream

            // Remove listeners to avoid duplicate calls
            video.removeEventListener('loadeddata', onVideoReady);
            video.removeEventListener('playing', onVideoReady);
          };

          // Listen for loadeddata or playing events
          video.addEventListener('loadeddata', onVideoReady);
          video.addEventListener('playing', onVideoReady);

          // Set onloadedmetadata as backup
          video.onloadedmetadata = () => {
            addLog('CORE', 'Video metadata loaded');
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch((err: Error) => {
                addLog('ERROR', `Error al reproducir: ${err.message}`);
              });
            }
          };

          // Try playing immediately
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                addLog('CORE', 'Video comenzó a reproducir');
              })
              .catch((err: Error) => {
                addLog('WARN', `Autoplay falló: ${err.message}`);
              });
          }

          // Handle when user stops sharing via browser UI
          stream.getVideoTracks()[0].onended = () => {
            addLog('WARN', 'Captura de pantalla finalizada por el usuario.');
            setSource('none');
            video.removeEventListener('loadeddata', onVideoReady);
            video.removeEventListener('playing', onVideoReady);
          };
        }
        return stream;
      } catch (e) {
        handleError('SCREEN_CAPTURE', e);
        return undefined;
      }
    },
    [addLog, setStatusMsg, handleError, setSource]
  );

  const startLiveFeed = useCallback(
    async (videoRef: React.RefObject<HTMLVideoElement | null>) => {
      // Per user request, "Señal en Vivo" now uses screen sharing to capture traffic cams
      return startScreenShare(videoRef);
    },
    [startScreenShare]
  );

  const stopScreenShare = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const stream = video.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    video.srcObject = null;
    setIsPlaying(false);
    setSource('none');
    setStatusMsg('CAPTURA_FINALIZADA');
    addLog('CORE', 'Captura de pantalla detenida por el operador.');
  }, [addLog, setIsPlaying, setSource, setStatusMsg]);

  const formatEstimatedTime = (seconds: number): string => {
    if (seconds < 0 || !Number.isFinite(seconds)) return '?';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const transcodeVideo = async (
    file: File,
    video: HTMLVideoElement,
    url: string,
    autoPlay: boolean
  ) => {
    const jobId = 'sentinel_' + Math.random().toString(36).substring(7);
    addLog('WARN', `Iniciando transcodificación a H.264 con aceleración GPU...`);
    setStatusMsg('TRANSCODIFICANDO... (0%)');

    const startTime = Date.now();
    let lastProgress = 0;
    let lastProgressTime = startTime;

    const pollInterval = setInterval(async () => {
      try {
        const progressUrl = getApiUrl(`/api/transcode/progress?id=${jobId}`);
        const pRes = await fetch(progressUrl);
        const pData = await pRes.json();
        if (pData.progress >= 0 && pData.progress < 100) {
          const currentTime = Date.now();
          const timePassed = (currentTime - startTime) / 1000; // seconds
          const progressDelta = pData.progress - lastProgress;
          const timeDelta = (currentTime - lastProgressTime) / 1000; // seconds

          let estimatedTotal = '?';
          if (progressDelta > 0 && timeDelta > 0) {
            const secondsPerPercent = timeDelta / progressDelta;
            const remainingSeconds = secondsPerPercent * (100 - pData.progress);
            estimatedTotal = formatEstimatedTime(remainingSeconds);
          }

          lastProgress = pData.progress;
          lastProgressTime = currentTime;

          setStatusMsg(`TRANSCODIFICANDO... (${pData.progress}%) - ETA: ${estimatedTotal}`);
        }
      } catch {
        // Progress polling is best-effort only.
      }
    }, 2000);

    try {
      const fileBuffer = await file.arrayBuffer();
      const transcodeUrl = getApiUrl(`/api/transcode?id=${jobId}`);
      const response = await fetch(transcodeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: fileBuffer,
      });
      clearInterval(pollInterval);
      if (!response.ok) throw new Error(`Transcode failed: ${response.statusText}`);

      const transcodedBlob = await response.blob();
      const transcodedUrl = URL.createObjectURL(transcodedBlob);
      URL.revokeObjectURL(url);

      // Reset media element pipeline before attaching the transcoded source.
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.currentTime = 0;
      video.srcObject = null;
      video.src = transcodedUrl;
      video.load();

      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('El video transcodificado no pudo cargarse en el reproductor.'));
        };
        const cleanup = () => {
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('canplay', onReady);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      addLog('SUCCESS', `Video transcodificado listo (H.264 compatible).`);
      setStatusMsg('CARGA_COMPLETA');
      if (autoPlay) {
        setIsPlaying(true);
        void video.play().catch((err) => {
          addLog(
            'WARN',
            `Autoplay del transcodificado bloqueado/interrumpido: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      } else {
        setIsPlaying(false);
      }
    } catch (error) {
      clearInterval(pollInterval);
      addLog('ERROR', `Error en transcodificador: ${error}`);
      setStatusMsg('ERROR_CARGA');
    }
  };

  const remuxCopyVideo = async (file: File): Promise<Blob | null> => {
    try {
      const fileBuffer = await file.arrayBuffer();
      const remuxUrl = getApiUrl('/api/remux-copy');
      const response = await fetch(remuxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: fileBuffer,
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      return blob.size > 0 ? blob : null;
    } catch {
      return null;
    }
  };

  const loadVideo = useCallback(
    async (
      file: File,
      videoRef: React.RefObject<HTMLVideoElement | null>,
      keepConfig = false,
      autoPlay = true
    ) => {
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
      setIsPlaying(false);

      const url = URL.createObjectURL(file);
      const setVideoSourceAndWait = async (sourceUrl: string): Promise<void> => {
        video.pause();
        video.srcObject = null;
        video.removeAttribute('src');
        video.currentTime = 0;
        video.src = sourceUrl;
        video.load();
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('VIDEO_LOAD_FAILED'));
          };
          const cleanup = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            video.removeEventListener('error', onError);
          };
          video.addEventListener('loadeddata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
          video.addEventListener('error', onError, { once: true });
        });
      };

      const detectedCodec = await detectVideoCodec(file);
      const isLikelyHevc = detectedCodec === 'hevc';
      const hevcSupported = canPlayHevcNatively();

      if (isLikelyHevc && hevcSupported) {
        addLog('INFO', 'HEVC detectado. Reproducción directa sin transcodificar.');
      } else if (isLikelyHevc && !hevcSupported) {
        addLog('INFO', 'HEVC detectado. Intentando reproducción directa y puente WASM.');
      } else {
        addLog('INFO', `Codec detectado: ${detectedCodec}. Reproducción directa prioritaria.`);
      }

      try {
        await setVideoSourceAndWait(url);
      } catch {
        if (IS_ELECTRON) {
          addLog('WARN', 'Electron: intentando remux sin pérdida antes del puente WASM...');
          const remuxBlob = await remuxCopyVideo(file);
          if (remuxBlob) {
            const remuxUrl = URL.createObjectURL(remuxBlob);
            try {
              await setVideoSourceAndWait(remuxUrl);
              addLog('SUCCESS', 'Video cargado tras remux sin pérdida (copy stream).');
              video.onloadeddata = () => {
                addLog('INFO', `Video "${file.name}" sincronizado.`);
                setStatusMsg('SISTEMA_LISTO');
                if (autoPlay) setIsPlaying(true);
              };
              setSource('upload');
              return;
            } catch {
              URL.revokeObjectURL(remuxUrl);
            }
          }
        }
        if (isLikelyHevc && !hevcSupported) {
          addLog('WARN', 'HEVC no soportado nativamente. Intentando puente ffmpeg.wasm...');
          const { tryHevcWasmBridge } = await import('../services/hevcWasmBridge');
          const wasmBlob = await tryHevcWasmBridge(file);
          if (wasmBlob) {
            const wasmUrl = URL.createObjectURL(wasmBlob);
            try {
              await setVideoSourceAndWait(wasmUrl);
              addLog('SUCCESS', 'HEVC cargado vía WASM sin transcodificación de servidor.');
            } catch {
              URL.revokeObjectURL(wasmUrl);
              if (AUTO_SERVER_TRANSCODE_FALLBACK) {
                addLog('WARN', 'Puente WASM falló. Iniciando transcodificación con GPU.');
                await transcodeVideo(file, video, url, autoPlay);
              } else {
                addLog(
                  'ERROR',
                  'No fue posible reproducir HEVC sin transcodificar en este entorno (directo + WASM).'
                );
                setStatusMsg('ERROR_CARGA');
              }
              return;
            }
          } else {
            if (AUTO_SERVER_TRANSCODE_FALLBACK) {
              addLog('WARN', 'Puente WASM no disponible. Iniciando transcodificación con GPU.');
              await transcodeVideo(file, video, url, autoPlay);
            } else {
              addLog(
                'ERROR',
                'Puente WASM no disponible y transcodificación automática desactivada.'
              );
              setStatusMsg('ERROR_CARGA');
            }
            return;
          }
        } else if (
          detectedCodec === 'unknown' &&
          (file.name.toLowerCase().endsWith('.mp4') ||
            file.name.toLowerCase().endsWith('.mov') ||
            file.name.toLowerCase().endsWith('.mkv'))
        ) {
          addLog('WARN', 'Codec unknown. Intentando puente WASM antes de transcodificar...');
          const { tryHevcWasmBridge } = await import('../services/hevcWasmBridge');
          const wasmBlob = await tryHevcWasmBridge(file);
          if (wasmBlob) {
            const wasmUrl = URL.createObjectURL(wasmBlob);
            try {
              await setVideoSourceAndWait(wasmUrl);
              addLog('SUCCESS', 'Video cargado vía WASM sin transcodificación de servidor.');
            } catch {
              URL.revokeObjectURL(wasmUrl);
              if (AUTO_SERVER_TRANSCODE_FALLBACK) {
                addLog('WARN', 'Puente WASM falló. Iniciando transcodificación con GPU.');
                await transcodeVideo(file, video, url, autoPlay);
              } else {
                addLog(
                  'ERROR',
                  'No fue posible reproducir el archivo sin transcodificar en este entorno.'
                );
                setStatusMsg('ERROR_CARGA');
              }
              return;
            }
          } else {
            if (AUTO_SERVER_TRANSCODE_FALLBACK) {
              addLog('WARN', 'Puente WASM no disponible. Iniciando transcodificación con GPU.');
              await transcodeVideo(file, video, url, autoPlay);
            } else {
              addLog(
                'ERROR',
                'Puente WASM no disponible y transcodificación automática desactivada.'
              );
              setStatusMsg('ERROR_CARGA');
            }
            return;
          }
        } else {
          if (AUTO_SERVER_TRANSCODE_FALLBACK) {
            addLog('WARN', 'Fallo de reproducción. Iniciando transcodificación con GPU...');
            await transcodeVideo(file, video, url, autoPlay);
          } else {
            addLog(
              'ERROR',
              'Fallo de reproducción nativa y transcodificación automática desactivada.'
            );
            setStatusMsg('ERROR_CARGA');
          }
          return;
        }
      }

      video.onloadeddata = () => {
        addLog('INFO', `Video "${file.name}" sincronizado.`);
        setStatusMsg('SISTEMA_LISTO');
        if (autoPlay) setIsPlaying(true);
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

      const validatedLogs = logsRef.current.filter((log) => log.validationStatus === 'validated');

      if (validatedLogs.length === 0) {
        addLog(
          'WARN',
          'El análisis finalizó sin infracciones validadas por operador. No se genera PDF.'
        );
        return;
      }

      const { filename, path } = await ReportService.generateAndSaveBatchPdf(validatedLogs);
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
    // Wait for current forensic audits to finish before moving to next video
    // This ensures we don't overlap heavy AI analysis between videos
    addLog('INFO', 'Finalizando peritajes del video actual antes de proceder...');
    await forensicQueue.waitForIdle();

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

  const systemStatus: SystemStatus = useMemo(
    () => ({
      neural: neuralStatus === 'ready' ? 'ready' : neuralStatus === 'error' ? 'error' : 'loading',
      forensic: hasApiKey ? 'ready' : 'error',
      bionics: source !== 'none' ? 'ready' : 'pending',
      vector: geometry.length > 0 ? 'ready' : 'pending',
      mediapipeReady,
      ocrAutoPipeline: true,
      ocrImageEnhancement: true,
      ocrPlateCropFallback: true,
      ocrGeminiConfirmation: true,
    }),
    [neuralStatus, hasApiKey, source, geometry.length, mediapipeReady]
  );

  useEffect(() => {
    void publishRealtimeEvent(
      'engine_status',
      {
        statusLabel,
        systemStatus,
        source,
        isPlaying,
        ts: Date.now(),
      },
      { viewerId: viewerId || undefined }
    );
  }, [statusLabel, systemStatus, source, isPlaying, viewerId]);

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

  const validateInfraction = useCallback(
    (id: number, status: 'validated' | 'rejected') => {
      const existing = logsRef.current.find((log) => log.id === id);
      if (!existing) {
        addLog('WARN', `No se encontró la infracción #${id} para validar.`);
        return;
      }

      const updated = { ...existing, validationStatus: status, validatedAt: Date.now() };

      setLogs((prev) =>
        status === 'rejected'
          ? prev.filter((log) => log.id !== id)
          : prev.map((log) => (log.id === id ? updated : log))
      );

      void evidenceDB.saveInfraction(updated);
      addLog(
        status === 'validated' ? 'SUCCESS' : 'WARN',
        `Infracción #${id} marcada como ${status.toUpperCase()} por el operador.`
      );

      if (status === 'validated') {
        void saveValidatedInfractionArtifacts(updated);
      }
    },

    [setLogs, addLog, saveValidatedInfractionArtifacts]
  );

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
      helpMsg,
      setHelpMsg,
      addLog,
      generateGeometry,
      runAudit,
      startLiveFeed,
      startScreenShare,
      stopScreenShare,
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
      validateInfraction,
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
      analysisGridSize,
      setAnalysisGridSize,
      viewerId,
      selectedProtocolIds,
      setSelectedProtocolIds,
    }),
    [
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
      selectedLog,
      isListening,
      isPoseEnabled,
      setIsPoseEnabled,
      currentPreset,
      setPresetAndConfig,
      engineConfig,
      stats,
      setStats,
      logs,
      systemLogs,
      statusMsg,
      setStatusMsg,
      helpMsg,
      setHelpMsg,
      isAnalyzing,
      systemStatus,
      statusLabel,
      hasApiKey,
      addLog,
      generateGeometry,
      runAudit,
      startLiveFeed,
      startScreenShare,
      stopScreenShare,
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
      validateInfraction,
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
      analysisGridSize,
      setAnalysisGridSize,
      viewerId,
      selectedProtocolIds,
      setSelectedProtocolIds,
    ]
  );

  return <SentinelContext.Provider value={value}>{children}</SentinelContext.Provider>;
};
