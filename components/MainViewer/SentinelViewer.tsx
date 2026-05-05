import React, { memo, useRef, useEffect, useCallback } from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { useFrameProcessor } from '../../hooks/useFrameProcessor';
import { renderScene } from '../renderSystem';
import { EmptyState } from './EmptyState';
import { NeuralStatusHUD } from './NeuralStatusHUD';
import { ForensicAnalysisOverlay } from './ForensicAnalysisOverlay';
import { GeometryEditor } from './GeometryEditor';
import { SystemAlertHUD } from './SystemAlertHUD';
import { IpCameraModal } from '../IpCameraModal';
import { HEVCVideo } from './HEVCVideo';
import { useLayoutStore } from '../../stores/layoutStore';
import { useFocusedViewerStore } from '../../stores/focusedViewerStore';
import { getApiUrl } from '../../services/apiConfig';
import { getOCRService, type PlateDetectionRegion } from '../../services/OCRService';
import { useHelp } from '../../hooks/useHelp';

const escudo = '/ESCUDO.png?v=11';

export const SentinelViewer = memo(({ viewerId }: { viewerId: string }) => {
  const {
    source,
    isAnalyzing,
    isPlaying,
    geometry,
    isMeshRenderEnabled,
    videoRef,
    addLog,
    onFilesChange: contextOnFilesChange,
    startScreenShare: contextStartScreenShare,
    stopScreenShare: contextStopScreenShare,
    clearLogs,
    setIsPlaying,
    isBatchMode,
    loadNextInQueue,
    finalizeVideoReport,
    logs,
    updateBufferStatus,
  } = useSentinel();

  const { processFrame, trackerRef, resetTracker } = useFrameProcessor();
  const { helpProps } = useHelp();
  const { gridSize, focusedViewerId, showDetections, showROIs } = useLayoutStore();
  const { update: updateFocusedViewer } = useFocusedViewerStore();
  const compact = gridSize >= 2;
  const mini = gridSize >= 3;
  const isFocused = viewerId === focusedViewerId;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingFrameRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastBackgroundTickRef = useRef(0);
  const [showIpModal, setShowIpModal] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState<number>(16 / 9);
  const [zoom, setZoom] = React.useState(1);
  const [playbackRate, setPlaybackRate] = React.useState<1 | 2 | 4 | 8>(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [pausedFrameBase64, setPausedFrameBase64] = React.useState<string | null>(null);
  const [enhancedFrameBase64, setEnhancedFrameBase64] = React.useState<string | null>(null);
  const [pausedOcrBusy, setPausedOcrBusy] = React.useState(false);
  const [pausedOcrStatus, setPausedOcrStatus] = React.useState<string>('Listo para análisis');
  const [viewerHint, setViewerHint] = React.useState<string | null>(null);
  const [pausedBufferExpanded, setPausedBufferExpanded] = React.useState(false);
  const [pausedOcrProgress, setPausedOcrProgress] = React.useState(0);
  const [enhancementProfile, setEnhancementProfile] = React.useState<
    'forensic_safe' | 'visual_aggressive'
  >('forensic_safe');
  const [enhancementHashes, setEnhancementHashes] = React.useState<{
    original_sha256: string | null;
    forensic_safe_sha256: string | null;
    visual_aggressive_sha256: string | null;
  } | null>(null);
  const [pausedOcrPlate, setPausedOcrPlate] = React.useState<string>('');
  const [pausedOcrCandidates, setPausedOcrCandidates] = React.useState<string[]>([]);
  const [manualPlateInput, setManualPlateInput] = React.useState<string>('');
  const [showEnhancedOnViewport, setShowEnhancedOnViewport] = React.useState(true);
  const [panEnabled, setPanEnabled] = React.useState(true);
  const [pipelineSteps, setPipelineSteps] = React.useState<
    Array<{ name: string; state: 'pending' | 'running' | 'done' }>
  >([
    { name: 'Mejora forense', state: 'pending' },
    { name: 'Detección región', state: 'pending' },
    { name: 'OCR multicapa', state: 'pending' },
    { name: 'Fallback profundo', state: 'pending' },
    { name: 'Consolidación', state: 'pending' },
  ]);
  const [pausedAnalysisComplete, setPausedAnalysisComplete] = React.useState(false);
  const [zoneSelectionEnabled, setZoneSelectionEnabled] = React.useState(false);
  const [zoneDraft, setZoneDraft] = React.useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);
  const [zoneSelected, setZoneSelected] = React.useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);
  const zoneStartRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const panDeltaRef = useRef({ dx: 0, dy: 0 });
  const panRafRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportRectCacheRef = useRef<DOMRect | null>(null);
  const viewportRectCachedAtRef = useRef(0);
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 8;

  const getViewportRect = useCallback((force = false): DOMRect | null => {
    const viewport = viewportRef.current;
    if (!viewport) return null;
    const now = performance.now();
    if (!force && viewportRectCacheRef.current && now - viewportRectCachedAtRef.current < 120) {
      return viewportRectCacheRef.current;
    }
    const rect = viewport.getBoundingClientRect();
    viewportRectCacheRef.current = rect;
    viewportRectCachedAtRef.current = now;
    return rect;
  }, []);

  const invalidateViewportRectCache = useCallback(() => {
    viewportRectCacheRef.current = null;
    viewportRectCachedAtRef.current = 0;
  }, []);

  useEffect(() => {
    if (!isPlaying && source !== 'none') {
      setPausedBufferExpanded(false);
    }
  }, [isPlaying, source]);

  const clampPan = useCallback((nextPan: { x: number; y: number }, nextZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return nextPan;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width <= 0 || height <= 0 || nextZoom <= 1) return { x: 0, y: 0 };
    const maxX = ((nextZoom - 1) * width) / 2;
    const maxY = ((nextZoom - 1) * height) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    };
  }, []);

  const applyZoomAtPoint = useCallback(
    (clientX: number, clientY: number, deltaY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = getViewportRect();
      if (!rect) return;
      const cx = clientX - rect.left - rect.width / 2;
      const cy = clientY - rect.top - rect.height / 2;

      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));
      if (Math.abs(nextZoom - zoom) < 0.0001) return;

      const scaleRatio = nextZoom / zoom;
      const nextPanRaw = {
        x: (pan.x - cx) * scaleRatio + cx,
        y: (pan.y - cy) * scaleRatio + cy,
      };
      setZoom(nextZoom);
      setPan(clampPan(nextPanRaw, nextZoom));
    },
    [zoom, pan, clampPan, getViewportRect]
  );

  const onViewportMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (zoneSelectionEnabled && !isPlaying && e.button === 0 && viewportRef.current) {
        const rect = getViewportRect(true);
        if (!rect) return;
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        zoneStartRef.current = { x, y };
        setZoneDraft({ x, y, width: 0, height: 0 });
        e.preventDefault();
        return;
      }
      if (e.button !== 0 || zoom <= 1 || !panEnabled) return;
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { ...pan };
      e.preventDefault();
    },
    [zoneSelectionEnabled, isPlaying, zoom, pan, panEnabled, getViewportRect]
  );

  const onViewportMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (zoneSelectionEnabled && zoneStartRef.current && viewportRef.current) {
        const rect = getViewportRect();
        if (!rect) return;
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const sx = zoneStartRef.current.x;
        const sy = zoneStartRef.current.y;
        setZoneDraft({
          x: Math.min(sx, x),
          y: Math.min(sy, y),
          width: Math.abs(x - sx),
          height: Math.abs(y - sy),
        });
        return;
      }
      if (!isPanningRef.current) return;
      panDeltaRef.current = {
        dx: e.clientX - panStartRef.current.x,
        dy: e.clientY - panStartRef.current.y,
      };
      if (panRafRef.current !== null) return;
      panRafRef.current = requestAnimationFrame(() => {
        panRafRef.current = null;
        const { dx, dy } = panDeltaRef.current;
        setPan(clampPan({ x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy }, zoom));
      });
    },
    [zoneSelectionEnabled, zoom, clampPan, getViewportRect]
  );

  useEffect(() => {
    const onResize = () => invalidateViewportRectCache();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [invalidateViewportRectCache]);

  const stopPanning = useCallback(() => {
    if (zoneSelectionEnabled && zoneStartRef.current) {
      const d = zoneDraft;
      if (d && d.width >= 10 && d.height >= 10) {
        setZoneSelected(d);
      }
      setZoneDraft(null);
      zoneStartRef.current = null;
    }
    isPanningRef.current = false;
    if (panRafRef.current !== null) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = null;
    }
  }, [zoneSelectionEnabled, zoneDraft]);

  useEffect(
    () => () => {
      if (panRafRef.current !== null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
    },
    []
  );

  const stepZoom = useCallback(
    (direction: 'in' | 'out') => {
      const factor = direction === 'in' ? 1.15 : 0.87;
      const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      setZoom(nextZoom);
      setPan((prev) => clampPan(prev, nextZoom));
    },
    [zoom, clampPan]
  );

  const zoomToRegion = useCallback(() => {
    const viewport = viewportRef.current;
    const zone = zoneSelected || zoneDraft;

    if (!zone || zone.width < 8 || zone.height < 8) {
      setZoneSelectionEnabled(true);
      setPausedOcrStatus('Dibuja un rectángulo en el visor y vuelve a pulsar Zoom región.');
      return;
    }
    if (!viewport) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    const zcx = zone.x + zone.width / 2;
    const zcy = zone.y + zone.height / 2;

    const fitScale = Math.min(vw / zone.width, vh / zone.height) * 0.85;
    const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * fitScale));

    const nextPanRaw = {
      x: pan.x + (cx - zcx),
      y: pan.y + (cy - zcy),
    };
    setZoom(nextZoom);
    setPan(clampPan(nextPanRaw, nextZoom));
    setZoneSelectionEnabled(false);
    setPausedOcrStatus('Zoom región aplicado.');
  }, [zoneSelected, zoneDraft, zoom, pan, clampPan]);

  const cropImageByZone = useCallback(
    async (imageDataUrl: string, zone: { x: number; y: number; width: number; height: number }) => {
      const viewport = viewportRef.current;
      if (!viewport) return null;
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      if (vw <= 0 || vh <= 0) return null;

      const cx = vw / 2;
      const cy = vh / 2;
      const inv = (px: number, py: number) => ({
        x: (px - cx - pan.x) / zoom + cx,
        y: (py - cy - pan.y) / zoom + cy,
      });
      const p1 = inv(zone.x, zone.y);
      const p2 = inv(zone.x + zone.width, zone.y + zone.height);
      const left = Math.min(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const right = Math.max(p1.x, p2.x);
      const bottom = Math.max(p1.y, p2.y);

      const viewAspect = vw / vh;
      const mediaAspect = aspectRatio > 0 ? aspectRatio : 16 / 9;
      const drawW = viewAspect > mediaAspect ? vh * mediaAspect : vw;
      const drawH = viewAspect > mediaAspect ? vh : vw / mediaAspect;
      const drawLeft = (vw - drawW) / 2;
      const drawTop = (vh - drawH) / 2;

      const nx1 = Math.max(0, Math.min(1, (left - drawLeft) / drawW));
      const ny1 = Math.max(0, Math.min(1, (top - drawTop) / drawH));
      const nx2 = Math.max(0, Math.min(1, (right - drawLeft) / drawW));
      const ny2 = Math.max(0, Math.min(1, (bottom - drawTop) / drawH));
      if (nx2 <= nx1 || ny2 <= ny1) return null;

      return await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const sx = Math.floor(nx1 * img.width);
            const sy = Math.floor(ny1 * img.height);
            const sw = Math.max(1, Math.floor((nx2 - nx1) * img.width));
            const sh = Math.max(1, Math.floor((ny2 - ny1) * img.height));
            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = imageDataUrl;
      });
    },
    [pan.x, pan.y, zoom, aspectRatio]
  );

  const runZoneAnalysis = useCallback(async () => {
    if (!zoneSelected || pausedOcrBusy) return;
    const sourceDataUrl =
      (showEnhancedOnViewport && enhancedFrameBase64) || pausedFrameBase64 || null;
    if (!sourceDataUrl) {
      setPausedOcrStatus('No hay imagen disponible para análisis por zona.');
      return;
    }
    const crop = await cropImageByZone(sourceDataUrl, zoneSelected);
    if (!crop) {
      setPausedOcrStatus('Zona inválida. Vuelve a seleccionar un rectángulo dentro de la imagen.');
      return;
    }

    setPausedOcrBusy(true);
    setPausedOcrStatus('Ejecutando pipeline forense OCR en zona seleccionada...');
    try {
      const ocr = getOCRService();
      const b64 = crop.split(',')[1] || '';
      const primary = await ocr.extractFromMultipleFramesWithPlateCrops([b64]);
      let plate = primary.plate || '';
      let candidates = primary.candidates.map((c) => c.text).filter(Boolean);
      if (!plate) {
        const deep = await ocr.extractPlateDeepFallback([b64]);
        if (deep.plate) {
          plate = deep.plate;
          candidates = [deep.plate, ...candidates];
        }
      }
      setPausedOcrCandidates([...new Set(candidates)].slice(0, 5));
      if (plate) {
        setPausedOcrPlate(plate);
        setManualPlateInput(plate);
        updateBufferStatus({ plateCandidate: plate });
        setPausedOcrStatus(`Análisis por zona completado. Matrícula detectada: ${plate}`);
      } else {
        setPausedOcrStatus('Análisis por zona completado sin lectura automática.');
      }
    } catch (error) {
      setPausedOcrStatus(
        `Error en análisis por zona: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setPausedOcrBusy(false);
    }
  }, [
    zoneSelected,
    pausedOcrBusy,
    showEnhancedOnViewport,
    enhancedFrameBase64,
    pausedFrameBase64,
    cropImageByZone,
    updateBufferStatus,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoomAtPoint(e.clientX, e.clientY, e.deltaY);
    };
    viewport.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onNativeWheel as EventListener);
  }, [applyZoomAtPoint]);

  // --- RENDERING LOOP ---
  const loop = useCallback(async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || source === 'none') return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    // Allow rendering if video has at least metadata (readyState >= 1)
    // Don't check paused state as getDisplayMedia streams report paused even when playing
    if (v.readyState < 1) return;

    const isPageVisible = document.visibilityState === 'visible';
    const now = performance.now();

    // In background tabs, keep a lightweight cadence to avoid long task violations.
    if (!isPageVisible) {
      if (now - lastBackgroundTickRef.current < 120) return;
      lastBackgroundTickRef.current = now;
    }

    try {
      if (v.videoWidth === 0 || v.videoHeight === 0) {
        console.warn('[RENDER] Video dimensions not ready:', {
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight,
          readyState: v.readyState,
        });
        return;
      }

      // For uploaded files, skip duplicate work when frame time didn't advance.
      // For screen share streams, currentTime may remain static in some Electron setups.
      if (source !== 'live') {
        const hasNewVideoFrame = v.currentTime !== lastVideoTimeRef.current;
        if (!hasNewVideoFrame) return;
        lastVideoTimeRef.current = v.currentTime;
      }

      // Render only when visible; background mode focuses on processing cadence.
      if (isPageVisible) {
        renderScene(
          ctx,
          v,
          trackerRef.current.tracks,
          geometry,
          isMeshRenderEnabled,
          showDetections,
          showROIs,
          true
        );
      }

      if (isPlaying && !processingFrameRef.current) {
        processingFrameRef.current = true;
        void processFrame(v, canvas).finally(() => {
          processingFrameRef.current = false;
        });
      }
    } catch (err) {
      addLog(
        'ERROR',
        `Error en frame loop [${viewerId}]: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [
    isPlaying,
    source,
    geometry,
    processFrame,
    isMeshRenderEnabled,
    showDetections,
    showROIs,
    videoRef,
    trackerRef,
    addLog,
    viewerId,
  ]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let anim = 0;
    let videoFrameCb = 0;
    let disposed = false;

    const hasVideoFrameCallback =
      typeof (v as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback ===
      'function';

    const run = () => {
      if (disposed) return;
      void loop();
      if (hasVideoFrameCallback) {
        const video = v as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => number;
        };
        videoFrameCb = video.requestVideoFrameCallback(() => run());
      } else {
        anim = requestAnimationFrame(run);
      }
    };

    run();

    return () => {
      disposed = true;
      if (anim) cancelAnimationFrame(anim);
      const video = v as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
      if (videoFrameCb && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(videoFrameCb);
      }
    };
  }, [loop, videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [videoRef, playbackRate]);

  const capturePausedFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0 || v.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    // Slight upscale improves plate readability without inventing data.
    const upscale = 1.5;
    const targetW = Math.min(2560, Math.max(640, Math.floor(v.videoWidth * upscale)));
    const targetH = Math.max(360, Math.floor((targetW * v.videoHeight) / Math.max(1, v.videoWidth)));
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(v, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.95);
  }, [videoRef]);

  const buildMaskedOcrFocusImage = useCallback(
    async (imageBase64: string, region: PlateDetectionRegion | null): Promise<string | null> => {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);

            const fallbackRegion: PlateDetectionRegion = {
              // Conservative heuristic: lower-middle strip where rear/front plates usually appear
              x: Math.floor(img.width * 0.24),
              y: Math.floor(img.height * 0.54),
              width: Math.floor(img.width * 0.52),
              height: Math.floor(img.height * 0.22),
              confidence: 0.2,
            };

            const r = region || fallbackRegion;
            const padX = Math.floor(r.width * 0.18);
            const padY = Math.floor(r.height * 0.30);
            const rx = Math.max(0, r.x - padX);
            const ry = Math.max(0, r.y - padY);
            const rw = Math.min(img.width - rx, r.width + padX * 2);
            const rh = Math.min(img.height - ry, r.height + padY * 2);

            // Black background everywhere
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, img.width, img.height);

            // Only keep OCR-relevant region visible
            ctx.drawImage(img, rx, ry, rw, rh, rx, ry, rw, rh);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/jpeg;base64,${imageBase64}`;
      });
    },
    []
  );

  const runPausedFrameOCR = useCallback(async (forcedFrameDataUrl?: string) => {
    if (pausedOcrBusy) return;
    const frameDataUrl = forcedFrameDataUrl || pausedFrameBase64 || capturePausedFrame();
    if (!frameDataUrl) {
      setPausedOcrStatus('No se pudo capturar el frame pausado');
      return;
    }

    setPausedOcrBusy(true);
    setPausedAnalysisComplete(false);
    setPausedOcrProgress(5);
    setPausedOcrStatus('Análisis exhaustivo en pausa: iniciando mejora forense...');
    setPausedOcrCandidates([]);
    setPausedOcrPlate('');
    setEnhancedFrameBase64(null);
    setEnhancementHashes(null);
    setShowEnhancedOnViewport(true);
    setPipelineSteps([
      { name: 'Mejora forense', state: 'running' },
      { name: 'Detección región', state: 'pending' },
      { name: 'OCR multicapa', state: 'pending' },
      { name: 'Fallback profundo', state: 'pending' },
      { name: 'Consolidación', state: 'pending' },
    ]);

    try {
      const base64 = frameDataUrl.split(',')[1] || '';
      let enhanced = base64;
      try {
        const resp = await fetch(getApiUrl('/api/images/enhance'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            profile: enhancementProfile,
            dual_output: true,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const legacyEnhancementRaw = String(data?.enhanced || '').trim();
          const safeEnhancementRaw = String(data?.forensic_safe?.enhanced || '').trim();
          const aggressiveEnhancementRaw = String(data?.visual_aggressive?.enhanced || '').trim();
          const selectedEnhancementRaw =
            enhancementProfile === 'visual_aggressive'
              ? aggressiveEnhancementRaw || safeEnhancementRaw || legacyEnhancementRaw
              : safeEnhancementRaw || aggressiveEnhancementRaw || legacyEnhancementRaw;
          const ocrEnhancementRaw = safeEnhancementRaw || selectedEnhancementRaw || legacyEnhancementRaw;
          if (data?.hashes) {
            setEnhancementHashes({
              original_sha256: data.hashes.original_sha256 || null,
              forensic_safe_sha256: data.hashes.forensic_safe_sha256 || null,
              visual_aggressive_sha256: data.hashes.visual_aggressive_sha256 || null,
            });
          }
          if (ocrEnhancementRaw) {
            enhanced = ocrEnhancementRaw.startsWith('data:')
              ? ocrEnhancementRaw.split(',')[1]
              : ocrEnhancementRaw;
          }
          if (selectedEnhancementRaw) {
            const enhancedForDisplay = selectedEnhancementRaw.startsWith('data:')
              ? selectedEnhancementRaw.split(',')[1]
              : selectedEnhancementRaw;
            setEnhancedFrameBase64(`data:image/jpeg;base64,${enhancedForDisplay}`);
            setShowEnhancedOnViewport(true);
            setPausedOcrStatus('Mejora forense aplicada al visor.');
          } else if (legacyEnhancementRaw) {
            const legacyForDisplay = legacyEnhancementRaw.startsWith('data:')
              ? legacyEnhancementRaw.split(',')[1]
              : legacyEnhancementRaw;
            setEnhancedFrameBase64(`data:image/jpeg;base64,${legacyForDisplay}`);
            setShowEnhancedOnViewport(true);
            setPausedOcrStatus('Mejora forense aplicada al visor (modo compatibilidad).');
          }
        }
      } catch {
        // Fallback: keep original frame
      }

      setPausedOcrProgress(25);
      setPipelineSteps((prev) =>
        prev.map((step, i) =>
          i === 0 ? { ...step, state: 'done' } : i === 1 ? { ...step, state: 'running' } : step
        )
      );
      setPausedOcrStatus('Análisis exhaustivo: ejecutando OCR multicapa...');
      const ocr = getOCRService();
      const region = await ocr.detectPlateRegion(enhanced);
      await buildMaskedOcrFocusImage(enhanced, region);

      setPausedOcrProgress(45);
      setPipelineSteps((prev) =>
        prev.map((step, i) =>
          i === 1 ? { ...step, state: 'done' } : i === 2 ? { ...step, state: 'running' } : step
        )
      );
      const primary = await ocr.extractFromMultipleFramesWithPlateCrops([base64, enhanced]);
      let finalPlate = primary.plate || '';
      let finalCandidates = primary.candidates.map((c) => c.text).filter(Boolean);
      setPausedOcrProgress(70);

      if (!finalPlate) {
        setPausedOcrStatus('Análisis exhaustivo: fallback profundo OCR en ejecución...');
        setPipelineSteps((prev) =>
          prev.map((step, i) =>
            i === 2 ? { ...step, state: 'done' } : i === 3 ? { ...step, state: 'running' } : step
          )
        );
        const deep = await ocr.extractPlateDeepFallback([base64, enhanced]);
        if (deep.plate) {
          finalPlate = deep.plate;
          finalCandidates = [deep.plate, ...finalCandidates];
        }
        setPausedOcrProgress(88);
      } else {
        setPipelineSteps((prev) => prev.map((step, i) => (i === 2 ? { ...step, state: 'done' } : step)));
      }

      const uniqueCandidates = [...new Set(finalCandidates)].slice(0, 5);
      setPausedOcrCandidates(uniqueCandidates);
      setPausedOcrPlate(finalPlate);
      setManualPlateInput(finalPlate || '');
      setPipelineSteps((prev) =>
        prev.map((step, i) =>
          i === 3 ? { ...step, state: 'done' } : i === 4 ? { ...step, state: 'running' } : step
        )
      );

      if (finalPlate) {
        updateBufferStatus({ plateCandidate: finalPlate });
        addLog('AI', `OCR en pausa detectó matrícula: ${finalPlate}`);
        setPausedOcrStatus(
          'Análisis exhaustivo completado. Matrícula detectada; revisión manual habilitada.'
        );
      } else {
        setPausedOcrStatus(
          'Análisis exhaustivo completado. Sin lectura automática; intervención manual requerida.'
        );
      }
      setPausedOcrProgress(100);
      setPipelineSteps((prev) => prev.map((step) => ({ ...step, state: 'done' })));
      setPausedAnalysisComplete(true);
    } catch (error) {
      setPausedOcrStatus('Error en flujo OCR del frame pausado');
      addLog(
        'ERROR',
        `OCR en pausa falló: ${error instanceof Error ? error.message : String(error)}`
      );
      setPausedAnalysisComplete(true);
    } finally {
      setPausedOcrBusy(false);
    }
  }, [
    pausedOcrBusy,
    pausedFrameBase64,
    capturePausedFrame,
    updateBufferStatus,
    addLog,
    enhancementProfile,
    buildMaskedOcrFocusImage,
  ]);

  const applyManualPlate = useCallback(() => {
    const normalized = manualPlateInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
      setPausedOcrStatus('Introduce una matrícula válida');
      return;
    }
    setPausedOcrPlate(normalized);
    updateBufferStatus({ plateCandidate: normalized });
    addLog('CORE', `Matrícula establecida manualmente en pausa: ${normalized}`);
    setPausedOcrStatus('Matrícula manual aplicada al flujo forense');
  }, [manualPlateInput, updateBufferStatus, addLog]);

  // --- EVENT HANDLERS ---
  const handleFileSelect = React.useCallback(() => fileInputRef.current?.click(), []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      resetTracker();
      clearLogs();
      contextOnFilesChange(files, videoRef);
    }
    e.target.value = '';
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateRatio = () => {
      if (v.videoWidth && v.videoHeight) {
        setAspectRatio(v.videoWidth / v.videoHeight);
      }
    };
    v.addEventListener('loadedmetadata', updateRatio);
    updateRatio();
    return () => v.removeEventListener('loadedmetadata', updateRatio);
  }, [videoRef]);

  // Video State Management
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isPlaying) {
      v.playbackRate = playbackRate;
      v.play().catch(console.error);
      setPausedFrameBase64(null);
      setEnhancedFrameBase64(null);
      setPausedAnalysisComplete(false);
      setShowEnhancedOnViewport(true);
      setPausedOcrProgress(0);
      setEnhancementHashes(null);
      setZoneSelectionEnabled(false);
      setZoneSelected(null);
      setZoneDraft(null);
      setPausedOcrStatus('Listo para análisis');
    } else {
      v.pause();
      const frame = capturePausedFrame();
      if (frame) {
        setPausedFrameBase64(frame);
        setPausedOcrStatus('Pausado: análisis automático desactivado. Usa "Reanalizar escena".');
        setPausedAnalysisComplete(false);
        setPausedOcrBusy(false);
        setPausedOcrProgress(0);
        setZoneSelectionEnabled(false);
        setZoneSelected(null);
        setZoneDraft(null);
      }
    }

    const handleEnded = async () => {
      if (isBatchMode) {
        await loadNextInQueue();
      } else {
        setIsPlaying(false);
        if (source === 'upload') {
          await finalizeVideoReport();
        }
      }
    };

    v.addEventListener('ended', handleEnded);
    return () => v.removeEventListener('ended', handleEnded);
  }, [
    isPlaying,
    isBatchMode,
    loadNextInQueue,
    playbackRate,
    setIsPlaying,
    videoRef,
    source,
    finalizeVideoReport,
    capturePausedFrame,
    runPausedFrameOCR,
  ]);

  // Sync this viewer state to the shared bar whenever it is the focused viewer
  useEffect(() => {
    if (!isFocused) return;
    updateFocusedViewer({
      viewerId,
      isPlaying,
      playbackRate,
      source,
      videoRef,
      logs,
      setIsPlayingFn: setIsPlaying,
      setPlaybackRateFn: setPlaybackRate,
      onScreenShareFn: () => {
        clearLogs();
        contextStartScreenShare(videoRef);
      },
      onStopScreenShareFn: () => {
        contextStopScreenShare();
      },
      onIpCameraFn: () => setShowIpModal(true),
      onUploadFn: handleFileSelect,
    });
  }, [
    isFocused,
    isPlaying,
    playbackRate,
    source,
    logs,
    viewerId,
    updateFocusedViewer,
    setIsPlaying,
    clearLogs,
    contextStartScreenShare,
    contextStopScreenShare,
    videoRef,
    handleFileSelect,
  ]);

  return (
    <main className="relative flex flex-col bg-black overflow-hidden h-full w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/*"
        multiple
        onChange={onFileChange}
      />

      {showIpModal && <IpCameraModal onClose={() => setShowIpModal(false)} />}

      <NeuralStatusHUD />

      <ForensicAnalysisOverlay isAnalyzing={isAnalyzing} />

      <SystemAlertHUD />

      <div
        className={
          mini
            ? 'flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-0'
            : compact
              ? 'flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-2'
              : 'flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-4 lg:p-8'
        }
      >
        <div className="absolute inset-0 hud-grid opacity-30 pointer-events-none" />
        <div className="scanline" />

        <div
          className="relative z-20 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 glass-card overflow-hidden group"
          style={{
            aspectRatio: `${aspectRatio}`,
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: 'auto',
            touchAction: 'none',
          }}
          ref={viewportRef}
          onMouseDownCapture={onViewportMouseDown}
          onMouseMoveCapture={onViewportMouseMove}
          onMouseUpCapture={stopPanning}
          onMouseLeave={stopPanning}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: 'center center',
              willChange: 'transform',
              cursor: zoneSelectionEnabled
                ? 'crosshair'
                : zoom > 1
                  ? isPanningRef.current
                    ? 'grabbing'
                    : 'grab'
                  : 'default',
            }}
          >
            <HEVCVideo
              videoRef={videoRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-black"
            />
            {!isPlaying && enhancedFrameBase64 && showEnhancedOnViewport && (
              <img
                src={enhancedFrameBase64}
                alt="Mejora forense aplicada sobre visor"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            )}
            <canvas
              ref={canvasRef}
              className={
                'absolute inset-0 w-full h-full object-contain pointer-events-none ' +
                (!isPlaying && enhancedFrameBase64 && showEnhancedOnViewport ? 'opacity-0' : 'opacity-100')
              }
            />
            <GeometryEditor canvasRef={canvasRef} />
          </div>

          {!isPlaying && (zoneDraft || zoneSelected) && (
            <div className="absolute inset-0 pointer-events-none z-30">
              <div
                className="absolute border-2 border-amber-400 bg-amber-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${(zoneDraft || zoneSelected)!.x}px`,
                  top: `${(zoneDraft || zoneSelected)!.y}px`,
                  width: `${(zoneDraft || zoneSelected)!.width}px`,
                  height: `${(zoneDraft || zoneSelected)!.height}px`,
                }}
              />
            </div>
          )}

          <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-blue-500/50" />
          <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-blue-500/50" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-blue-500/50" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-blue-500/50" />
        </div>

        {source === 'none' && <EmptyState />}

        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center z-[60] bg-[#020617]/60 backdrop-blur-md transition-all duration-500">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
              <div className="relative bg-black/80 border border-blue-500/40 px-12 py-6 rounded-2xl flex flex-col items-center gap-4 shadow-2xl overflow-hidden glass-card">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-pulse" />
                <img
                  src={escudo}
                  alt="Sentinel Logo"
                  className="w-12 h-12 object-contain animate-bounce"
                />
                <div className="flex flex-col items-center">
                  <span className="text-sm font-black text-white uppercase tracking-[0.3em] italic text-glow-blue">
                    Analizando Vector
                  </span>
                  <span className="text-[10px] font-mono text-blue-500/60 mt-1">
                    PROCESANDO_CAPAS_NEURALES...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isPlaying && source !== 'none' && (
          <div
            className={
              (pausedBufferExpanded
                ? 'absolute bottom-4 left-4 right-4 ml-[14rem]'
                : 'absolute bottom-4 left-4 right-4 ml-[14rem] max-w-none') +
              ' z-[69] bg-[#020617]/92 border border-white/10 border-l-4 border-l-blue-500/90 rounded-xl shadow-[0_0_18px_rgba(0,0,0,0.45)] backdrop-blur-md'
            }
          >
            {!pausedBufferExpanded && (
              <div className="h-12 px-2 flex items-center gap-2 whitespace-nowrap overflow-x-auto">
                <div
                  className="h-9 px-3 rounded-lg border border-blue-500/35 bg-blue-500/10 flex items-center gap-2 shrink-0"
                  {...helpProps('Estado actual del buffer forense en pausa.')}
                >
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/95">
                      ◉ Buffer Forense
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wide text-blue-300 mt-1">
                      ● Buffer_en_espera
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Expandir buffer forense"
                  onClick={() => setPausedBufferExpanded(true)}
                  className="h-8 w-8 text-[12px] font-black rounded border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                  {...helpProps('Expandir buffer forense en pausa a vista completa.')}
                >
                  <span aria-hidden="true">⤢</span>
                </button>
                <button
                  type="button"
                  aria-label={pausedOcrBusy ? 'Análisis en curso' : 'Reanalizar escena'}
                  disabled={pausedOcrBusy}
                  onClick={() => void runPausedFrameOCR()}
                  className="h-8 w-8 text-[12px] font-black rounded border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50"
                  {...helpProps('Reanalizar escena pausada con pipeline OCR completo.')}
                >
                  <span aria-hidden="true">{pausedOcrBusy ? '…' : '↻'}</span>
                </button>
                <button
                  type="button"
                  aria-label={showEnhancedOnViewport ? 'Ocultar mejora forense' : 'Mostrar mejora forense'}
                  onClick={() => setShowEnhancedOnViewport((v) => !v)}
                  className="h-8 w-8 text-[12px] font-black rounded border border-white/20 text-slate-300 hover:bg-white/10"
                  {...helpProps(
                    showEnhancedOnViewport
                      ? 'Ocultar mejora forense aplicada sobre el visor.'
                      : 'Mostrar mejora forense aplicada sobre el visor.'
                  )}
                >
                  <span aria-hidden="true">{showEnhancedOnViewport ? '◐' : '◑'}</span>
                </button>
                <button
                  type="button"
                  aria-label={zoneSelectionEnabled ? 'Desactivar selección de zona' : 'Activar selección de zona'}
                  disabled={pausedOcrBusy}
                  onClick={() => {
                    setZoneSelectionEnabled((v) => !v);
                    setZoneDraft(null);
                    if (zoneSelectionEnabled) {
                      setPausedOcrStatus('Selección de zona desactivada.');
                    } else {
                      setPausedOcrStatus('Marca un rectángulo en el visor para análisis por zona.');
                    }
                  }}
                  className={
                    'h-8 w-8 text-[12px] font-black rounded border disabled:opacity-50 ' +
                    (zoneSelectionEnabled
                      ? 'border-amber-400/60 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'border-white/20 text-slate-300 hover:bg-white/10')
                  }
                  {...helpProps(
                    zoneSelectionEnabled
                      ? 'Desactivar selección de zona rectangular.'
                      : 'Activar selección de zona rectangular para análisis localizado.'
                  )}
                >
                  <span aria-hidden="true">⌗</span>
                </button>
                <button
                  type="button"
                  aria-label="Limpiar zona seleccionada"
                  disabled={pausedOcrBusy || !zoneSelected}
                  onClick={() => {
                    setZoneSelected(null);
                    setZoneDraft(null);
                    setPausedOcrStatus('Zona limpiada.');
                  }}
                  className="h-8 w-8 text-[12px] font-black rounded border border-white/20 text-slate-300 hover:bg-white/10 disabled:opacity-50"
                  {...helpProps('Limpiar zona seleccionada.')}
                >
                  <span aria-hidden="true">⌫</span>
                </button>
                <button
                  type="button"
                  aria-label="Ejecutar análisis en zona"
                  disabled={pausedOcrBusy || !zoneSelected}
                  onClick={() => void runZoneAnalysis()}
                  className="h-8 w-8 text-[12px] font-black rounded border border-emerald-500/50 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50"
                  {...helpProps('Ejecutar análisis OCR y mejora solo en la zona seleccionada.')}
                >
                  <span aria-hidden="true">▶</span>
                </button>
                <select
                  value={enhancementProfile}
                  onChange={(e) =>
                    setEnhancementProfile(
                      e.target.value === 'visual_aggressive' ? 'visual_aggressive' : 'forensic_safe'
                    )
                  }
                  disabled={pausedOcrBusy}
                  className="h-8 px-2 text-[10px] font-black uppercase tracking-wider rounded border border-white/20 text-slate-200 bg-black/30 disabled:opacity-50"
                  {...helpProps(
                    'Selector de perfil de mejora: forensic_safe (conservador) o visual_aggressive (agresivo).'
                  )}
                >
                  <option value="forensic_safe">forensic_safe</option>
                  <option value="visual_aggressive">visual_aggressive</option>
                </select>
                <div className="h-2 w-44 rounded bg-white/10 border border-white/10 overflow-hidden ml-1">
                  <div
                    className="h-full bg-blue-500/80"
                    style={{ width: `${pausedOcrProgress}%` }}
                    {...helpProps('Barra de progreso del pipeline OCR en pausa.')}
                  />
                </div>
                <span className="ml-auto text-[10px] font-mono text-slate-400 truncate">
                  {viewerHint ?? pausedOcrStatus}
                </span>
                <span className="text-[10px] font-mono text-slate-400 pr-2">
                  {pausedOcrProgress}%
                </span>
              </div>
            )}

            {pausedBufferExpanded && (
              <>
              <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90 mr-2">
                  Buffer Forense En Pausa
                </span>
                <button
                  type="button"
                  onClick={() => setPausedBufferExpanded(false)}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                  {...helpProps('Minimizar buffer forense en pausa a vista compacta.')}
                >
                  Minimizar
                </button>
                <span className="text-[10px] font-mono text-slate-400 ml-auto">{viewerHint ?? pausedOcrStatus}</span>
              </div>
              <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-white/5">
              <button
                type="button"
                disabled={pausedOcrBusy}
                onClick={() => void runPausedFrameOCR()}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50"
              >
                {pausedOcrBusy ? 'Analizando...' : 'Reanalizar escena'}
              </button>
              <button
                type="button"
                onClick={() => setShowEnhancedOnViewport((v) => !v)}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border border-white/20 text-slate-300 hover:bg-white/10"
              >
                {showEnhancedOnViewport ? 'Ocultar mejora' : 'Mostrar mejora'}
              </button>
              <button
                type="button"
                disabled={pausedOcrBusy}
                onClick={() => {
                  setZoneSelectionEnabled((v) => !v);
                  setZoneDraft(null);
                  if (zoneSelectionEnabled) {
                    setPausedOcrStatus('Selección de zona desactivada.');
                  } else {
                    setPausedOcrStatus('Marca un rectángulo en el visor para análisis por zona.');
                  }
                }}
                className={
                  'px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border disabled:opacity-50 ' +
                  (zoneSelectionEnabled
                    ? 'border-amber-400/60 text-amber-300 bg-amber-500/10'
                    : 'border-white/20 text-slate-300 hover:bg-white/10')
                }
              >
                {zoneSelectionEnabled ? 'Zona: ACTIVA' : 'Seleccionar zona'}
              </button>
              <button
                type="button"
                disabled={pausedOcrBusy || !zoneSelected}
                onClick={() => {
                  setZoneSelected(null);
                  setZoneDraft(null);
                  setPausedOcrStatus('Zona limpiada.');
                }}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border border-white/20 text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Limpiar zona
              </button>
              <button
                type="button"
                disabled={pausedOcrBusy || !zoneSelected}
                onClick={() => void runZoneAnalysis()}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border border-emerald-500/50 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Ejecutar en zona
              </button>
              <select
                value={enhancementProfile}
                onChange={(e) =>
                  setEnhancementProfile(
                    e.target.value === 'visual_aggressive' ? 'visual_aggressive' : 'forensic_safe'
                  )
                }
                disabled={pausedOcrBusy}
                className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border border-white/20 text-slate-200 bg-black/30 disabled:opacity-50"
              >
                <option value="forensic_safe">forensic_safe</option>
                <option value="visual_aggressive">visual_aggressive</option>
              </select>
              <span className="text-[10px] font-mono text-slate-400 ml-auto">{viewerHint ?? pausedOcrStatus}</span>
            </div>
            <div className="px-4 py-2 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                  Progreso OCR
                </span>
                <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${pausedOcrProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-white">{pausedOcrProgress}%</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pipelineSteps.map((step) => (
                  <span
                    key={step.name}
                    className={`px-2 py-1 rounded text-[9px] font-mono uppercase border ${
                      step.state === 'done'
                        ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                        : step.state === 'running'
                          ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                          : 'border-white/15 text-slate-400 bg-white/5'
                    }`}
                  >
                    {step.name}: {step.state}
                  </span>
                ))}
              </div>
              {enhancementHashes && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <span className="px-2 py-1 rounded text-[9px] font-mono border border-white/15 text-slate-300 bg-white/5">
                    ORIG: {enhancementHashes.original_sha256?.slice(0, 16)}...
                  </span>
                  <span className="px-2 py-1 rounded text-[9px] font-mono border border-blue-500/30 text-blue-300 bg-blue-500/10">
                    SAFE: {enhancementHashes.forensic_safe_sha256?.slice(0, 16)}...
                  </span>
                  <span className="px-2 py-1 rounded text-[9px] font-mono border border-amber-500/30 text-amber-300 bg-amber-500/10">
                    AGGR: {enhancementHashes.visual_aggressive_sha256?.slice(0, 16)}...
                  </span>
                </div>
              )}
            </div>
            <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
              {pausedOcrCandidates.map((cand) => (
                <button
                  key={cand}
                  type="button"
                  onClick={() => setManualPlateInput(cand)}
                  className="px-2 py-1 text-[10px] font-mono rounded border border-white/15 text-slate-200 hover:border-blue-400/50"
                >
                  {cand}
                </button>
              ))}
            </div>
            <div className="px-4 pb-4 flex items-center gap-2">
              <input
                value={manualPlateInput}
                onChange={(e) => setManualPlateInput(e.target.value)}
                placeholder="Introduce matrícula manual"
                disabled={!pausedAnalysisComplete || pausedOcrBusy}
                className="flex-1 bg-black/40 border border-white/15 rounded px-3 py-2 text-[12px] font-mono text-white placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={applyManualPlate}
                disabled={!pausedAnalysisComplete || pausedOcrBusy}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50"
              >
                Confirmar
              </button>
              {pausedOcrPlate && (
                <span className="text-[11px] font-black font-mono text-amber-400">
                  {pausedOcrPlate}
                </span>
              )}
            </div>
              </>
            )}
          </div>
        )}

        {source !== 'none' && (
          <div className="absolute bottom-4 left-4 z-[70]">
            <div className="flex items-center gap-2 bg-[#020617]/88 border border-white/10 rounded-xl p-2 backdrop-blur-md shadow-[0_0_18px_rgba(0,0,0,0.45)]">
              <button
                type="button"
                aria-label="Aumentar zoom"
                onClick={() => stepZoom('in')}
                onMouseEnter={() => setViewerHint('Aumenta el nivel de zoom del visor.')}
                onMouseLeave={() => setViewerHint(null)}
                onFocus={() => setViewerHint('Aumenta el nivel de zoom del visor.')}
                onBlur={() => setViewerHint(null)}
                className={
                  'rounded-md border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 font-black transition-colors ' +
                  (mini ? 'h-8 w-8 text-[12px]' : compact ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-[14px]')
                }
                {...helpProps('Aumenta el nivel de zoom del visor.')}
              >
                <span aria-hidden="true">＋</span>
              </button>
              <button
                type="button"
                aria-label="Reducir zoom"
                onClick={() => stepZoom('out')}
                onMouseEnter={() => setViewerHint('Reduce el nivel de zoom del visor.')}
                onMouseLeave={() => setViewerHint(null)}
                onFocus={() => setViewerHint('Reduce el nivel de zoom del visor.')}
                onBlur={() => setViewerHint(null)}
                className={
                  'rounded-md border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 font-black transition-colors ' +
                  (mini ? 'h-8 w-8 text-[12px]' : compact ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-[14px]')
                }
                {...helpProps('Reduce el nivel de zoom del visor.')}
              >
                <span aria-hidden="true">－</span>
              </button>
              <button
                type="button"
                aria-label="Aplicar zoom a región"
                onClick={zoomToRegion}
                onMouseEnter={() =>
                  setViewerHint('Dibuja un rectángulo y aplica zoom preciso a esa zona.')
                }
                onMouseLeave={() => setViewerHint(null)}
                onFocus={() => setViewerHint('Dibuja un rectángulo y aplica zoom preciso a esa zona.')}
                onBlur={() => setViewerHint(null)}
                className={
                  'rounded-md border border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 font-black transition-colors ' +
                  (mini ? 'h-8 w-8 text-[12px]' : compact ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-[14px]')
                }
                {...helpProps('Aplica zoom automático a la zona rectangular seleccionada.')}
              >
                <span aria-hidden="true">⌖</span>
              </button>
              <button
                type="button"
                aria-label={panEnabled ? 'Desactivar paneo' : 'Activar paneo'}
                onClick={() => setPanEnabled((v) => !v)}
                onMouseEnter={() =>
                  setViewerHint(panEnabled ? 'Desactiva el arrastre para paneo.' : 'Activa el arrastre para paneo.')
                }
                onMouseLeave={() => setViewerHint(null)}
                onFocus={() =>
                  setViewerHint(panEnabled ? 'Desactiva el arrastre para paneo.' : 'Activa el arrastre para paneo.')
                }
                onBlur={() => setViewerHint(null)}
                className={
                  'rounded-md border font-black transition-colors ' +
                  (panEnabled
                    ? 'border-blue-500/60 text-blue-200 bg-blue-500/20 hover:bg-blue-500/25'
                    : 'border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20') +
                  ' ' +
                  (mini ? 'h-8 w-8 text-[12px]' : compact ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-[14px]')
                }
                {...helpProps(
                  panEnabled
                    ? 'Desactivar arrastre para paneo del visor.'
                    : 'Activar arrastre para paneo del visor.'
                )}
              >
                <span aria-hidden="true">✥</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
});

SentinelViewer.displayName = 'SentinelViewer';



