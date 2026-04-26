/**
 * OCR Service - Server-side PHASE 6
 * Interface to PaddleOCR and timestamp extraction backend
 */

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
  private paddlePythonPath: string;
  private isAvailable: boolean = false;

  constructor(paddleExePath?: string) {
    this.paddlePythonPath = paddleExePath || 'paddleocr';
    // Check availability on init
    this.checkAvailability();
  }

  /**
   * Check if PaddleOCR is available
   */
  private checkAvailability(): void {
    // In a real implementation, would check if PaddleOCR is installed
    // For now, assume it's available in production
    this.isAvailable = true;
  }

  /**
   * Extract license plate from base64 image using PaddleOCR
   */
  async extractPlate(imageBase64: string): Promise<PlateExtractionResult> {
    try {
      if (!imageBase64) {
        return {
          plate: null,
          candidates: [],
          confidence: 0,
          method: 'error',
        };
      }

      // In production: call PaddleOCR Python service
      // For now: return mock with proper structure
      const mockResult = this.mockPlateExtraction(imageBase64);
      return mockResult;
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

      // In production: call plate detection model (YOLO or similar)
      // For now: return mock region
      return {
        x: 0.1,
        y: 0.4,
        width: 0.8,
        height: 0.3,
        confidence: 0.75,
      };
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

      // In production: call Gemini API or similar for timestamp OCR
      // For now: return null (fallback to client-side)
      return {
        timestamp: null,
        osdText: null,
        confidence: 0,
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

  /**
   * Mock plate extraction for development/testing
   * In production: would call actual PaddleOCR
   */
  private mockPlateExtraction(imageBase64: string): PlateExtractionResult {
    // This is a mock for development
    // In production, integrate with actual PaddleOCR
    return {
      plate: null, // Return null for unknown plates
      candidates: [],
      confidence: 0,
      method: 'mock',
    };
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
