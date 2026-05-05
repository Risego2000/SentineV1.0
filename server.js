import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn, execSync, spawnSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { Readable } from 'stream';
import { WebSocketServer } from 'ws';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import {
  analyzeTrajectoryWithGemini,
  generateGeometryWithGemini,
  loadLocalEnvFile,
  extractLicensePlateWithGemini,
  extractTimestampFromOSD as extractTimestampFromOSDGemini,
} from './services/aiServer.js';
import { generateBoletin } from './services/boletin-generator.js';
import {
  extractLicensePlateFromImages as extractLicensePlateFromPaddle,
  extractTimestampFromOSD as extractTimestampFromPaddle,
  shutdownOcrWorker,
} from './services/paddleOcrService.js';
import {
  detectPlateWithYOLO,
  detectPlateInFrames,
} from './services/yoloPlateDetector.js';
import {
  enhanceImageForOCR,
  enhanceImagesForOCR,
  enhanceImageDualForOCR,
} from './services/imageEnhancementService.js';
import {
  isPrivateAddress,
  sanitizeFilename,
  isPathWithinDir,
  validateCameraHost as _validateCameraHost,
} from './services/serverSecurityUtils.ts';
import { validators } from './services/validators.ts';
import { logger } from './services/logger.ts';

// NEW: Evidence Store API (single source of truth)
import { createEvidenceStoreRouter } from './server/services/evidenceStore.ts';

// Supabase for server-side queries with service role key
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

loadLocalEnvFile();
const app = express();
const parsePositiveIntEnv = (name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`[ENV] ${name} inválida: "${raw}". Debe ser entero entre ${min} y ${max}.`);
  }
  return parsed;
};

const validateServerEnv = () => {
  const port = parsePositiveIntEnv('PORT', 3002, 1, 65535);
  const reportsDir = process.env.REPORTS_DIR || 'C:\\Denuncias';
  const maxTranscodeBytes = parsePositiveIntEnv(
    'TRANSCODE_MAX_BYTES',
    250 * 1024 * 1024,
    1_000_000,
    2_000_000_000
  );
  const maxReportMb = parsePositiveIntEnv('REPORT_MAX_MB', 100, 1, 2000);
  const maxTranscodeConcurrency = parsePositiveIntEnv('TRANSCODE_MAX_CONCURRENCY', 2, 1, 16);
  const rateLimitWindowMs = parsePositiveIntEnv(
    'API_RATE_LIMIT_WINDOW_MS',
    60_000,
    1000,
    3_600_000
  );
  const rateLimitMaxRequests = parsePositiveIntEnv('API_RATE_LIMIT_MAX_REQUESTS', 120, 1, 10_000);
  const apiToken = process.env.SENTINEL_API_TOKEN || '';
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedCameraHosts = (process.env.IP_CAMERA_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error('[ENV] ALLOWED_ORIGINS no puede quedar vacío.');
  }

  return {
    port,
    reportsDir,
    maxTranscodeBytes,
    maxReportMb,
    maxTranscodeConcurrency,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    apiToken,
    allowedOrigins,
    allowedCameraHosts,
  };
};

const env = validateServerEnv();
const port = env.port;
const REPORTS_DIR = env.reportsDir;
const MAX_TRANSCODE_BYTES = env.maxTranscodeBytes;
const MAX_REPORT_MB = env.maxReportMb;
const MAX_TRANSCODE_CONCURRENCY = env.maxTranscodeConcurrency;
const FORENSIC_H264_CRF = 14;
const RATE_LIMIT_WINDOW_MS = env.rateLimitWindowMs;
const RATE_LIMIT_MAX_REQUESTS = env.rateLimitMaxRequests;
const API_TOKEN = env.apiToken;
const ALLOWED_ORIGINS = env.allowedOrigins;
const ALLOWED_CAMERA_HOSTS = env.allowedCameraHosts;

const progressMap = new Map();
const ipCameraSessions = new Map();
const rateLimitStore = new Map();
const publicRateLimitStore = new Map();
const IP_CAMERA_SESSION_TTL_MS = 5 * 60 * 1000;
let activeTranscodes = 0;
const PLATE_RECOGNIZER_TOKEN = (process.env.PLATE_RECOGNIZER_TOKEN || '').trim();
const PUBLIC_API_TOKEN = (
  process.env.PUBLIC_API_TOKEN ||
  process.env.SENTINEL_API_TOKEN ||
  ''
).trim();
const PUBLIC_API_TOKENS = (process.env.PUBLIC_API_TOKENS || PUBLIC_API_TOKEN)
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const PUBLIC_API_HMAC_KEYS = (process.env.PUBLIC_API_HMAC_KEYS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [kid, ...secretParts] = entry.split(':');
    return { kid: (kid || '').trim(), secret: secretParts.join(':').trim() };
  })
  .filter((k) => k.kid && k.secret);
const TRANSIT_WEBHOOK_URL = (process.env.TRANSIT_WEBHOOK_URL || '').trim();
const PUBLIC_API_RATE_LIMIT_WINDOW_MS = parsePositiveIntEnv(
  'PUBLIC_API_RATE_LIMIT_WINDOW_MS',
  60_000,
  1000,
  3_600_000
);
const PUBLIC_API_RATE_LIMIT_MAX_REQUESTS = parsePositiveIntEnv(
  'PUBLIC_API_RATE_LIMIT_MAX_REQUESTS',
  240,
  1,
  100_000
);

// ─── Expedient & Infraction Cache (in-memory storage to bypass Supabase RLS) ───
// The app sends expedients/infractions to the backend when they're created.
// This cache stores them so we can serve them without RLS permission issues.
const expedientCache = new Map(); // Key: expedient_id, Value: expedient data
const infractionCache = new Map(); // Key: infraction_id, Value: infraction data
const evidenceCache = new Map(); // Key: expedient_id, Value: { images: [], video: ... }

// Helper to update expedient in cache
const cacheExpedient = (expedient) => {
  if (!expedient || !expedient.id) return false;
  expedientCache.set(expedient.id, {
    ...expedient,
    cached_at: new Date().toISOString(),
  });
  logger.debug('EXPEDIENT_CACHE', `Cached expedient: ${expedient.id} (total: ${expedientCache.size})`);
  return true;
};

// Helper to update infraction in cache
const cacheInfraction = (infraction) => {
  if (!infraction || !infraction.id) return false;
  infractionCache.set(infraction.id, {
    ...infraction,
    cached_at: new Date().toISOString(),
  });
  logger.debug('INFRACTION_CACHE', `Cached infraction: ${infraction.id} (total: ${infractionCache.size})`);
  return true;
};

