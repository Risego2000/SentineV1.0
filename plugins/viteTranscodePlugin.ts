import { Plugin } from 'vite';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

// In-memory progress tracker
const progressMap = new Map<string, number>();

/**
 * Vite Plugin: H.265/HEVC -> H.264 Transcoder with Progress Tracking
 */
export function viteTranscodePlugin(): Plugin {
  // Resolve FFmpeg and FFprobe binary paths
  let ffmpegPath: string;
  let ffprobePath: string;
  try {
    ffmpegPath = _require('@ffmpeg-installer/ffmpeg').path;
    ffprobePath = _require('@ffprobe-installer/ffprobe').path;
  } catch {
    ffmpegPath = 'ffmpeg';
    ffprobePath = 'ffprobe';
  }

  return {
    name: 'vite-transcode-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '', 'http://' + (req.headers.host || 'localhost'));
        const pathname = url.pathname;

        // POST /api/transcode - Receives a video file, returns H.264 version
        if (pathname === '/api/transcode' && req.method === 'POST') {
          const jobId = url.searchParams.get('id') || 'unnamed';
          const chunks: Buffer[] = [];

          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            const body = Buffer.concat(chunks);
            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const inputPath = path.join(tmpDir, 'sentinel_input_' + timestamp + '.mp4');
            const outputPath = path.join(tmpDir, 'sentinel_output_' + timestamp + '.mp4');

            fs.writeFileSync(inputPath, body);

            // Get duration using ffprobe
            let durationSec = 0;
            try {
              const ffprobeCmd =
                '"' +
                ffprobePath +
                '" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "' +
                inputPath +
                '"';
              const output = execSync(ffprobeCmd).toString().trim();
              durationSec = parseFloat(output);
              console.log('[TRANSCODE] Duracion detectada: ' + durationSec + 's');
            } catch (e) {
              console.warn('[TRANSCODE] No se pudo obtener duracion:', e);
            }

            console.log('[TRANSCODE] [' + jobId + '] Iniciando transcodificacion...');
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

            ffmpeg.stderr.on('data', (data: Buffer) => {
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
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Transcoding failed' }));
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
                setTimeout(() => progressMap.delete(jobId), 10000); // Keep 10s for client
              });
            });

            ffmpeg.on('error', () => {
              progressMap.delete(jobId);
              try {
                fs.unlinkSync(inputPath);
              } catch {
                /* ignore */
              }
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'FFmpeg not found' }));
            });
          });
          return;
        }

        // GET /api/transcode/progress?id=...
        if (pathname === '/api/transcode/progress' && req.method === 'GET') {
          const jobId = url.searchParams.get('id') || '';
          const progress = progressMap.get(jobId) ?? (jobId ? 0 : -1);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ progress }));
          return;
        }

        // GET /api/transcode/status
        if (pathname === '/api/transcode/status' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ available: true, ffmpeg: ffmpegPath }));
          return;
        }

        next();
      });
    },
  };
}
