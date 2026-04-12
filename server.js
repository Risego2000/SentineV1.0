import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const app = express();
const port = process.env.PORT || 3002;

// In-memory progress tracker
const progressMap = new Map();

// Resolve FFmpeg and FFprobe binary paths
let ffmpegPath;
let ffprobePath;
try {
  ffmpegPath = _require('@ffmpeg-installer/ffmpeg').path;
  ffprobePath = _require('@ffprobe-installer/ffprobe').path;
} catch {
  ffmpegPath = 'ffmpeg';
  ffprobePath = 'ffprobe';
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multi-part form-data for video uploads
const upload = multer({ dest: os.tmpdir() });

/**
 * POST /api/transcode
 * Receives a video file, returns H.264 version
 */
app.post('/api/transcode', upload.single('video'), async (req, res) => {
  const jobId = req.query.id || 'unnamed';

  if (!req.file && !req.body) {
    // Handle raw body if not using multer for some reason (App uses raw body)
    // Actually, looking at contextStartLiveFeed in SentinelContext.tsx:
    // body: fileBuffer
    // So it's a RAW body.
  }

  // Handle RAW body (as the App.tsx does)
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `sentinel_input_${timestamp}.mp4`);
    const outputPath = path.join(tmpDir, `sentinel_output_${timestamp}.mp4`);

    fs.writeFileSync(inputPath, body);

    // Get duration using ffprobe
    let durationSec = 0;
    try {
      const ffprobeCmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
      const output = execSync(ffprobeCmd).toString().trim();
      durationSec = parseFloat(output);
      console.log(`[TRANSCODE] [${jobId}] Duración detectada: ${durationSec}s`);
    } catch (e) {
      console.warn(`[TRANSCODE] [${jobId}] No se pudo obtener duración:`, e.message);
    }

    console.log(`[TRANSCODE] [${jobId}] Iniciando transcodificación...`);
    progressMap.set(jobId, 0);

    const args = [
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString();
      const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && durationSec > 0) {
        const h = parseFloat(timeMatch[1]);
        const m = parseFloat(timeMatch[2]);
        const s = parseFloat(timeMatch[3]);
        const currentSec = h * 3600 + m * 60 + s;
        const progress = Math.min(Math.round((currentSec / durationSec) * 100), 99);
        progressMap.set(jobId, progress);
      }
    });

    ffmpeg.on('close', (code) => {
      try {
        fs.unlinkSync(inputPath);
      } catch {
        /* ignore */
      }
      if (code !== 0) {
        progressMap.delete(jobId);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Transcoding failed' });
        }
        return;
      }

      progressMap.set(jobId, 100);
      const stat = fs.statSync(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);

      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);
      readStream.on('end', () => {
        try {
          fs.unlinkSync(outputPath);
        } catch {
          /* ignore */
        }
        setTimeout(() => progressMap.delete(jobId), 10000); // Mantenemos progreso 10s para el cliente
      });
    });

    ffmpeg.on('error', (err) => {
      progressMap.delete(jobId);
      try {
        fs.unlinkSync(inputPath);
      } catch {
        /* ignore */
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'FFmpeg not found or execution error' });
      }
    });
  });
});

/**
 * GET /api/transcode/progress
 */
app.get('/api/transcode/progress', (req, res) => {
  const jobId = req.query.id || '';
  const progress = progressMap.get(jobId) ?? (jobId ? 0 : -1);
  res.json({ progress });
});

// GET /api/transcode/status
app.get('/api/transcode/status', (req, res) => {
  res.json({ available: true, ffmpeg: ffmpegPath });
});

// POST /api/reports/save
app.post(
  '/api/reports/save',
  express.raw({ type: 'application/pdf', limit: '50mb' }),
  (req, res) => {
    try {
      const reportsDir = 'C:\\Denuncias';
      fs.mkdirSync(reportsDir, { recursive: true });

      const requestedFilename = String(req.query.filename || `Sentinel_Report_${Date.now()}.pdf`);
      const safeFilename = requestedFilename
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_');
      const finalFilename = safeFilename.toLowerCase().endsWith('.pdf')
        ? safeFilename
        : `${safeFilename}.pdf`;

      const targetPath = path.join(reportsDir, finalFilename);
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

// POST /api/reports/video
app.post(
  '/api/reports/video',
  express.raw({ type: 'video/webm', limit: '100mb' }),
  (req, res) => {
    try {
      const reportsDir = 'C:\\Denuncias';
      fs.mkdirSync(reportsDir, { recursive: true });

      const requestedFilename = String(req.query.filename || `Evidence_${Date.now()}.webm`);
      const safeFilename = requestedFilename
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_');
      const finalFilename = safeFilename.toLowerCase().endsWith('.webm')
        ? safeFilename
        : `${safeFilename}.webm`;

      const targetPath = path.join(reportsDir, finalFilename);
      fs.writeFileSync(targetPath, req.body);

      res.json({ saved: true, path: targetPath });
    } catch (error) {
      res.status(500).json({
        saved: false,
        error: error instanceof Error ? error.message : 'Failed to save video',
      });
    }
  }
);

// Serve static files from the 'dist' directory (Production)
const __dirname = path.resolve();
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  console.log(`[SENTINEL_CORE] Detectado directorio 'dist'. Sirviendo archivos estáticos...`);
  app.use(express.static(distPath));

  // SPA fallback for non-API routes. Express 5 no longer accepts bare "*".
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log(
    `[SENTINEL_CORE] Directorio 'dist' no encontrado. El servidor operará solo como API.`
  );
}

app.listen(port, () => {
  console.log(`[SENTINEL_SYSTEM] Activo en: http://localhost:${port}`);
  console.log(`[SENTINEL_SYSTEM] Modo: ${fs.existsSync(distPath) ? 'FULL_STACK' : 'API_ONLY'}`);
  console.log(`[SENTINEL_SYSTEM] FFmpeg: ${ffmpegPath}`);
});
