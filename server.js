import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn, execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { Readable } from 'stream';
import { createRequire } from 'module';
import {
  analyzeTrajectoryWithGemini,
  generateGeometryWithGemini,
  loadLocalEnvFile,
  extractLicensePlateWithGemini,
  extractTimestampFromOSD,
} from './services/aiServer.js';
import { generateBoletin } from './services/boletin-generator.js';
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

loadLocalEnvFile();

const _require = createRequire(import.meta.url);
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
const RATE_LIMIT_WINDOW_MS = env.rateLimitWindowMs;
const RATE_LIMIT_MAX_REQUESTS = env.rateLimitMaxRequests;
const API_TOKEN = env.apiToken;
const ALLOWED_ORIGINS = env.allowedOrigins;
const ALLOWED_CAMERA_HOSTS = env.allowedCameraHosts;

const progressMap = new Map();
const ipCameraSessions = new Map();
const rateLimitStore = new Map();
const IP_CAMERA_SESSION_TTL_MS = 5 * 60 * 1000;
let activeTranscodes = 0;

let ffmpegPath;
let ffprobePath;
let hardwareAccel = 'none'; // 'none', 'amd', 'nvidia', 'intel', 'apple'
try {
  ffmpegPath = _require('@ffmpeg-installer/ffmpeg').path;
  ffprobePath = _require('@ffprobe-installer/ffprobe').path;
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
    if (hardwareAccel === 'amd') {
      return ['-c:v', 'h264_amf', '-usage', 'transcoding'];
    }
    if (hardwareAccel === 'nvidia') {
      return ['-c:v', 'h264_nvenc', '-preset', 'fast'];
    }
    if (hardwareAccel === 'intel') {
      return ['-c:v', 'h264_qsv', '-preset', 'fast'];
    }
    if (hardwareAccel === 'apple') {
      return ['-c:v', 'h264_videotoolbox'];
    }
    // CPU encoding: ultrafast for speed, faster than 'fast' on CPU
    return ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-profile:v', 'baseline'];
  }
};

const isLoopbackRequest = (req) => {
  const remote = req.ip || req.socket?.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
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
    // In development, allow localhost on any port
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin no permitido por CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const apiGuard = (req, res, next) => {
  const origin = req.headers.origin;
  const isLocalhost = origin?.includes('localhost') || origin?.includes('127.0.0.1') || !origin;

  // Validar origen CORS - allow localhost in development
  if (origin && !isLocalhost && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn('AUTH', `CORS origin rechazado: ${origin}`, { ip: req.ip });
    res.status(403).json({ error: 'Origin no permitido.' });
    return;
  }

  // Skip token validation for localhost (development)
  if (isLocalhost) {
    req.user = { authenticated: true, ip: req.ip, isLocalhost: true };
    next();
    return;
  }

  // Require token for non-localhost origins (production)
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const expectedToken = API_TOKEN || 'default-insecure-token-change-me';

  if (!provided || provided !== expectedToken) {
    logger.warn('AUTH', 'Intento de acceso sin token válido', {
      origin,
      ip: req.ip,
      path: req.path,
      method: req.method
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
  res.json = function(data) {
    logger.auditLog(req.method, req.path, res.statusCode, {
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString()
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
      logger.info('TRANSCODE', `H.264 detectado. Saltando transcodificación (copy stream).`, { jobId });
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

    console.log(`[TRANSCODE] [${jobId}] Iniciando transcodificación (aceleración: ${hardwareAccel})...`);
    progressMap.set(jobId, 0);

    const encoderArgs = getEncoderArgs('h264');
    const ffmpegArgs = [
      '-i',
      inputPath,
      ...encoderArgs,
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString();
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
        finish(500, { error: 'Transcoding failed' });
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

// OCR endpoint using Gemini Vision API (best accuracy for license plates)
// Supports both single image and multiple images for higher accuracy
app.post('/api/ocr/plate', async (req, res) => {
  try {
    const { image, images } = req.body;

    // Support both single and multiple images
    let imagesToProcess = [];
    if (images && Array.isArray(images)) {
      imagesToProcess = images.filter((img) => img && typeof img === 'string');
    } else if (image && typeof image === 'string') {
      imagesToProcess = [image];
    }

    if (imagesToProcess.length === 0) {
      return res.status(400).json({ error: 'At least one base64 image required' });
    }

    const { extractLicensePlateFromMultiple } = await import('./services/aiServer.js');
    const result = await extractLicensePlateFromMultiple(imagesToProcess);
    res.json(result);
  } catch (error) {
    logger.errorWithContext('API_OCR_PLATE', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error extracting license plate',
    });
  }
});

// OSD Timestamp extraction endpoint
// Extracts date/time from top-left corner of video frame
app.post('/api/ocr/timestamp', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Base64 image required' });
    }

    const result = await extractTimestampFromOSD(image);
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
    const {
      plate,
      infractionType,
      timestamp,
      location,
      description,
      severity,
      makeModel,
      color,
    } = req.body;

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
    res.setHeader('Content-Disposition', `attachment; filename="Boletin_${plate}_${Date.now()}.pdf"`);
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

  res.json({
    sessionId,
    streamUrl: `/api/ip-camera/stream/${sessionId}`,
  });
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
          console.log(`[EVIDENCE] H.264 detectado. Copiando stream (sin transcodificación): ${safeFilename}`);
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
          console.log(`[EVIDENCE] Transcodificando evidencia a MP4 (aceleración: ${hardwareAccel}): ${safeFilename}`);
          const encoderArgs = getEncoderArgs('h264');
          const ffmpeg = spawnSync(ffmpegPath, [
            '-i',
            tempInputPath,
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

const __dirname = path.resolve();
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  console.log(`[SENTINEL_CORE] Detectado directorio 'dist'. Sirviendo archivos estáticos...`);
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log(
    `[SENTINEL_CORE] Directorio 'dist' no encontrado. El servidor operará solo como API.`
  );
}

// ─── Health endpoint ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    activeTranscodes,
    pendingAudits: 0,
    ffmpegAvailable: ffmpegPath !== 'ffmpeg',
    hardwareAcceleration: hardwareAccel,
    reportsDir: REPORTS_DIR,
    timestamp: new Date().toISOString(),
  });
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

app.listen(port, () => {
  console.log(`[SENTINEL_SYSTEM] Activo en: http://localhost:${port}`);
  console.log(`[SENTINEL_SYSTEM] Modo: ${fs.existsSync(distPath) ? 'FULL_STACK' : 'API_ONLY'}`);
  console.log(`[SENTINEL_SYSTEM] FFmpeg: ${ffmpegPath}`);

  // Write port to file for frontend auto-discovery
  try {
    const portFile = path.join(os.tmpdir(), 'sentinel-api-port.txt');
    fs.writeFileSync(portFile, String(port), 'utf8');
    console.log(`[SENTINEL_SYSTEM] Puerto guardado en: ${portFile}`);
  } catch (err) {
    console.warn(`[SENTINEL_SYSTEM] No se pudo guardar puerto: ${err.message}`);
  }
});