// Helper to get all expedients, optionally filtered by state
const getCachedExpedients = (state = null) => {
  const all = Array.from(expedientCache.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  if (!state) return all;

  return all.filter((e) => e.state === state.toUpperCase());
};

// Helper to get all infractions, optionally filtered by status
const getCachedInfractions = (status = null) => {
  const all = Array.from(infractionCache.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  if (!status) return all;

  return all.filter((inf) => inf.status === status.toUpperCase());
};

const realtimeClients = new Map();
const realtimeStats = {
  detections: 0,
  infractions: 0,
  expedients: 0,
  activeCameras: 0,
  updatedAt: new Date().toISOString(),
};
const transitQueue = [];
const transitDeliveryState = new Map();
let transitWorkerActive = false;
const realtimeHistory = [];
const MAX_HISTORY_POINTS = 5000;
let lastRealtimeResetDate = new Date().toDateString();

let ffmpegPath;
let ffprobePath;
let hardwareAccel = 'none'; // 'none', 'amd', 'nvidia', 'intel', 'apple'
try {
  ffmpegPath = ffmpegInstaller.path;
  ffprobePath = ffprobeInstaller.path;
} catch {
  ffmpegPath = 'ffmpeg';
  ffprobePath = 'ffprobe';
}

// Detect available hardware acceleration
const detectHardwareAccel = () => {
  try {
    const ffmpegHelp = execSync(`"${ffmpegPath}" -encoders 2>&1`).toString();

    if (ffmpegHelp.includes('hevc_amf') || ffmpegHelp.includes('h264_amf')) {
      console.log('[FFMPEG] ✓ AMD Hardware Acceleration (AMF) detectada');
      return 'amd';
    }
    if (ffmpegHelp.includes('hevc_nvenc') || ffmpegHelp.includes('h264_nvenc')) {
      console.log('[FFMPEG] ✓ NVIDIA Hardware Acceleration (NVENC) detectada');
      return 'nvidia';
    }
    if (ffmpegHelp.includes('hevc_qsv') || ffmpegHelp.includes('h264_qsv')) {
      console.log('[FFMPEG] ✓ Intel Hardware Acceleration (QSV) detectada');
      return 'intel';
    }
    if (ffmpegHelp.includes('hevc_videotoolbox') || ffmpegHelp.includes('h264_videotoolbox')) {
      console.log('[FFMPEG] ✓ Apple Hardware Acceleration (VideoToolbox) detectada');
      return 'apple';
    }
  } catch (error) {
    console.warn('[FFMPEG] No se pudo detectar aceleración hardware:', error.message);
  }
  console.log('[FFMPEG] ⚠ Sin aceleración hardware disponible. Usando CPU (más lento).');
  return 'none';
};

hardwareAccel = detectHardwareAccel();

// Get input video codec using ffprobe
const getInputCodec = async (inputPath) => {
  try {
    const cmd = `"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    const output = execSync(cmd).toString().trim();
    return output || 'unknown';
  } catch {
    return 'unknown';
  }
};

// Get FFmpeg encoder args based on hardware acceleration
const getEncoderArgs = (outputCodec = 'h264') => {
  if (outputCodec === 'hevc' || outputCodec === 'h265') {
    if (hardwareAccel === 'amd') {
      return ['-c:v', 'hevc_amf', '-usage', 'transcoding'];
    }
    if (hardwareAccel === 'nvidia') {
      return ['-c:v', 'hevc_nvenc', '-preset', 'fast'];
    }
    if (hardwareAccel === 'intel') {
      return ['-c:v', 'hevc_qsv', '-preset', 'fast'];
    }
    if (hardwareAccel === 'apple') {
      return ['-c:v', 'hevc_videotoolbox'];
    }
    return ['-c:v', 'libx265', '-preset', 'ultrafast', '-crf', '28'];
  } else {
    // H.264
    // Forensic mode: force stable CPU encoder for deterministic quality and compatibility.
    // Hardware encoders can vary by driver/build and may fail with quality flags.
    // CPU encoding: máxima calidad forense
    // CRF 18 = visualmente idéntico al original (rango broadcast/forense)
    // -preset slow = mejor compresión/calidad (los archivos son evidencia, no streaming)
    return [
      '-c:v',
      'libx264',
      '-preset',
      'slow', // Mejor relación calidad/tamaño (evidencia forense, no streaming)
      '-crf',
      String(FORENSIC_H264_CRF), // CRF 14 = calidad forense muy alta (0-51, menor = mejor)
      '-pix_fmt',
      'yuv420p', // Pixel format: requerido para compatibilidad H.264
      '-profile:v',
      'high', // Profile high = mejor compresión que baseline
      '-level',
      '4.1', // Level 4.1 = compatible con reproductores forenses estándar
    ];
  }
};

const normalizePlate = (value = '') =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const isValidPlateValue = (value) => {
  const plate = normalizePlate(value);
  return plate.length >= 5 && plate !== 'NO_PLATE' && plate !== 'ERROR' && plate !== 'UNKNOWN';
};

const applyMultiFrameConsensus = (
  votesMap,
  totalFrames,
  { minHits = 2, strongConfidence = 0.94 } = {}
) => {
  const rows = Array.from(votesMap.entries()).map(([plate, agg]) => ({
    plate,
    hits: agg.hits,
    best: agg.best,
    avg: agg.sum / Math.max(1, agg.hits),
  }));
  rows.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    return b.best - a.best;
  });
  const best = rows[0];
  if (!best) return null;
  const multiFrame = totalFrames > 1;
  const accepted = multiFrame
    ? best.hits >= minHits || best.best >= strongConfidence
    : best.best > 0;
  if (!accepted) return null;
  return {
    plate: best.plate,
    confidence: Math.min(1, Math.max(best.best, best.avg)),
    candidates: rows.map((r) => ({
      text: r.plate,
      confidence: Math.min(1, Math.max(r.best, r.avg)),
      hits: r.hits,
    })),
  };
};

const pickSpreadFrames = (items = [], limit = 20) => {
  if (!Array.isArray(items) || items.length <= limit) return items || [];
  const out = [];
  for (let i = 0; i < limit; i++) {
    const idx = Math.round((i * (items.length - 1)) / Math.max(1, limit - 1));
    out.push(items[idx]);
  }
  return out;
};

const extractPlateWithPlateRecognizer = async (base64Image) => {
  if (!PLATE_RECOGNIZER_TOKEN) {
    return { enabled: false, plate: null, confidence: 0, candidates: [] };
  }

  const raw = String(base64Image || '');
  if (!raw) {
    return { enabled: true, plate: null, confidence: 0, candidates: [] };
  }

  const bytes = Buffer.from(raw, 'base64');
  if (!bytes.length) {
    return { enabled: true, plate: null, confidence: 0, candidates: [] };
  }

  const formData = new FormData();
  formData.append('upload', new Blob([bytes], { type: 'image/jpeg' }), 'frame.jpg');
  formData.append('regions', 'es');

  const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
    method: 'POST',
    headers: {
      Authorization: `Token ${PLATE_RECOGNIZER_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PlateRecognizer ${response.status}: ${message}`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  const candidates = [];

  for (const row of results) {
    const mainPlate = normalizePlate(row?.plate || '');
    const mainScore = Number(row?.score || 0);
    if (mainPlate) {
      candidates.push({ text: mainPlate, confidence: Math.min(1, Math.max(0, mainScore)) });
    }

    const scoreRows = Array.isArray(row?.candidates) ? row.candidates : [];
    for (const c of scoreRows) {
      const plate = normalizePlate(c?.plate || '');
      const score = Number(c?.score || 0);
      if (plate) {
        candidates.push({ text: plate, confidence: Math.min(1, Math.max(0, score)) });
      }
    }
  }

  const dedup = new Map();
  for (const c of candidates) {
    const current = dedup.get(c.text);
    if (!current || current.confidence < c.confidence) {
      dedup.set(c.text, c);
    }
  }
  const normalizedCandidates = [...dedup.values()].sort((a, b) => b.confidence - a.confidence);
  const best =
    normalizedCandidates.find((c) => isValidPlateValue(c.text)) || normalizedCandidates[0] || null;

  return {
    enabled: true,
    plate: best?.text || null,
    confidence: best?.confidence || 0,
    candidates: normalizedCandidates,
  };
};

const isLoopbackRequest = (req) => {
  const remote = req.ip || req.socket?.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
};

const normalizeChannelValue = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const updateRealtimeStats = (patch = {}) => {
  Object.assign(realtimeStats, patch, { updatedAt: new Date().toISOString() });
};

const appendRealtimeHistory = (entry) => {
  realtimeHistory.push({
    ts: Date.now(),
    detections: realtimeStats.detections,
    infractions: realtimeStats.infractions,
    expedients: realtimeStats.expedients,
    activeCameras: realtimeStats.activeCameras,
    ...entry,
  });
  if (realtimeHistory.length > MAX_HISTORY_POINTS) {
    realtimeHistory.splice(0, realtimeHistory.length - MAX_HISTORY_POINTS);
  }
};

const resetRealtimeDetectionsIfNeeded = () => {
  const today = new Date().toDateString();
  if (today === lastRealtimeResetDate) return;
  lastRealtimeResetDate = today;
  updateRealtimeStats({ detections: 0 });
  appendRealtimeHistory({ type: 'daily_reset' });
  broadcastRealtime('stats', { ...realtimeStats });
  console.log('[SENTINEL_SYSTEM] Reset diario de detecciones realtime aplicado (00:00).');
};

const shouldDeliverRealtime = (clientMeta, eventMeta) => {
  if (!clientMeta) return true;
  if (clientMeta.viewerId && eventMeta.viewerId && clientMeta.viewerId !== eventMeta.viewerId) {
    return false;
  }
  if (clientMeta.siteId && eventMeta.siteId && clientMeta.siteId !== eventMeta.siteId) {
    return false;
  }
  return true;
};

const base64UrlDecode = (value = '') => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
};

const verifySignedBearerToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'sentinel' || parts[1] !== 'v1') return null;
  const payloadRaw = parts[2];
  const sig = parts[3];

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadRaw));
  } catch {
    return null;
  }

  const kid = String(payload?.kid || '').trim();
  const exp = Number(payload?.exp || 0);
  if (!kid || !Number.isFinite(exp) || Date.now() > exp * 1000) return null;

  const key = PUBLIC_API_HMAC_KEYS.find((k) => k.kid === kid);
  if (!key) return null;

  const signingInput = `sentinel.v1.${payloadRaw}`;
  const expected = crypto.createHmac('sha256', key.secret).update(signingInput).digest('base64url');

  if (expected !== sig) return null;
  return payload;
};

const broadcastRealtime = (type, payload = {}, meta = {}) => {
  const eventMeta = {
    viewerId: normalizeChannelValue(meta.viewerId),
    siteId: normalizeChannelValue(meta.siteId),
  };
  const message = JSON.stringify({ type, payload, ts: Date.now(), ...eventMeta });
  for (const [ws, clientMeta] of realtimeClients) {
    try {
      if (ws.readyState === 1 && shouldDeliverRealtime(clientMeta, eventMeta)) {
        ws.send(message);
      }
    } catch {}
  }
};

const publicApiGuard = (req, res, next) => {
  const authHeader = String(req.headers.authorization || '');
  const matchesBearer = /^Bearer\s+(.+)$/i.exec(authHeader);
  const token = matchesBearer?.[1]?.trim() || String(req.headers['x-api-key'] || '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

  const signedPayload = verifySignedBearerToken(token);
  const staticTokenAccepted = PUBLIC_API_TOKENS.length && PUBLIC_API_TOKENS.includes(token);
  if (!signedPayload && !staticTokenAccepted) {
    return res.status(401).json({ error: 'Unauthorized token' });
  }

  const tokenFingerprint = crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
  req.publicApi = { tokenFingerprint };
  logger.auditLog(req.method, req.path, 200, {
    scope: 'PUBLIC_API',
    token: tokenFingerprint,
    tokenType: signedPayload ? 'signed' : 'static',
    tokenKid: signedPayload?.kid || null,
    ip: req.ip,
  });
  next();
};

const publicApiRateLimit = (req, res, next) => {
  const tokenFingerprint = req.publicApi?.tokenFingerprint || 'unknown';
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const key = `${tokenFingerprint}:${ip}`;
  const now = Date.now();
  const bucket = publicRateLimitStore.get(key) || {
    count: 0,
    resetAt: now + PUBLIC_API_RATE_LIMIT_WINDOW_MS,
  };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + PUBLIC_API_RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  publicRateLimitStore.set(key, bucket);

  if (bucket.count > PUBLIC_API_RATE_LIMIT_MAX_REQUESTS) {
    logger.warn('PUBLIC_API', 'Rate limit exceeded', { key, path: req.path, ip });
    return res.status(429).json({ error: 'Public API rate limit exceeded' });
  }

  next();
};

const processTransitQueue = async () => {
  if (transitWorkerActive) return;
  transitWorkerActive = true;
  try {
    while (transitQueue.length > 0) {
      const job = transitQueue.shift();
      if (!job) continue;
      const state = transitDeliveryState.get(job.idempotencyKey);
      if (!state || state.status === 'delivered') continue;

      try {
        const response = await fetch(TRANSIT_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Transit-Idempotency-Key': job.idempotencyKey,
          },
          body: JSON.stringify(job.payload || {}),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => `HTTP ${response.status}`);
          throw new Error(detail || `HTTP ${response.status}`);
        }

        transitDeliveryState.set(job.idempotencyKey, {
          ...state,
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
          attempts: job.attempts,
        });
      } catch (error) {
        if (job.attempts < job.maxAttempts) {
          const retryDelayMs = Math.min(10_000, 500 * 2 ** (job.attempts - 1));
          setTimeout(() => {
            transitQueue.push({ ...job, attempts: job.attempts + 1 });
            void processTransitQueue();
          }, retryDelayMs);
          transitDeliveryState.set(job.idempotencyKey, {
            ...state,
            status: 'retrying',
            attempts: job.attempts,
            lastError: error instanceof Error ? error.message : String(error),
          });
        } else {
          transitDeliveryState.set(job.idempotencyKey, {
            ...state,
            status: 'failed',
            attempts: job.attempts,
            lastError: error instanceof Error ? error.message : String(error),
            failedAt: new Date().toISOString(),
          });
        }
      }
    }
  } finally {
    transitWorkerActive = false;
  }
};

const cleanupExpiredIpCameraSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of ipCameraSessions.entries()) {
    if (session.expiresAt <= now) {
      ipCameraSessions.delete(sessionId);
    }
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    try {
      const parsed = new URL(origin);
      const isLoopback =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1';
      if (isLoopback || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
    } catch {
      // Fall through and reject invalid origins.
    }
    callback(new Error('Origin no permitido por CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const apiGuard = (req, res, next) => {
  const origin = req.headers.origin;
  const hasOrigin = typeof origin === 'string' && origin.length > 0;
  let isLoopbackOrigin = false;
  if (hasOrigin) {
    try {
      const parsed = new URL(origin);
      isLoopbackOrigin =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1';
    } catch {
      isLoopbackOrigin = false;
    }
  }

  // Validar origen CORS.
  if (hasOrigin && !isLoopbackOrigin && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn('AUTH', `CORS origin rechazado: ${origin}`, { ip: req.ip });
    res.status(403).json({ error: 'Origin no permitido.' });
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    req.user = { authenticated: true, ip: req.ip, isTest: true };
    next();
    return;
  }

  // Preserve desktop/dev compatibility: allow loopback and no-origin traffic.
  if (!hasOrigin || isLoopbackOrigin) {
    req.user = { authenticated: true, ip: req.ip, isLocalhost: true };
    next();
    return;
  }

  if (!API_TOKEN) {
    logger.error('AUTH', 'SENTINEL_API_TOKEN no configurado para origen externo', {
      origin,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(500).json({ error: 'Server auth misconfigured.' });
    return;
  }

  // Require token for non-loopback origins.
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const expectedToken = API_TOKEN;

  if (!provided || provided !== expectedToken) {
    logger.warn('AUTH', 'Intento de acceso sin token válido', {
      origin,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ error: 'Token inválido o faltante.' });
    return;
  }

  // Logging de acceso autorizado
  req.user = { authenticated: true, ip: req.ip };
  next();
};

const rateLimitApi = (req, res, next) => {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  rateLimitStore.set(key, bucket);

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'Rate limit excedido.' });
    return;
  }

  next();
};

const requireTranscodeSlot = (res) => {
  if (activeTranscodes >= MAX_TRANSCODE_CONCURRENCY) {
    res.status(429).json({ error: 'Demasiadas transcodificaciones simultáneas.' });
    return false;
  }

  activeTranscodes += 1;
  return true;
};

const releaseTranscodeSlot = () => {
  activeTranscodes = Math.max(0, activeTranscodes - 1);
};

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
};

// Delegate to shared, testable security utilities
const finalizeFilename = sanitizeFilename;
const validateCameraHost = (hostname) => _validateCameraHost(hostname, ALLOWED_CAMERA_HOSTS);

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for image forensics
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', apiGuard, rateLimitApi);

// Middleware de auditoría para todas las requests API
app.use('/api', (req, res, next) => {
  const original = res.json;
  res.json = function (data) {
    logger.auditLog(req.method, req.path, res.statusCode, {
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
    });
    return original.call(this, data);
  };
  next();
});

const upload = multer({ dest: os.tmpdir() });

app.post('/api/transcode', upload.single('video'), async (req, res) => {
  if (!requireTranscodeSlot(res)) return;

  const jobId = req.query.id || `job_${Date.now()}`;

  // Validar jobId
  if (typeof jobId !== 'string' || jobId.length > 100) {
    logger.validationError('TRANSCODE', 'jobId', 'Longitud inválida', jobId);
    releaseTranscodeSlot();
    return res.status(400).json({ error: 'Job ID inválido' });
  }

  // Validar codec de salida si se especifica
  const outputCodec = req.query.outputCodec || 'h264';
  if (!validators.isValidCodec(outputCodec)) {
    logger.validationError('TRANSCODE', 'outputCodec', 'Codec no soportado', outputCodec);
    releaseTranscodeSlot();
    return res.status(400).json({ error: 'Codec de salida inválido' });
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `sentinel_input_${timestamp}.mp4`);
  const outputPath = path.join(tmpDir, `sentinel_output_${timestamp}.mp4`);
  const writer = fs.createWriteStream(inputPath);
  let receivedBytes = 0;
  let settled = false;

  const finish = (status, payload) => {
    if (settled || res.headersSent) return;
    settled = true;
    progressMap.delete(jobId);
    safeUnlink(inputPath);
    safeUnlink(outputPath);
    releaseTranscodeSlot();
    logger.auditLog('POST', '/api/transcode', status, { jobId, outputCodec });
    res.status(status).json(payload);
  };

  req.on('aborted', () => {
    progressMap.delete(jobId);
    safeUnlink(inputPath);
    safeUnlink(outputPath);
    releaseTranscodeSlot();
  });

  req.on('data', (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_TRANSCODE_BYTES) {
      writer.destroy();
      req.destroy(new Error('Payload demasiado grande para transcodificación.'));
      return;
    }
    writer.write(chunk);
  });

  req.on('error', (error) => {
    finish(413, { error: error instanceof Error ? error.message : 'Error leyendo video' });
  });

  req.on('end', async () => {
    writer.end();

    if (!fs.existsSync(inputPath)) {
      finish(400, { error: 'No se recibió video válido.' });
      return;
    }

    let durationSec = 0;
    let inputCodec = 'unknown';
    try {
      const ffprobeCmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
      const output = execSync(ffprobeCmd).toString().trim();
      durationSec = parseFloat(output);
      logger.info('TRANSCODE', `Duración detectada: ${durationSec}s`, { jobId });

      inputCodec = await getInputCodec(inputPath);

      // Validar codec detectado
      if (!['h264', 'h265', 'hevc', 'unknown'].includes(inputCodec)) {
        logger.warn('TRANSCODE', `Codec no reconocido: ${inputCodec}`, { jobId });
        inputCodec = 'unknown';
      }

      logger.info('TRANSCODE', `Codec detectado: ${inputCodec}`, { jobId });
    } catch (error) {
      logger.errorWithContext('TRANSCODE_PROBE', error, { jobId });
      // Continuar con valores default
    }

    // Skip transcoding if input is already H.264
    if (inputCodec === 'h264') {
      logger.info('TRANSCODE', `H.264 detectado. Saltando transcodificación (copy stream).`, {
        jobId,
      });
      const ffmpeg = spawn(ffmpegPath, [
        '-i',
        inputPath,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-y',
        outputPath,
      ]);

      ffmpeg.on('close', (code) => {
        safeUnlink(inputPath);
        if (code !== 0) {
          finish(500, { error: 'Stream copy failed' });
          return;
        }
        progressMap.set(jobId, 100);
        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', stat.size);
        const readStream = fs.createReadStream(outputPath);
        readStream.pipe(res);
        readStream.on('end', () => {
          safeUnlink(outputPath);
          setTimeout(() => progressMap.delete(jobId), 10_000);
          if (!settled) {
            settled = true;
            releaseTranscodeSlot();
          }
        });
      });
      return;
    }

    console.log(
      `[TRANSCODE] [${jobId}] Iniciando transcodificación (aceleración: ${hardwareAccel})...`
    );
    progressMap.set(jobId, 0);

    const encoderArgs = getEncoderArgs('h264');
    const ffmpegArgs = [
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      // Preserve resolution without resampling: only pad if odd dimensions.
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      ...encoderArgs,
      // Audio: AAC for compatibility
      '-c:a',
      'aac',
      '-b:a',
      '128k', // Audio bitrate
      // MP4 format flags
      '-movflags',
      '+faststart', // Enable streaming/progressive download
      '-y', // Overwrite output
      outputPath,
    ];

    let ffmpegErr = '';
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString();
      ffmpegErr += text;
      if (ffmpegErr.length > 12000) ffmpegErr = ffmpegErr.slice(-12000);
      const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && durationSec > 0) {
        const currentSec =
          parseFloat(timeMatch[1]) * 3600 +
          parseFloat(timeMatch[2]) * 60 +
          parseFloat(timeMatch[3]);
        const progress = Math.min(Math.round((currentSec / durationSec) * 100), 99);
        progressMap.set(jobId, progress);
      }
    });

    ffmpeg.on('error', () => {
      finish(500, { error: 'FFmpeg not found or execution error' });
    });

    ffmpeg.on('close', (code) => {
      safeUnlink(inputPath);
      if (code !== 0) {
        console.error(
          `[TRANSCODE] [${jobId}] FFmpeg failed with code ${code}. Tail:\n${ffmpegErr.slice(-2000)}`
        );
        finish(500, { error: 'Transcoding failed', detail: ffmpegErr.slice(-500) });
        return;
      }

      progressMap.set(jobId, 100);
      const stat = fs.statSync(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);

      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);
      readStream.on('end', () => {
        safeUnlink(outputPath);
        setTimeout(() => progressMap.delete(jobId), 10_000);
        if (!settled) {
          settled = true;
          releaseTranscodeSlot();
        }
      });
      readStream.on('error', () => {
        finish(500, { error: 'Error streaming transcoded video' });
      });
    });
  });
});

app.get('/api/transcode/progress', (req, res) => {
  const jobId = req.query.id || '';
  const progress = progressMap.get(jobId) ?? (jobId ? 0 : -1);
  res.json({ progress });
});

app.get('/api/transcode/status', (req, res) => {
  res.json({ available: true, ffmpeg: ffmpegPath });
});

app.post('/api/ai/geometry', async (req, res) => {
  try {
    const body = req.body || {};

    // Validar entrada
    if (typeof body.directives !== 'string' && body.directives !== undefined) {
      logger.validationError('AI_GEOMETRY', 'directives', 'Debe ser string', body.directives);
      return res.status(400).json({ error: 'Las directivas deben ser texto.' });
    }

    if (typeof body.instruction !== 'string' && body.instruction !== undefined) {
      logger.validationError('AI_GEOMETRY', 'instruction', 'Debe ser string', body.instruction);
      return res.status(400).json({ error: 'La instrucción debe ser texto.' });
    }

    if (body.image !== undefined && typeof body.image !== 'string') {
      logger.validationError('AI_GEOMETRY', 'image', 'Debe ser string base64', typeof body.image);
      return res.status(400).json({ error: 'La imagen debe estar en formato base64.' });
    }

    // Validar tamaño de imagen (máximo 5MB)
    if (body.image && body.image.length > 5 * 1024 * 1024) {
      logger.validationError('AI_GEOMETRY', 'image', 'Tamaño excesivo', 'base64 image');
      return res.status(413).json({ error: 'La imagen excede 5MB.' });
    }

    const result = await generateGeometryWithGemini(body);
    res.json(result);
  } catch (error) {
    logger.errorWithContext('API_AI_GEOMETRY', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error generando geometría',
    });
  }
});

app.post('/api/ai/audit', async (req, res) => {
  try {
    const body = req.body || {};

    // Validar estructura básica de track
    if (!validators.isValidTrack(body.track)) {
      logger.validationError('AI_AUDIT', 'track', 'Estructura de track inválida', body.track);
      return res.status(400).json({ error: 'Track inválido o faltante.' });
    }

    // Validar geometría de línea
    if (!body.line || typeof body.line !== 'object') {
      logger.validationError('AI_AUDIT', 'line', 'Línea requerida', body.line);
      return res.status(400).json({ error: 'Línea de geometría requerida.' });
    }

    if (!validators.isValidGeometry(body.line)) {
      logger.validationError('AI_AUDIT', 'line', 'Geometría inválida', body.line);
      return res.status(400).json({ error: 'Geometría de línea inválida (coordenadas 0-1).' });
    }

    // Validar directivas
    if (typeof body.directives !== 'string') {
      logger.validationError('AI_AUDIT', 'directives', 'Debe ser string', body.directives);
      return res.status(400).json({ error: 'Directivas deben ser texto.' });
    }

    // Validar audit preset
    const validPresets = ['standard', 'strict', 'permissive'];
    if (body.auditPreset && !validPresets.includes(body.auditPreset)) {
      logger.validationError('AI_AUDIT', 'auditPreset', 'Preset no válido', body.auditPreset);
      return res.status(400).json({ error: `Preset debe ser uno de: ${validPresets.join(', ')}` });
    }

    const result = await analyzeTrajectoryWithGemini(body);
    res.json(result);
  } catch (error) {
    logger.errorWithContext('API_AI_AUDIT', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error analizando trayectoria',
    });
  }
});

// ============= IMAGE ENHANCEMENT =============

/**
 * POST /api/images/enhance
 * Enhance images for OCR: HR upsampling + preprocessing
 *
 * Body:
 * {
 *   image?: string (single base64 image),
 *   images?: string[] (multiple base64 images),
 *   target_height?: number (default 600, height for upsampling)
 * }
 *
 * Response: {enhanced, metadata, error?} or {enhanced_images, metadata[], ...}
 */
app.post('/api/images/enhance', async (req, res) => {
  try {
    const {
      image,
      images,
      target_height = 600,
      profile = 'forensic_safe',
      dual_output = false,
    } = req.body;

    // Validations
    if (!image && !images) {
      return res.status(400).json({
        error: 'At least one image required (image or images array)',
      });
    }

    if (images && (!Array.isArray(images) || images.length === 0)) {
      return res.status(400).json({
        error: 'images must be a non-empty array of base64 strings',
      });
    }

    if (target_height < 200 || target_height > 2000) {
      return res.status(400).json({
        error: 'target_height must be between 200 and 2000',
      });
    }

    if (!['forensic_safe', 'visual_aggressive'].includes(profile)) {
      return res.status(400).json({
        error: 'profile must be forensic_safe or visual_aggressive',
      });
    }

    logger.info(
      'API_IMAGES_ENHANCE',
      `Enhancing ${images ? images.length : 1} image(s) profile=${profile} dual=${dual_output}`
    );

    let result;

    try {
      if (images && images.length > 1) {
        // Batch enhance
        result = await enhanceImagesForOCR(images, target_height, profile);
        logger.info(
          'API_IMAGES_ENHANCE',
          `Batch complete: ${result.success_count}/${result.total} enhanced`
        );
      } else {
        // Single enhance
        const singleImage = image || (images && images[0]);
        if (dual_output) {
          result = await enhanceImageDualForOCR(singleImage, target_height);
        } else {
          result = await enhanceImageForOCR(singleImage, target_height, profile);
        }

        if (!dual_output && result.error) {
          logger.warn('API_IMAGES_ENHANCE', `Enhancement warning: ${result.error}`);
          // Don't fail on enhancement warning - return raw image instead
          return res.json({
            enhanced: image || (images && images[0]),
            metadata: { method: 'raw_fallback', reason: 'enhancement_failed' },
            error: result.error,
          });
        }
      }

      res.json(result);
    } catch (enhanceError) {
      // Enhancement service failed - return raw images as fallback
      logger.warn(
        'API_IMAGES_ENHANCE',
        `Enhancement service unavailable, returning raw images: ${enhanceError.message}`
      );

      if (images && images.length > 1) {
        res.json({
          enhanced_images: images,
          metadata: images.map(() => ({
            method: 'raw_fallback',
            reason: 'enhancement_unavailable'
          })),
          success_count: images.length,
          total: images.length,
          warning: 'Enhancement service unavailable, returning raw images',
        });
      } else {
        res.json({
          enhanced: image || (images && images[0]),
          metadata: { method: 'raw_fallback', reason: 'enhancement_unavailable' },
          warning: 'Enhancement service unavailable, returning raw image',
        });
      }
    }
  } catch (error) {
    logger.errorWithContext('API_IMAGES_ENHANCE', error);
    // Even on total failure, try to return raw image instead of 500 error
    const rawImage = req.body?.image || (Array.isArray(req.body?.images) ? req.body.images[0] : null);
    if (rawImage) {
      return res.json({
        enhanced: rawImage,
        metadata: { method: 'raw_fallback', reason: 'service_error' },
        warning: 'Enhancement service error, returning raw image',
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error enhancing images',
      enhanced: null,
    });
  }
});

// OCR endpoint: Plate Recognizer (main) -> PaddleOCR (backup) -> Gemini (last backup)
// Supports both single image and multiple images for higher accuracy
app.post('/api/ocr/plate', async (req, res) => {
  try {
    const { image, images, zoomFrames, vehicleDetections } = req.body;

    // Support multiple sources: normal frames or zoom frames
    let imagesToProcess = [];

    // Priority: use zoom frames if available (already focused on vehicle)
    if (zoomFrames && Array.isArray(zoomFrames) && zoomFrames.length > 0) {
      imagesToProcess = zoomFrames.filter((img) => img && typeof img === 'string');
      logger.info('API_OCR_PLATE', `Using ${imagesToProcess.length} zoom frames for OCR`);
    } else if (images && Array.isArray(images)) {
      imagesToProcess = images.filter((img) => img && typeof img === 'string');
    } else if (image && typeof image === 'string') {
      imagesToProcess = [image];
    }

    if (imagesToProcess.length === 0) {
      return res.status(400).json({ error: 'At least one base64 image required' });
    }

    // Sample best frames for OCR (prioritize quality)
    const sampledFrames = pickSpreadFrames(imagesToProcess, 20);
    logger.info('API_OCR_PLATE', `OCR processing ${sampledFrames.length} frames with Gemini Vision`);

    // Primary Strategy: Gemini Vision (multimodal, excellent for text/plates)
    // Process frames in parallel for speed
    const geminiResults = await Promise.all(
      sampledFrames.slice(0, 8).map((frame) =>
        extractLicensePlateWithGemini(frame)
          .then((result) => {
            const plate = normalizePlate(result?.plate || '');
            return isValidPlateValue(plate)
              ? {
                  text: plate,
                  confidence: Math.min(1, Number(result?.confidence || 0.85)),
                }
              : null;
          })
          .catch(() => null)
      )
    );

    const validGeminiResults = geminiResults.filter(Boolean);

    if (validGeminiResults.length > 0) {
      // Consensus: most common plate wins
      const plateCounts = new Map();
      for (const result of validGeminiResults) {
        const count = (plateCounts.get(result.text) || 0) + 1;
        plateCounts.set(result.text, count);
      }

      const bestPlate = Array.from(plateCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const confidence = 0.92 + (validGeminiResults.length > 3 ? 0.05 : 0);

      logger.info('API_OCR_PLATE', `✓ Detected plate via Gemini Vision: ${bestPlate} (${validGeminiResults.length} confirmations)`);
      return res.json({
        plate: bestPlate,
        confidence: Math.min(0.98, confidence),
        candidates: validGeminiResults,
        method: 'gemini_vision_multiframe_consensus',
        detections: validGeminiResults.length,
      });
    }

    logger.warn('API_OCR_PLATE', 'Gemini Vision returned no valid plates, trying PaddleOCR fallback');

    // Fallback 1: PaddleOCR (faster, works locally)
    try {
      const paddleResult = await extractLicensePlateFromPaddle(sampledFrames);
      const paddleVotes = new Map();
      const paddleCandidates = Array.isArray(paddleResult?.candidates) ? paddleResult.candidates : [];

      for (const c of paddleCandidates) {
        const plate = normalizePlate(c?.text || c?.plate || c || '');
        const conf = Number(c?.confidence || 0);
        if (!isValidPlateValue(plate)) continue;
        const prev = paddleVotes.get(plate) || { hits: 0, best: 0, sum: 0 };
        prev.hits += 1;
        prev.best = Math.max(prev.best, conf);
        prev.sum += conf;
        paddleVotes.set(plate, prev);
      }

      const mainPaddlePlate = normalizePlate(paddleResult?.plate || '');
      if (isValidPlateValue(mainPaddlePlate)) {
        const conf = Number(paddleResult?.confidence || 0);
        const prev = paddleVotes.get(mainPaddlePlate) || { hits: 0, best: 0, sum: 0 };
        prev.hits += 1;
        prev.best = Math.max(prev.best, conf);
        prev.sum += conf;
        paddleVotes.set(mainPaddlePlate, prev);
      }

      const paddleConsensus = applyMultiFrameConsensus(paddleVotes, sampledFrames.length);
      if (paddleConsensus) {
        logger.info('API_OCR_PLATE', `✓ Detected plate via PaddleOCR: ${paddleConsensus.plate}`);
        return res.json({
          plate: paddleConsensus.plate,
          candidates: paddleConsensus.candidates,
          confidence: paddleConsensus.confidence,
          method: 'paddle_consensus_multiframe',
        });
      }
    } catch (paddleError) {
      logger.debug('API_OCR_PLATE', `PaddleOCR fallback attempt: ${paddleError instanceof Error ? paddleError.message : 'unknown error'}`);
    }

    // Final Fallback: Gemini on best single frame
    try {
      logger.info('API_OCR_PLATE', 'Final fallback: Gemini Vision single frame');
      const bestFrame = sampledFrames[Math.floor(sampledFrames.length / 2)];
      const finalResult = await extractLicensePlateWithGemini(bestFrame);
      const plate = normalizePlate(finalResult?.plate || '');

      if (isValidPlateValue(plate)) {
        logger.info('API_OCR_PLATE', `✓ Recovered plate via Gemini final fallback: ${plate}`);
        return res.json({
          plate: plate,
          confidence: 0.85,
          candidates: [{ text: plate, confidence: 0.85 }],
          method: 'gemini_vision_single_frame_fallback',
        });
      }
    } catch (finalError) {
      logger.debug('API_OCR_PLATE', `Final fallback failed: ${finalError instanceof Error ? finalError.message : 'unknown error'}`);
    }

    // No plate detected by any method
    logger.warn('API_OCR_PLATE', 'No valid plate detected after all OCR attempts');
    res.json({
      plate: null,
      confidence: 0,
      candidates: [],
      method: 'none_detected',
    });
  } catch (error) {
    logger.errorWithContext('API_OCR_PLATE', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error extracting license plate',
    });
  }
});

// OCR confirmation fallback using Gemini Vision.
// Used as specialized backup when PaddleOCR returns no valid plate.
app.post('/api/ocr/plate-confirm', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Base64 image required' });
    }

    const result = await extractLicensePlateWithGemini(image);
    const plate = String(result?.plate || 'NO_PLATE').toUpperCase();
    const confidence = Number(result?.confidence || 0);

    res.json({
      plate: plate === 'NO_PLATE' || plate === 'ERROR' ? null : plate,
      confidence,
      method: 'gemini_confirm',
      candidates:
        plate && plate !== 'NO_PLATE' && plate !== 'ERROR' ? [{ text: plate, confidence }] : [],
    });
  } catch (error) {
    logger.errorWithContext('API_OCR_PLATE_CONFIRM', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error confirming license plate',
    });
  }
});

/**
 * Hybrid YOLO + Gemini License Plate OCR
 * Uses YOLO to detect plate location, then Gemini to read text
 * Better accuracy for challenging angles/lighting
 */
app.post('/api/ocr/plate-yolo-hybrid', async (req, res) => {
  try {
    const { image, images, zoomFrames } = req.body;

    // Collect frames
    let imagesToProcess = [];
    if (zoomFrames && Array.isArray(zoomFrames) && zoomFrames.length > 0) {
      imagesToProcess = zoomFrames.filter((img) => img && typeof img === 'string');
      logger.info('YOLO_HYBRID', `Using ${imagesToProcess.length} zoom frames`);
    } else if (images && Array.isArray(images)) {
      imagesToProcess = images.filter((img) => img && typeof img === 'string');
    } else if (image && typeof image === 'string') {
      imagesToProcess = [image];
    }

    if (imagesToProcess.length === 0) {
      return res.status(400).json({ error: 'At least one base64 image required' });
    }

    // Sample frames
    const sampledFrames = pickSpreadFrames(imagesToProcess, 15);
    logger.info('YOLO_HYBRID', `Detecting plates with YOLO in ${sampledFrames.length} frames`);

    // Phase 1: YOLO Plate Detection
    let bestYoloDetection = null;
    let bestYoloFrame = null;
    let bestYoloConfidence = 0;

    for (let i = 0; i < sampledFrames.length; i++) {
      const frame = sampledFrames[i];
      try {
        const yoloResult = await detectPlateWithYOLO(frame);
        if (yoloResult?.plate_box && yoloResult.confidence > bestYoloConfidence) {
          bestYoloConfidence = yoloResult.confidence;
          bestYoloDetection = yoloResult.plate_box;
          bestYoloFrame = frame;
        }
      } catch (err) {
        logger.debug('YOLO_HYBRID', `YOLO frame ${i} error: ${err.message}`);
      }
    }

    if (bestYoloDetection && bestYoloConfidence > 0.4) {
      logger.info(
        'YOLO_HYBRID',
        `✓ YOLO detected plate: conf=${bestYoloConfidence}, box=(${bestYoloDetection.x},${bestYoloDetection.y})`
      );

      // Phase 2: Extract plate region and read with Gemini
      try {
        // For now, use the best frame with YOLO detection
        // Client-side would crop the region, we'll use the best frame
        const geminiResult = await extractLicensePlateWithGemini(bestYoloFrame);
        const plate = normalizePlate(geminiResult?.plate || '');

        if (isValidPlateValue(plate)) {
          logger.info('YOLO_HYBRID', `✓ YOLO+Gemini extracted plate: ${plate}`);
          return res.json({
            plate: plate,
            confidence: Math.min(0.98, bestYoloConfidence + 0.15),
            plate_box: bestYoloDetection,
            candidates: [{ text: plate, confidence: 0.95 }],
            method: 'yolo_detection_gemini_ocr',
            yolo_confidence: bestYoloConfidence,
          });
        }
      } catch (geminiErr) {
        logger.debug('YOLO_HYBRID', `Gemini read failed: ${geminiErr.message}`);
      }

      // Fallback: Use PaddleOCR on detected region
      try {
        logger.info('YOLO_HYBRID', 'Falling back to PaddleOCR on YOLO detection');
        const paddleResult = await extractLicensePlateFromPaddle([bestYoloFrame]);
        const plate = normalizePlate(paddleResult?.plate || '');

        if (isValidPlateValue(plate)) {
          logger.info('YOLO_HYBRID', `✓ YOLO+PaddleOCR extracted plate: ${plate}`);
          return res.json({
            plate: plate,
            confidence: Math.min(0.95, bestYoloConfidence + 0.10),
            plate_box: bestYoloDetection,
            candidates: [{ text: plate, confidence: 0.90 }],
            method: 'yolo_detection_paddle_ocr',
            yolo_confidence: bestYoloConfidence,
          });
        }
      } catch (paddleErr) {
        logger.debug('YOLO_HYBRID', `PaddleOCR fallback failed: ${paddleErr.message}`);
      }
    } else {
      logger.warn('YOLO_HYBRID', 'YOLO plate detection failed, falling back to standard Gemini');
    }

    // Fallback to standard Gemini pipeline (no YOLO detection)
    logger.info('YOLO_HYBRID', 'Falling back to standard Gemini OCR pipeline');
    const geminiResults = await Promise.all(
      sampledFrames.slice(0, 5).map((frame) =>
        extractLicensePlateWithGemini(frame)
          .then((result) => {
            const plate = normalizePlate(result?.plate || '');
            return isValidPlateValue(plate)
              ? { text: plate, confidence: Math.min(1, Number(result?.confidence || 0.80)) }
              : null;
          })
          .catch(() => null)
      )
    );

    const validGeminiResults = geminiResults.filter(Boolean);
    if (validGeminiResults.length > 0) {
      const plateCounts = new Map();
      for (const result of validGeminiResults) {
        const count = (plateCounts.get(result.text) || 0) + 1;
        plateCounts.set(result.text, count);
      }

      const bestPlate = Array.from(plateCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      logger.info('YOLO_HYBRID', `✓ Gemini fallback extracted plate: ${bestPlate}`);

      return res.json({
        plate: bestPlate,
        confidence: 0.85,
        candidates: validGeminiResults,
        method: 'gemini_fallback_no_yolo_detection',
      });
    }

    // Complete failure
    logger.warn('YOLO_HYBRID', 'No plate detected by any method');
    res.json({
      plate: null,
      confidence: 0,
      candidates: [],
      method: 'none_detected',
    });
  } catch (error) {
    logger.errorWithContext('YOLO_HYBRID_OCR', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error in hybrid OCR',
    });
  }
});

app.post('/api/remux-copy', async (req, res) => {
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `sentinel_remux_input_${timestamp}.mp4`);
  const outputPath = path.join(tmpDir, `sentinel_remux_output_${timestamp}.mp4`);
  const writer = fs.createWriteStream(inputPath);
  let receivedBytes = 0;
  let settled = false;

  const finish = (status, payload) => {
    if (settled || res.headersSent) return;
    settled = true;
    safeUnlink(inputPath);
    safeUnlink(outputPath);
    res.status(status).json(payload);
  };

  req.on('aborted', () => {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  });

  req.on('data', (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_TRANSCODE_BYTES) {
      writer.destroy();
      req.destroy(new Error('Payload demasiado grande para remux.'));
      return;
    }
    writer.write(chunk);
  });

  req.on('error', (error) => {
    finish(413, { error: error instanceof Error ? error.message : 'Error leyendo video' });
  });

  req.on('end', async () => {
    writer.end();
    if (!fs.existsSync(inputPath)) {
      finish(400, { error: 'No se recibió video válido.' });
      return;
    }

    const ffmpeg = spawn(ffmpegPath, [
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ]);

    let ffmpegErr = '';
    ffmpeg.stderr.on('data', (data) => {
      ffmpegErr += data.toString();
      if (ffmpegErr.length > 8000) ffmpegErr = ffmpegErr.slice(-8000);
    });

    ffmpeg.on('error', () => {
      finish(500, { error: 'FFmpeg not found or execution error' });
    });

    ffmpeg.on('close', (code) => {
      safeUnlink(inputPath);
      if (code !== 0 || !fs.existsSync(outputPath)) {
        finish(500, { error: 'Remux failed', detail: ffmpegErr.slice(-500) });
        return;
      }

      const stat = fs.statSync(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);
      readStream.on('end', () => {
        safeUnlink(outputPath);
      });
      readStream.on('error', () => {
        finish(500, { error: 'Error streaming remuxed video' });
      });
    });
  });
});

// Optional plate-region endpoint used by client-side OCR probing.
// If explicit plate localization is not available, return a neutral payload
// instead of 404 so the client can continue its fallback OCR flow silently.
app.post('/api/ocr/detect-plate-region', async (_req, res) => {
  try {
    res.json({ x: null, y: null, width: null, height: null, confidence: 0 });
  } catch (error) {
    logger.errorWithContext('API_OCR_PLATE_REGION', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error detecting plate region',
    });
  }
});

// OSD Timestamp extraction endpoint
// Extracts date/time from top-left corner of video frame using PaddleOCR
app.post('/api/ocr/timestamp', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Base64 image required' });
    }

    const result = await extractTimestampFromPaddle(image);
    res.json(result);
  } catch (error) {
    logger.errorWithContext('API_OCR_TIMESTAMP', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error extracting timestamp',
    });
  }
});

// Boletín de denuncia generation endpoint
// Generates formal infraction report PDF
app.post('/api/boletin/generate', async (req, res) => {
  try {
    const { plate, infractionType, timestamp, location, description, severity, makeModel, color } =
      req.body;

    if (!plate || !infractionType) {
      return res.status(400).json({ error: 'Plate and infractionType required' });
    }

    const pdfBuffer = generateBoletin({
      plate,
      infractionType,
      timestamp,
      location: location || 'Ubicación no disponible',
      description,
      severity: severity || 'MEDIUM',
      makeModel,
      color,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Boletin_${plate}_${Date.now()}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    logger.errorWithContext('API_BOLETIN_GENERATE', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error generating boletín',
    });
  }
});

app.post('/api/ip-camera/session', async (req, res) => {
  cleanupExpiredIpCameraSessions();

  const { url, username, password } = req.body || {};
  if (typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ error: 'URL de cámara IP no válida.' });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: 'URL de cámara IP no válida.' });
    return;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    res.status(400).json({
      error: 'Solo se admiten streams HTTP/HTTPS a través del proxy seguro.',
    });
    return;
  }

  try {
    const allowed = await validateCameraHost(parsedUrl.hostname);
    if (!allowed) {
      res.status(403).json({
        error: 'Host de cámara IP no permitido por la política del servidor.',
      });
      return;
    }
  } catch {
    res.status(400).json({ error: 'No se pudo resolver el host de la cámara IP.' });
    return;
  }

  const sessionId = crypto.randomUUID();
  ipCameraSessions.set(sessionId, {
    url: parsedUrl.toString(),
    username: typeof username === 'string' ? username : '',
    password: typeof password === 'string' ? password : '',
    expiresAt: Date.now() + IP_CAMERA_SESSION_TTL_MS,
  });
  updateRealtimeStats({ activeCameras: ipCameraSessions.size });
  broadcastRealtime('camera_session_created', { sessionId });

  res.json({
    sessionId,
    streamUrl: `/api/ip-camera/stream/${sessionId}`,
  });
});

app.get('/api/ip-camera/sessions', (_req, res) => {
  cleanupExpiredIpCameraSessions();
  const sessions = [...ipCameraSessions.entries()].map(([sessionId, session]) => ({
    sessionId,
    url: session.url,
    expiresAt: session.expiresAt,
  }));
  updateRealtimeStats({ activeCameras: sessions.length });
  res.json({ count: sessions.length, sessions });
});

app.delete('/api/ip-camera/session/:sessionId', (req, res) => {
  const deleted = ipCameraSessions.delete(req.params.sessionId);
  updateRealtimeStats({ activeCameras: ipCameraSessions.size });
  if (deleted) broadcastRealtime('camera_session_deleted', { sessionId: req.params.sessionId });
  res.json({ deleted });
});

app.get('/api/ip-camera/stream/:sessionId', async (req, res) => {
  cleanupExpiredIpCameraSessions();

  const session = ipCameraSessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Sesión de cámara IP no encontrada o expirada.' });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const headers = {};
    if (session.username || session.password) {
      headers.Authorization = `Basic ${Buffer.from(`${session.username}:${session.password}`).toString('base64')}`;
    }

    const upstream = await fetch(session.url, {
      headers,
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `La cámara IP respondió con ${upstream.status}.` });
      return;
    }

    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/octet-stream'
    );
    res.setHeader('Cache-Control', 'no-store');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'No se pudo abrir la cámara IP',
      });
    }
  }
});

app.post(
  '/api/reports/save',
  express.raw({ type: 'application/pdf', limit: `${MAX_REPORT_MB}mb` }),
  (req, res) => {
    try {
      const folderDate = req.query.date
        ? sanitizeFilename(req.query.date)
        : new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const dailyDir = path.join(REPORTS_DIR, folderDate);
      fs.mkdirSync(dailyDir, { recursive: true });
      const safeFilename = finalizeFilename(
        req.query.filename || `Sentinel_Report_${Date.now()}.pdf`,
        '.pdf'
      );
      const targetPath = path.join(dailyDir, safeFilename);
      if (!isPathWithinDir(targetPath, REPORTS_DIR)) {
        res.status(403).json({ saved: false, error: 'Ruta de archivo no permitida.' });
        return;
      }
      fs.writeFileSync(targetPath, req.body);
      res.json({ saved: true, path: targetPath });
    } catch (error) {
      res.status(500).json({
        saved: false,
        error: error instanceof Error ? error.message : 'Failed to save PDF',
      });
    }
  }
);

app.post(
  '/api/reports/video',
  express.raw({
    type: ['video/mp4', 'video/webm', 'application/octet-stream'],
    limit: `${MAX_REPORT_MB}mb`,
  }),
  async (req, res) => {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const tempInputPath = path.join(tmpDir, `sentinel_evidence_raw_${timestamp}`);
    let targetPath = '';

    try {
      const folderDate = req.query.date
        ? sanitizeFilename(req.query.date)
        : new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const dailyDir = path.join(REPORTS_DIR, folderDate);
      fs.mkdirSync(dailyDir, { recursive: true });

      const safeFilename = finalizeFilename(
        req.query.filename || `Evidence_${timestamp}.mp4`,
        '.mp4'
      );
      targetPath = path.join(dailyDir, safeFilename);

      if (!isPathWithinDir(targetPath, REPORTS_DIR)) {
        res.status(403).json({ saved: false, error: 'Ruta de archivo no permitida.' });
        return;
      }

      // 1. Write raw buffer to temp file
      fs.writeFileSync(tempInputPath, req.body);

      // 2. Detect input codec and transcode if needed
      if (ffmpegPath) {
        let inputCodec = 'unknown';
        try {
          inputCodec = await getInputCodec(tempInputPath);
        } catch {
          // Fallback to unknown
        }

        // Skip transcoding if input is already H.264
        if (inputCodec === 'h264') {
          console.log(
            `[EVIDENCE] H.264 detectado. Copiando stream (sin transcodificación): ${safeFilename}`
          );
          const ffmpeg = spawnSync(ffmpegPath, [
            '-i',
            tempInputPath,
            '-c:v',
            'copy',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            '-y',
            targetPath,
          ]);

          if (ffmpeg.status === 0) {
            res.json({ saved: true, path: targetPath, transcoded: false, codec: inputCodec });
          } else {
            console.error('[EVIDENCE] Error copiando stream, intentando transcodificar...');
            // Fallthrough to normal transcode
          }
        } else {
          // Transcode with hardware acceleration
          console.log(
            `[EVIDENCE] Transcodificando evidencia a MP4 (aceleración: ${hardwareAccel}): ${safeFilename}`
          );
          const encoderArgs = getEncoderArgs('h264');
          const ffmpeg = spawnSync(ffmpegPath, [
            '-i',
            tempInputPath,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-vf',
            'pad=ceil(iw/2)*2:ceil(ih/2)*2',
            ...encoderArgs,
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            '-y',
            targetPath,
          ]);

          if (ffmpeg.status === 0) {
            res.json({ saved: true, path: targetPath, transcoded: true, codec: inputCodec });
          } else {
            console.error(
              '[EVIDENCE] Error transcodificando (code ' + ffmpeg.status + '), guardando original'
            );
            fs.copyFileSync(tempInputPath, targetPath);
            res.json({ saved: true, path: targetPath, transcoded: false, codec: inputCodec });
          }
        }
      } else {
        fs.copyFileSync(tempInputPath, targetPath);
        res.json({ saved: true, path: targetPath, transcoded: false });
      }
    } catch (error) {
      res.status(500).json({
        saved: false,
        error: error instanceof Error ? error.message : 'Failed to save video',
      });
    } finally {
      safeUnlink(tempInputPath);
    }
  }
);

// NEW: Evidence Store API routes
app.use('/api/store', createEvidenceStoreRouter());

// Use current working directory for static files
const distRootPath = path.join(process.cwd(), 'dist');
const distRendererPath = path.join(distRootPath, 'renderer');
const staticRootPath = fs.existsSync(path.join(distRendererPath, 'index.html'))
  ? distRendererPath
  : distRootPath;
const staticIndexPath = path.join(staticRootPath, 'index.html');

if (fs.existsSync(staticIndexPath)) {
  console.log(
    `[SENTINEL_CORE] Detectado build estático en '${path.relative(process.cwd(), staticRootPath)}'. Sirviendo frontend...`
  );
  app.use(express.static(staticRootPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(staticIndexPath);
  });
} else {
  console.log(
    `[SENTINEL_CORE] Build estático no encontrado (dist/index.html o dist/renderer/index.html). El servidor operará solo como API.`
  );
}

// ─── Health endpoint ──────────────────────────────────────────────────────────
// Fast health check for frontend discovery
app.get('/api/health', (req, res) => {
  res.set('Content-Type', 'application/json');
  res.send('{"status":"ok"}');
});

app.get('/api/ready', (req, res) => {
  try {
    // Check available services
    const pythonPath = process.env.PYTHON_PATH || '';
    const paddleOcrHome = process.env.PADDLEOCR_HOME || '';

    const ready = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        ffmpeg: !!ffmpegPath && ffmpegPath !== 'ffmpeg', // True if not using fallback
        python: !!pythonPath && fs.existsSync(pythonPath),
        paddleOcr: !!paddleOcrHome, // Will be set by main.ts in Electron
      },
      port: port,
      mode: process.env.ELECTRON_MAIN_PROCESS ? 'electron' : 'web',
    };

    // Check if all critical services are available
    const allReady = ready.services.ffmpeg && ready.services.python;
    // paddleOcr is optional for initial startup

    logger.auditLog('GET', '/api/ready', allReady ? 200 : 503, { allReady });
    res.status(allReady ? 200 : 503).json(ready);
  } catch (error) {
    logger.errorWithContext('API_READY', error);
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/realtime/stats', (_req, res) => {
  cleanupExpiredIpCameraSessions();
  updateRealtimeStats({ activeCameras: ipCameraSessions.size });
  res.json(realtimeStats);
});

app.post('/api/realtime/publish', (req, res) => {
  const { type, payload, viewerId, siteId } = req.body || {};
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'type is required' });
  }

  if (type === 'detection') {
    updateRealtimeStats({ detections: Number(realtimeStats.detections || 0) + 1 });
  } else if (type === 'infraction_confirmed') {
    updateRealtimeStats({
      infractions: Number(realtimeStats.infractions || 0) + 1,
      expedients: Number(realtimeStats.expedients || 0) + 1,
    });
  }
  appendRealtimeHistory({ type, viewerId: viewerId || null, siteId: siteId || null });

  const channels = {
    viewerId: normalizeChannelValue(viewerId),
    siteId: normalizeChannelValue(siteId),
  };

  broadcastRealtime(type, payload || {}, channels);
  broadcastRealtime('stats', realtimeStats, channels);
  res.json({ ok: true });
});

app.get('/api/realtime/history', (_req, res) => {
  const points = Number(_req.query.points || 300);
  const safePoints = Number.isFinite(points) ? Math.max(10, Math.min(5000, points)) : 300;
  res.json(realtimeHistory.slice(-safePoints));
});

// ─── Expedients API (via in-memory cache, bypassing RLS) ──────────────────────────
app.get('/api/expedients', (req, res) => {
  try {
    const state = String(req.query.state || '').trim().toUpperCase();
    const validStates = ['DETECTED', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'SIGNED', 'EXPORTED'];

    // Filter by state if provided
    let expedients = getCachedExpedients(
      state && validStates.includes(state) ? state : null
    );

    logger.debug('API_EXPEDIENTS', `Retrieved ${expedients.length} expedients from cache with state=${state || 'ANY'}`);

    res.json({
      ok: true,
      count: expedients.length,
      state: state || 'ANY',
      source: 'cache',
      expedients: expedients,
    });
  } catch (error) {
    console.error('[API_EXPEDIENTS] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ─── Expedient Sync API (app sends expedient when created) ────────────────────────
app.post('/api/expedients/sync', (req, res) => {
  try {
    const expedient = req.body;

    if (!expedient || !expedient.id) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Expedient must have an id',
      });
    }

    const success = cacheExpedient(expedient);

    if (!success) {
      return res.status(400).json({
        error: 'Failed to cache expedient',
      });
    }

    logger.debug('API_EXPEDIENTS_SYNC', `Synced expedient: ${expedient.id}`);

    res.json({
      ok: true,
      message: 'Expedient cached successfully',
      expedient_id: expedient.id,
      cache_size: expedientCache.size,
    });
  } catch (error) {
    console.error('[API_EXPEDIENTS_SYNC] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ─── Infractions API (via in-memory cache, bypassing RLS) ──────────────────────────
app.get('/api/infractions', (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase();
    const validStatuses = ['PENDING', 'VALIDATED', 'REJECTED', 'EXPORTED'];

    // Filter by status if provided
    let infractions = getCachedInfractions(
      status && validStatuses.includes(status) ? status : null
    );

    logger.debug('API_INFRACTIONS', `Retrieved ${infractions.length} infractions from cache with status=${status || 'ANY'}`);

    res.json({
      ok: true,
      count: infractions.length,
      status: status || 'ANY',
      source: 'cache',
      infractions: infractions,
    });
  } catch (error) {
    console.error('[API_INFRACTIONS] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ─── Infraction Sync API (app sends infraction when created) ────────────────────────
app.post('/api/infractions/sync', (req, res) => {
  try {
    const infraction = req.body;

    if (!infraction || !infraction.id) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Infraction must have an id',
      });
    }

    const success = cacheInfraction(infraction);

    if (!success) {
      return res.status(400).json({
        error: 'Failed to cache infraction',
      });
    }

    logger.debug('API_INFRACTIONS_SYNC', `Synced infraction: ${infraction.id}`);

    res.json({
      ok: true,
      message: 'Infraction cached successfully',
      infraction_id: infraction.id,
      cache_size: infractionCache.size,
    });
  } catch (error) {
    console.error('[API_INFRACTIONS_SYNC] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/integrations/transit/notify', async (req, res) => {
  try {
    if (!TRANSIT_WEBHOOK_URL) {
      return res.status(503).json({ error: 'TRANSIT_WEBHOOK_URL not configured' });
    }
    const explicitKey = String(
      req.headers['x-idempotency-key'] || req.body?.idempotencyKey || ''
    ).trim();
    const bodyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');
    const idempotencyKey = explicitKey || `auto_${bodyHash.slice(0, 20)}`;

    const existing = transitDeliveryState.get(idempotencyKey);
    if (existing) {
      return res.json({
        accepted: true,
        deduplicated: true,
        idempotencyKey,
        status: existing.status,
        attempts: existing.attempts || 0,
      });
    }

    const provider = String(req.body?.provider || 'generic').toLowerCase();
    const mapTransitPayload = (p, providerName) => {
      const base = {
        eventType: p?.eventType || p?.type || 'INFRACTION_EVENT',
        eventAt: p?.eventAt || new Date().toISOString(),
        source: 'sentinel',
        payload: p?.payload || p || {},
      };
      if (providerName === 'legacy_city') {
        return {
          tipo_evento: base.eventType,
          fecha_evento: base.eventAt,
          origen: base.source,
          datos: base.payload,
        };
      }
      if (providerName === 'strict_v2') {
        return {
          meta: { source: base.source, version: '2.0' },
          event: { type: base.eventType, at: base.eventAt },
          data: base.payload,
        };
      }
      return base;
    };

    transitDeliveryState.set(idempotencyKey, {
      status: 'queued',
      attempts: 0,
      queuedAt: new Date().toISOString(),
      provider,
    });

    transitQueue.push({
      idempotencyKey,
      payload: mapTransitPayload(req.body || {}, provider),
      provider,
      attempts: 1,
      maxAttempts: 3,
    });
    void processTransitQueue();

    res.status(202).json({ accepted: true, queued: true, idempotencyKey });
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Transit webhook failed' });
  }
});

app.get('/api/integrations/transit/status/:idempotencyKey', (req, res) => {
  const state = transitDeliveryState.get(String(req.params.idempotencyKey || '').trim());
  if (!state) return res.status(404).json({ error: 'Not found' });
  res.json(state);
});

app.get('/api/integrations/transit/deliveries', (_req, res) => {
  const limit = Number(_req.query.limit || 100);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, limit)) : 100;
  const rows = Array.from(transitDeliveryState.entries())
    .map(([idempotencyKey, state]) => ({ idempotencyKey, ...state }))
    .slice(-safeLimit)
    .reverse();
  res.json(rows);
});

app.get('/api/public/v1/openapi.json', publicApiGuard, publicApiRateLimit, (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: { title: 'Sentinel Public API', version: '1.0.0' },
    servers: [{ url: '/api/public/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/health': {
        get: { summary: 'Public health check', responses: { 200: { description: 'OK' } } },
      },
      '/stats': {
        get: { summary: 'Realtime aggregate stats', responses: { 200: { description: 'OK' } } },
      },
      '/realtime/history': {
        get: {
          summary: 'Historical realtime stats',
          parameters: [
            {
              name: 'points',
              in: 'query',
              schema: { type: 'integer', minimum: 10, maximum: 5000 },
            },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/events': {
        post: {
          summary: 'Publish realtime event',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: { 200: { description: 'Accepted' } },
        },
      },
      '/integrations/transit/notify': {
        post: {
          summary: 'Queue event delivery to transit provider',
          responses: { 202: { description: 'Queued' } },
        },
      },
    },
  });
});

app.get('/api/public/v1/health', publicApiGuard, publicApiRateLimit, (_req, res) => {
  res.json({ status: 'ok', version: 'v1' });
});

app.get('/api/public/v1/stats', publicApiGuard, publicApiRateLimit, (_req, res) => {
  res.json(realtimeStats);
});

app.post('/api/public/v1/events', publicApiGuard, publicApiRateLimit, (req, res) => {
  const { type, payload, viewerId, siteId } = req.body || {};
  if (!type || typeof type !== 'string') return res.status(400).json({ error: 'type is required' });
  broadcastRealtime(type, payload || {}, {
    viewerId: normalizeChannelValue(viewerId),
    siteId: normalizeChannelValue(siteId),
  });
  res.json({ accepted: true });
});

app.post('/api/save-config', (req, res) => {
  try {
    const { fileName, config } = req.body;

    // Validar entrada
    if (typeof fileName !== 'string' || !fileName.trim()) {
      logger.validationError('SAVE_CONFIG', 'fileName', 'Debe ser string no vacío', fileName);
      return res.status(400).json({ error: 'Nombre de archivo requerido.' });
    }

    if (!config || typeof config !== 'object') {
      logger.validationError('SAVE_CONFIG', 'config', 'Debe ser objeto', typeof config);
      return res.status(400).json({ error: 'Configuración debe ser un objeto válido.' });
    }

    // Validar que no sea muy grande
    const configStr = JSON.stringify(config);
    if (configStr.length > 1 * 1024 * 1024) {
      logger.validationError('SAVE_CONFIG', 'config', 'Tamaño excesivo', 'config too large');
      return res.status(413).json({ error: 'Configuración excede 1MB.' });
    }

    const PRESET_DIR = path.join(path.resolve(), 'preset');
    if (!fs.existsSync(PRESET_DIR)) {
      fs.mkdirSync(PRESET_DIR, { recursive: true });
    }

    const safeFilename = sanitizeFilename(fileName, '.json');
    const targetPath = path.join(PRESET_DIR, safeFilename);

    // Prevenir path traversal
    if (!isPathWithinDir(targetPath, PRESET_DIR)) {
      logger.warn('SAVE_CONFIG', 'Intento de path traversal', { targetPath, PRESET_DIR });
      return res.status(403).json({ error: 'Ruta de archivo no permitida.' });
    }

    fs.writeFileSync(targetPath, JSON.stringify(config, null, 2));
    logger.auditLog('POST', '/api/save-config', 200, { fileName: safeFilename });
    res.json({ saved: true, path: targetPath });
  } catch (error) {
    logger.errorWithContext('API_SAVE_CONFIG', error);
    res.status(500).json({
      saved: false,
      error: error instanceof Error ? error.message : 'Error al guardar configuración',
    });
  }
});

app.get('/api/presets', (req, res) => {
  try {
    const PRESET_DIR = path.join(path.resolve(), 'preset');
    if (!fs.existsSync(PRESET_DIR)) {
      return res.json({ presets: [] });
    }
    const files = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.json'));
    res.json({ presets: files });
  } catch (error) {
    res.status(500).json({ error: 'Error al listar presets' });
  }
});

app.get('/api/presets/:filename', (req, res) => {
  try {
    const PRESET_DIR = path.join(path.resolve(), 'preset');
    const safeFilename = sanitizeFilename(req.params.filename, '.json');
    const targetPath = path.join(PRESET_DIR, safeFilename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Preset no encontrado' });
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: 'Error al leer preset' });
  }
});

// Export function for Electron initialization
export async function initializeExpressServer(config = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Set environment variables from config
      if (config.isElectron) {
        process.env.ELECTRON_MAIN_PROCESS = 'true';
      }

      if (config.appPath) {
        process.env.APP_PATH = config.appPath;
      }

      // Use provided port or dynamic port (0) for Electron
      const serverPort = config.port !== undefined ? config.port : port;

      // Create server
      const server = app.listen(serverPort, '127.0.0.1', () => {
        const actualAddress = server.address();
        const actualPort =
          typeof actualAddress === 'string' ? serverPort : actualAddress?.port || serverPort;

        console.log(`[SENTINEL_SYSTEM] Activo en: http://localhost:${actualPort}`);
        console.log(
          `[SENTINEL_SYSTEM] Modo: ${fs.existsSync(staticIndexPath) ? 'FULL_STACK' : 'API_ONLY'}`
        );
        console.log(`[SENTINEL_SYSTEM] FFmpeg: ${ffmpegPath}`);
        console.log(`[SENTINEL_SYSTEM] Puerto real asignado: ${actualPort}`);

        // Write port to file for frontend auto-discovery (disabled in Electron mode)
        if (!process.env.ELECTRON_MAIN_PROCESS) {
          try {
            const portFile = path.join(os.tmpdir(), 'sentinel-api-port.txt');
            fs.writeFileSync(portFile, String(actualPort), 'utf8');
            console.log(`[SENTINEL_SYSTEM] Puerto guardado en: ${portFile}`);
          } catch (err) {
            console.warn(`[SENTINEL_SYSTEM] No se pudo guardar puerto: ${err.message}`);
          }
        }

        // Store server port globally for IPC handlers
        process.env.SENTINEL_SERVER_PORT = String(actualPort);

        const wss = new WebSocketServer({ server, path: '/ws/realtime' });
        wss.on('connection', (ws, req) => {
          try {
            const url = new URL(req.url || '/ws/realtime', 'http://127.0.0.1');
            const viewerId = normalizeChannelValue(url.searchParams.get('viewerId'));
            const siteId = normalizeChannelValue(url.searchParams.get('siteId'));
            realtimeClients.set(ws, { viewerId, siteId });

            ws.send(
              JSON.stringify({
                type: 'hello',
                ts: Date.now(),
                payload: { viewerId, siteId, connectedClients: realtimeClients.size },
              })
            );
            ws.send(JSON.stringify({ type: 'stats', ts: Date.now(), payload: realtimeStats }));
          } catch {}

          ws.on('message', (raw) => {
            try {
              const msg = JSON.parse(raw.toString());
              if (msg?.type === 'subscribe') {
                realtimeClients.set(ws, {
                  viewerId: normalizeChannelValue(msg.viewerId),
                  siteId: normalizeChannelValue(msg.siteId),
                });
              }
            } catch {}
          });

          ws.on('close', () => {
            realtimeClients.delete(ws);
          });
        });

        const heartbeat = setInterval(() => {
          resetRealtimeDetectionsIfNeeded();
          broadcastRealtime('health', {
            status: 'ok',
            clients: realtimeClients.size,
            updatedAt: new Date().toISOString(),
          });
        }, 15000);

        // Setup graceful shutdown
        const gracefulShutdown = async () => {
          console.log('[SENTINEL_SYSTEM] Cerrando gracefully...');
          clearInterval(heartbeat);
          try {
            wss.close();
          } catch {}
          await shutdownOcrWorker();
          server.close(() => {
            console.log('[SENTINEL_SYSTEM] Server cerrado');
            process.exit(0);
          });
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

        // Resolve with server instance
        resolve(server);
      });

      // Handle server errors
      server.on('error', (err) => {
        console.error('[SENTINEL_SYSTEM] Server error:', err);
        reject(err);
      });
    } catch (error) {
      console.error('[SENTINEL_SYSTEM] Failed to initialize server:', error);
      reject(error);
    }
  });
}

// Auto-start in standalone mode, but never when imported by Electron main process.
if (process.env.IS_ELECTRON !== 'true') {
  initializeExpressServer().catch((err) => {
    console.error('[SENTINEL_SYSTEM] Fallo al iniciar:', err);
    process.exit(1);
  });
}
