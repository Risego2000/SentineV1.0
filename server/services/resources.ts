/**
 * Resource Manager - Dynamic path resolution for dev/production
 * Handles paths to Python, FFmpeg, PaddleOCR models based on environment
 * PHASE 4: Resource path resolution for packaged vs development modes
 */

import path from 'path';
import { logger } from '../../services/logger.js';
import type { ServerConfig } from '../config/env.js';

export class ResourceManager {
  private resourcesPath: string;
  private pythonExe: string;
  private ffmpegExe: string;
  private ffprobeExe: string;
  private paddleModelsPath: string;

  constructor(config: ServerConfig) {
    // Determine resources directory
    if (config.isElectron && config.resourcesPath) {
      // Production: use bundled resources
      this.resourcesPath = config.resourcesPath;
      logger.info('RESOURCES', `Using packaged resources: ${this.resourcesPath}`);
    } else {
      // Development: use project directory
      this.resourcesPath = path.join(process.cwd(), 'resources');
      logger.info('RESOURCES', `Using development resources: ${this.resourcesPath}`);
    }

    // Set up tool paths
    this.pythonExe = this.getPythonPath();
    this.ffmpegExe = this.getFFmpegPath();
    this.ffprobeExe = this.getFFprobePath();
    this.paddleModelsPath = this.getPaddleOCRModelsPath(config);

    this.validatePaths();
  }

  /**
   * Get Python executable path
   */
  private getPythonPath(): string {
    return path.join(this.resourcesPath, 'python', 'python.exe');
  }

  /**
   * Get FFmpeg executable path
   */
  private getFFmpegPath(): string {
    return path.join(this.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
  }

  /**
   * Get FFprobe executable path
   */
  private getFFprobePath(): string {
    return path.join(this.resourcesPath, 'ffmpeg', 'ffprobe.exe');
  }

  /**
   * Get PaddleOCR models directory path
   * In production (Electron packaged), use AppData
   * In development, use project directory
   */
  private getPaddleOCRModelsPath(config: ServerConfig): string {
    if (config.isProduction && config.isElectron) {
      // Production: store large models in AppData to reduce app size
      const appDataPath = process.env.APPDATA || '';
      return path.join(appDataPath, 'Sentinel', 'paddle-ocr-models');
    }
    // Development: local resources directory
    return path.join(this.resourcesPath, 'python', 'paddle_models');
  }

  /**
   * Validate that all required paths exist
   * Logs warnings if paths are missing
   */
  private validatePaths(): void {
    const fs = require('fs');

    const paths = [
      { name: 'Python', path: this.pythonExe },
      { name: 'FFmpeg', path: this.ffmpegExe },
      { name: 'FFprobe', path: this.ffprobeExe },
      { name: 'PaddleOCR Models', path: this.paddleModelsPath },
    ];

    for (const { name, path: resourcePath } of paths) {
      if (!fs.existsSync(resourcePath)) {
        logger.warn('RESOURCES', `Missing ${name}: ${resourcePath}`);
      } else {
        logger.info('RESOURCES', `✓ ${name}: ${resourcePath}`);
      }
    }
  }

  // Public accessors
  getResourcesPath(): string {
    return this.resourcesPath;
  }

  getPython(): string {
    return this.pythonExe;
  }

  getFFmpeg(): string {
    return this.ffmpegExe;
  }

  getFFprobe(): string {
    return this.ffprobeExe;
  }

  getPaddleModels(): string {
    return this.paddleModelsPath;
  }
}

// Singleton instance
let instance: ResourceManager | null = null;

export function initializeResourceManager(config: ServerConfig): ResourceManager {
  if (!instance) {
    instance = new ResourceManager(config);
  }
  return instance;
}

export function getResourceManager(): ResourceManager {
  if (!instance) {
    throw new Error('ResourceManager not initialized. Call initializeResourceManager first.');
  }
  return instance;
}
