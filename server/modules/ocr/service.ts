/**
 * OCR Service - Server-side PHASE 6
 * Interface to PaddleOCR and timestamp extraction backend
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../../../services/logger';

export interface PlateExtractionResult {
  plate: string | null;
  candidates: Array<{ text: string; confidence: number }>;
  confidence: number;
  method: string;
}

export interface TimestampExtractionResult {
  timestamp: string | null;
  osdText: string | null;
  confidence: number;
}

export interface PlateRegionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * OCR Service that wraps backend OCR engines (PaddleOCR, YOLO, etc.)
 */
export class OCRServiceBackend {
  private pythonExePath: string;
  private ocrScriptPath: string;

  constructor(pythonExePath?: string) {
    // Use provided path or resolve to bundled Python
    this.pythonExePath = pythonExePath || this.getDefaultPythonPath();
    this.ocrScriptPath = path.join(process.cwd(), 'resources', 'paddle_ocr_extractor.py');

    logger.info('OCR_BACKEND', `Python path: ${this.pythonExePath}`);
    logger.info('OCR_BACKEND', `OCR script path: ${this.ocrScriptPath}`);
  }

  /**
   * Get default Python executable path
   */
  private getDefaultPythonPath(): string {
    // Try bundled Python first
    const bundledPython = path.join(process.cwd(), 'resources', 'python', 'python.exe');
    if (fs.existsSync(bundledPython)) {
      return bundledPython;
    }
    // Fallback to system Python
    return 'python';
  }

  /**
   * Extract license plate from base64 image using PaddleOCR
   */
  async extractPlate(imageBase64: string | string[]): Promise<PlateExtractionResult> {
    try {
      const images = Array.isArray(imageBase64)
        ? imageBase64.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : imageBase64
          ? [imageBase64]
          : [];

      if (images.length === 0) {
        return {
          plate: null,
          candidates: [],
          confidence: 0,
          method: 'error',
        };
      }

      const payload = JSON.stringify({
        operation: 'extract_plate',
        images,
      });

      // Call Python OCR script through stdin (prevents Windows argv size issues).
      const result = spawnSync(this.pythonExePath, [this.ocrScriptPath], {
        encoding: 'utf-8',
        input: payload,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 30000, // 30 seconds timeout
      });

      if (result.error) {
        logger.error('OCR_BACKEND', 'Failed to spawn Python process', result.error);
        return {
          plate: null,
          candidates: [],
          confidence: 0,
          method: 'error',
        };
      }

      if (result.status !== 0) {
        logger.error(
          'OCR_BACKEND',
          `Python script exited with code ${result.status}`,
          result.stderr
        );
        return {
          plate: null,
          candidates: [],
          confidence: 0,
          method: 'error',
        };
      }

      try {
        const ocrResult = JSON.parse(result.stdout);
        logger.info('OCR_BACKEND', `Extracted plate: ${ocrResult.plate || 'none'}`);
        return {
          plate: ocrResult.plate || null,
          candidates: ocrResult.candidates || [],
          confidence: ocrResult.confidence || 0,
          method: ocrResult.method || 'paddleocr',
        };
      } catch (parseError) {
        logger.error(
          'OCR_BACKEND',
          `Failed to parse Python output: ${String(result.stdout || '').slice(0, 500)}`,
          parseError
        );
        return {
          plate: null,
          candidates: [],
          confidence: 0,
          method: 'error',
        };
      }
    } catch (error) {
      logger.error('OCR_BACKEND', 'Plate extraction failed', error);
      return {
        plate: null,
        candidates: [],
        confidence: 0,
        method: 'error',
      };
    }
  }

  /**
   * Detect license plate region in image
   */
  async detectPlateRegion(imageBase64: string): Promise<PlateRegionResult | null> {
    try {
      if (!imageBase64) return null;

      const payload = JSON.stringify({
        operation: 'detect_region',
        image: imageBase64,
      });

      const result = spawnSync(this.pythonExePath, [this.ocrScriptPath], {
        encoding: 'utf-8',
        input: payload,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      if (result.error || result.status !== 0) {
        logger.warn('OCR_BACKEND', 'Plate region detection failed');
        return null;
      }

      try {
        const regionResult = JSON.parse(result.stdout);
        if (regionResult.x !== undefined && regionResult.y !== undefined) {
          return regionResult as PlateRegionResult;
        }
        return null;
      } catch (parseError) {
        logger.warn('OCR_BACKEND', 'Failed to parse plate region result', parseError);
        return null;
      }
    } catch (error) {
      logger.warn('OCR_BACKEND', 'Plate region detection failed', error);
      return null;
    }
  }

  /**
   * Extract timestamp from image OSD
   */
  async extractTimestamp(imageBase64: string): Promise<TimestampExtractionResult> {
    try {
      if (!imageBase64) {
        return {
          timestamp: null,
          osdText: null,
          confidence: 0,
        };
      }

      const payload = JSON.stringify({
        operation: 'extract_timestamp',
        image: imageBase64,
      });

      const result = spawnSync(this.pythonExePath, [this.ocrScriptPath], {
        encoding: 'utf-8',
        input: payload,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      if (result.error || result.status !== 0) {
        logger.warn(
          'OCR_BACKEND',
          'Timestamp extraction process failed',
          result.error || result.stderr
        );
        return { timestamp: null, osdText: null, confidence: 0 };
      }

      const parsed = JSON.parse(result.stdout || '{}');
      return {
        timestamp: parsed.timestamp || null,
        osdText: parsed.raw_text || null,
        confidence: parsed.confidence ? 1 : 0,
      };
    } catch (error) {
      logger.warn('OCR_BACKEND', 'Timestamp extraction failed', error);
      return {
        timestamp: null,
        osdText: null,
        confidence: 0,
      };
    }
  }
}

// Singleton instance
let instance: OCRServiceBackend | null = null;

export function initializeOCRBackend(paddleExePath?: string): OCRServiceBackend {
  if (!instance) {
    instance = new OCRServiceBackend(paddleExePath);
    logger.info('OCR_BACKEND', 'OCR backend service initialized');
  }
  return instance;
}

export function getOCRBackend(): OCRServiceBackend {
  if (!instance) {
    instance = new OCRServiceBackend();
  }
  return instance;
}
