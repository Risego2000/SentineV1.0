/**
 * OCR Service - PHASE 6
 * Robust license plate detection and extraction with validation
 * Handles multiple candidates, confidence scoring, and forensic preservation
 */

import { logger } from './logger';
import {
  validateOCRResult,
  selectBestPlate,
  OCRCandidate,
  PlateValidationResult,
  generateValidationReport,
} from '../domain/validation';
import { calculateSHA256 } from './ChainOfCustodyService';
import { custodyLog, CustodyLogService } from './CustodyLogService';
import { getApiUrl } from './apiConfig';

export interface OCRExtractionResult {
  plate: string | null;
  confidence: number;
  format: 'spain' | 'spain_historic' | 'europe' | 'unknown';
  candidates: OCRCandidate[];
  selectedCandidateIndex: number;
  extractionMethod: 'paddle_ocr' | 'tensorflow' | 'fallback';
  processingTimeMs: number;
  validationReport: string;
}

export interface PlateDetectionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * OCR Service - Specialized for license plate detection
 */
export class OCRService {
  private minConfidence: number = 0.85;
  private detectionMethod: 'paddle_ocr' | 'yolo' | 'heuristic' = 'paddle_ocr';

  constructor(minConfidence: number = 0.85) {
    this.minConfidence = minConfidence;
  }

  /**
   * Set minimum confidence threshold for plate validation
   */
  setMinConfidence(threshold: number): void {
    if (threshold >= 0 && threshold <= 1) {
      this.minConfidence = threshold;
      logger.info(
        'OCR_SERVICE',
        `Minimum confidence threshold set to ${(threshold * 100).toFixed(1)}%`
      );
    }
  }

