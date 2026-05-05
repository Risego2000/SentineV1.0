/**
 * Health Check Service
 * Verifies system components (FFmpeg, Python, PaddleOCR)
 * PHASE 4: Modular health check implementation
 */

import { spawn } from 'child_process';
import { logger } from '../../../services/logger.js';
import type { ServerConfig } from '../../config/env.js';

export interface HealthStatus {
  status: 'healthy';
  timestamp: string;
  isProduction: boolean;
  isElectron: boolean;
  uptime: number;
}

export interface ReadyStatus {
  ready: boolean;
  ffmpeg: boolean;
  python: boolean;
  paddleOcr: boolean;
  timestamp: string;
}

export class HealthService {
  private startTime = Date.now();

  constructor(private config: ServerConfig) {}

  async checkHealth(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      isProduction: this.config.isProduction,
      isElectron: this.config.isElectron,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  async checkReady(): Promise<ReadyStatus> {
    const [ffmpegOk, pythonOk, paddleOcrOk] = await Promise.all([
      this.checkFFmpeg(),
      this.checkPython(),
      this.checkPaddleOCR(),
    ]);

    return {
      ready: ffmpegOk && pythonOk && paddleOcrOk,
      ffmpeg: ffmpegOk,
      python: pythonOk,
      paddleOcr: paddleOcrOk,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkFFmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('ffmpeg', ['-version'], {
          timeout: 5000,
          stdio: 'pipe',
        });

        proc.on('close', (code) => {
          resolve(code === 0);
        });

        proc.on('error', () => {
          resolve(false);
        });

        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 5000);
      } catch {
        resolve(false);
      }
    });
  }

  private async checkPython(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('python', ['--version'], {
          timeout: 5000,
          stdio: 'pipe',
        });

        proc.on('close', (code) => {
          resolve(code === 0);
        });

        proc.on('error', () => {
          resolve(false);
        });

        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 5000);
      } catch {
        resolve(false);
      }
    });
  }

  private async checkPaddleOCR(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('python', ['-c', 'import paddleocr'], {
          timeout: 3000,
          stdio: 'pipe',
        });

        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 3000);
      } catch {
        resolve(false);
      }
    });
  }
}