  /**
   * Extract license plate from a base64-encoded image
   * Returns best candidate plate with full validation results
   */
  async extractLicensePlate(imageBase64: string): Promise<OCRExtractionResult> {
    const startTime = performance.now();

    try {
      // Try PaddleOCR first (main extraction method)
      const paddleResults = await this.extractWithPaddleOCR(imageBase64);
      const endTime = performance.now();

      if (paddleResults.candidates.length === 0) {
        logger.warn('OCR_SERVICE', 'No OCR candidates extracted from image');
        return {
          plate: null,
          confidence: 0,
          format: 'unknown',
          candidates: [],
          selectedCandidateIndex: -1,
          extractionMethod: 'paddle_ocr',
          processingTimeMs: endTime - startTime,
          validationReport: 'No text detected in image',
        };
      }

      // Validate all candidates
      const validatedCandidates = paddleResults.candidates.map((candidate, idx) => {
        const validation = validateOCRResult(
          candidate.text,
          candidate.confidence,
          this.minConfidence
        );

        return {
          text: candidate.text,
          confidence: candidate.confidence,
          frame: 0, // Single frame
          validation,
          selected: false,
        } as OCRCandidate;
      });

      // Select best plate
      const selectedPlate = selectBestPlate(validatedCandidates);
      const selectedIndex = selectedPlate
        ? validatedCandidates.indexOf(selectedPlate)
        : -1;

      if (selectedPlate) {
        selectedPlate.selected = true;
        selectedPlate.reason = `Highest confidence valid format (${(selectedPlate.confidence * 100).toFixed(1)}%)`;
      }

      // Generate validation report
      const validationReport = generateValidationReport(
        validatedCandidates,
        selectedPlate
      ).report;

      const result: OCRExtractionResult = {
        plate: selectedPlate?.text || null,
        confidence: selectedPlate?.confidence || 0,
        format: selectedPlate?.validation.format || 'unknown',
        candidates: validatedCandidates,
        selectedCandidateIndex: selectedIndex,
        extractionMethod: 'paddle_ocr',
        processingTimeMs: endTime - startTime,
        validationReport,
      };

      // Log extraction to custody
      this.logOCRExtraction(result, imageBase64);

      return result;
    } catch (error) {
      const endTime = performance.now();
      logger.error('OCR_SERVICE', 'License plate extraction failed', error);

      return {
        plate: null,
        confidence: 0,
        format: 'unknown',
        candidates: [],
        selectedCandidateIndex: -1,
        extractionMethod: 'paddle_ocr',
        processingTimeMs: endTime - startTime,
        validationReport: `Extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Extract from multiple image frames and select best result
   */
  async extractFromMultipleFrames(imageBase64Array: string[]): Promise<OCRExtractionResult> {
    if (imageBase64Array.length === 0) {
      return {
        plate: null,
        confidence: 0,
        format: 'unknown',
        candidates: [],
        selectedCandidateIndex: -1,
        extractionMethod: 'paddle_ocr',
        processingTimeMs: 0,
        validationReport: 'No frames provided',
      };
    }

    // Extract from each frame
    const allResults = await Promise.all(
      imageBase64Array.map((img) => this.extractLicensePlate(img))
    );

    // Collect all unique candidates across frames
    const allCandidates: OCRCandidate[] = [];
    allResults.forEach((result, frameIdx) => {
      result.candidates.forEach((candidate) => {
        const existing = allCandidates.find((c) => c.text === candidate.text);
        if (existing) {
          existing.confidence = Math.max(existing.confidence, candidate.confidence);
        } else {
          allCandidates.push({ ...candidate, frame: frameIdx });
        }
      });
    });

    // Select best overall
    const selectedPlate = selectBestPlate(allCandidates);
    if (selectedPlate) {
      selectedPlate.selected = true;
      selectedPlate.reason = `Selected from ${imageBase64Array.length} frames`;
    }

    const totalProcessingTime = allResults.reduce((sum, r) => sum + r.processingTimeMs, 0);

    return {
      plate: selectedPlate?.text || null,
      confidence: selectedPlate?.confidence || 0,
      format: selectedPlate?.validation.format || 'unknown',
      candidates: allCandidates,
      selectedCandidateIndex: allCandidates.indexOf(selectedPlate || null),
      extractionMethod: 'paddle_ocr',
      processingTimeMs: totalProcessingTime,
      validationReport: generateValidationReport(allCandidates, selectedPlate).report,
    };
  }

  /**
   * Internal: Extract using PaddleOCR backend service
   */
  private async extractWithPaddleOCR(
    imageBase64: string
  ): Promise<{ candidates: Array<{ text: string; confidence: number }> }> {
    try {
      const response = await fetch(getApiUrl('/api/ocr/plate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) {
        throw new Error(`OCR service returned ${response.status}`);
      }

      const data = await response.json();

      // Extract candidates from response
      if (Array.isArray(data.candidates)) {
        return {
          candidates: data.candidates.map((c: any) => ({
            text: (c.text || '').trim().toUpperCase(),
            confidence: Math.min(1, Math.max(0, parseFloat(c.confidence) || 0)),
          })),
        };
      }

      // Single result format
      if (data.plate && data.confidence) {
        return {
          candidates: [
            {
              text: (data.plate || '').trim().toUpperCase(),
              confidence: Math.min(1, Math.max(0, parseFloat(data.confidence) || 0)),
            },
          ],
        };
      }

      return { candidates: [] };
    } catch (error) {
      logger.warn('OCR_SERVICE', 'PaddleOCR extraction failed, fallback to retry', error);
      return { candidates: [] };
    }
  }

  /**
   * Detect license plate region in image (bounding box)
   * Returns approximate location for detail crop
   */
  async detectPlateRegion(imageBase64: string): Promise<PlateDetectionRegion | null> {
    try {
      const response = await fetch(getApiUrl('/api/ocr/detect-plate-region'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (data.x !== undefined && data.y !== undefined && data.width && data.height) {
        return {
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          confidence: data.confidence || 0.5,
        };
      }

      return null;
    } catch (error) {
      logger.warn('OCR_SERVICE', 'Plate region detection failed', error);
      return null;
    }
  }

  /**
   * Log OCR extraction to custody system
   */
  private async logOCRExtraction(result: OCRExtractionResult, imageBase64: string): Promise<void> {
    try {
      const imageBinary = this.base64ToBlob(imageBase64, 'image/jpeg');
      const imageHash = await calculateSHA256(imageBinary);

      const logData = {
        extractionMethod: result.extractionMethod,
        plateExtracted: result.plate || 'NONE',
        confidence: result.confidence,
        format: result.format,
        candidateCount: result.candidates.length,
        selectedIndex: result.selectedCandidateIndex,
        processingTimeMs: result.processingTimeMs,
        imageHash,
      };

      custodyLog.addEntry(
        CustodyLogService.logEvidenceAction(
          'EVIDENCE_ACCESSED',
          'OCR_SYSTEM',
          `ocr_plate_${Date.now()}`,
          imageBinary.size,
          imageHash
        )
      );

      logger.debug('OCR_SERVICE', `Plate extraction logged: ${result.plate}`, logData);
    } catch (error) {
      logger.warn('OCR_SERVICE', 'Failed to log OCR extraction', error);
    }
  }

  /**
   * Utility: Convert base64 to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

// Singleton instance
let instance: OCRService | null = null;

export function initializeOCRService(minConfidence: number = 0.85): OCRService {
  if (!instance) {
    instance = new OCRService(minConfidence);
    logger.info('OCR_SERVICE', `Initialized with min confidence ${(minConfidence * 100).toFixed(1)}%`);
  }
  return instance;
}

export function getOCRService(): OCRService {
  if (!instance) {
    instance = new OCRService();
  }
  return instance;
}
