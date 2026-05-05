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
  extractionMethod: 'plate_recognizer' | 'paddle_ocr' | 'tensorflow' | 'fallback';
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
  private minConfidence: number = 0.6;
  private detectionMethod: 'paddle_ocr' | 'yolo' | 'heuristic' = 'paddle_ocr';
  private plateRegionEndpointAvailable = true;
  private readonly maxBatchFrames = 12;

  private pickSpreadFrames<T>(items: T[], limit: number): T[] {
    if (items.length <= limit) return [...items];
    const out: T[] = [];
    for (let i = 0; i < limit; i++) {
      const idx = Math.round((i * (items.length - 1)) / Math.max(1, limit - 1));
      out.push(items[idx]);
    }
    return out;
  }

  constructor(minConfidence: number = 0.6) {
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
      const selectedIndex = selectedPlate ? validatedCandidates.indexOf(selectedPlate) : -1;

      if (selectedPlate) {
        selectedPlate.selected = true;
        selectedPlate.reason = `Highest confidence valid format (${(selectedPlate.confidence * 100).toFixed(1)}%)`;
      }

      // Generate validation report
      const validationReport = generateValidationReport(validatedCandidates, selectedPlate).report;

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

    const startedAt = performance.now();
    const sourceFrames = this.pickSpreadFrames(imageBase64Array, this.maxBatchFrames);
    const batch = await this.extractWithPaddleOCRBatch(sourceFrames);

    const voted = new Map<
      string,
      { bestConfidence: number; sumConfidence: number; hits: number; firstFrame: number }
    >();
    batch.perFrameCandidates.forEach((frameCandidates, frameIdx) => {
      frameCandidates.forEach((c) => {
        const key = c.text;
        const prev = voted.get(key);
        if (!prev) {
          voted.set(key, {
            bestConfidence: c.confidence,
            sumConfidence: c.confidence,
            hits: 1,
            firstFrame: frameIdx,
          });
          return;
        }
        prev.bestConfidence = Math.max(prev.bestConfidence, c.confidence);
        prev.sumConfidence += c.confidence;
        prev.hits += 1;
      });
    });

    const allCandidates: OCRCandidate[] = Array.from(voted.entries()).map(([text, agg]) => {
      const avg = agg.sumConfidence / Math.max(1, agg.hits);
      const boosted = Math.min(1, agg.bestConfidence * 0.8 + avg * 0.2 + Math.min(0.08, agg.hits * 0.02));
      const validation = validateOCRResult(text, boosted, this.minConfidence);
      return {
        text,
        confidence: boosted,
        frame: agg.firstFrame,
        validation,
        selected: false,
        reason: `Consensus ${agg.hits}/${sourceFrames.length} frames`,
      } as OCRCandidate;
    });

    // Select best overall
    const selectedPlate = selectBestPlate(allCandidates);
    if (selectedPlate) {
      selectedPlate.selected = true;
      selectedPlate.reason = `Selected from ${imageBase64Array.length} frames`;
    }

    const totalProcessingTime = performance.now() - startedAt;

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
   * Multi-frame extraction with forced plate-crop fallback.
   * 1) Try normal extraction.
   * 2) If no valid plate, generate focused crops and retry OCR.
   */
  async extractFromMultipleFramesWithPlateCrops(
    imageBase64Array: string[]
  ): Promise<OCRExtractionResult> {
    const primary = await this.extractFromMultipleFrames(imageBase64Array);
    if (primary.plate) {
      const confirmation = await this.extractWithGeminiConfirmation(imageBase64Array[0]);
      if (confirmation && confirmation.text === primary.plate) {
        primary.validationReport = `${primary.validationReport}\n\n[CONFIRMATION] Gemini confirmó la matrícula ${primary.plate} (${(confirmation.confidence * 100).toFixed(1)}%).`;
      }
      return primary;
    }

    const fallbackStart = performance.now();
    const fallbackCandidates: string[] = [];

    // Limit work to first frames to avoid UI pressure.
    const sourceFrames = this.pickSpreadFrames(imageBase64Array, 12);
    for (const frame of sourceFrames) {
      const crops = await this.generatePlateCropVariants(frame);
      fallbackCandidates.push(...crops);
    }

    // Enhancement pass over crop candidates (contrast/gray/binarized)
    const enhancedCandidates: string[] = [];
    for (const crop of this.pickSpreadFrames(fallbackCandidates, 24)) {
      const enhanced = await this.generateEnhancedVariants(crop);
      enhancedCandidates.push(...enhanced);
    }
    fallbackCandidates.push(...enhancedCandidates);

    if (fallbackCandidates.length === 0) {
      return primary;
    }

    const fallback = await this.extractFromMultipleFrames(fallbackCandidates);
    const fallbackElapsed = performance.now() - fallbackStart;

    if (fallback.plate) {
      const confirmedImage = fallbackCandidates[0] || imageBase64Array[0];
      const confirmation = await this.extractWithGeminiConfirmation(confirmedImage);
      const confirmationNote =
        confirmation && confirmation.text === fallback.plate
          ? `\n[CONFIRMATION] Gemini confirmó la matrícula ${fallback.plate} (${(confirmation.confidence * 100).toFixed(1)}%).`
          : '\n[CONFIRMATION] Gemini no confirmó la misma matrícula.';

      return {
        ...fallback,
        processingTimeMs: primary.processingTimeMs + fallback.processingTimeMs + fallbackElapsed,
        validationReport:
          `${primary.validationReport}\n\n[FALLBACK_CROPS] Applied ${fallbackCandidates.length} plate-focused crops.\n` +
          fallback.validationReport +
          confirmationNote,
      };
    }

    // Merge candidates from both passes for forensic traceability.
    const mergedCandidates = [...primary.candidates];
    for (const c of fallback.candidates) {
      const existing = mergedCandidates.find((x) => x.text === c.text);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, c.confidence);
      } else {
        mergedCandidates.push(c);
      }
    }

    const selectedPlate = selectBestPlate(mergedCandidates);
    if (selectedPlate) {
      selectedPlate.selected = true;
      selectedPlate.reason = 'Selected after merged primary + plate-crop fallback passes';
    }

    return {
      plate: selectedPlate?.text || null,
      confidence: selectedPlate?.confidence || 0,
      format: selectedPlate?.validation.format || 'unknown',
      candidates: mergedCandidates,
      selectedCandidateIndex: mergedCandidates.indexOf(selectedPlate || null),
      extractionMethod: 'paddle_ocr',
      processingTimeMs: primary.processingTimeMs + fallback.processingTimeMs + fallbackElapsed,
      validationReport:
        `${primary.validationReport}\n\n[FALLBACK_CROPS] Applied ${fallbackCandidates.length} plate-focused crops.` +
        `\n${fallback.validationReport}`,
    };
  }

  /**
   * Internal: Extract using PaddleOCR backend service
   */
  private async extractWithPaddleOCR(
    imageBase64: string
  ): Promise<{ candidates: Array<{ text: string; confidence: number }>; method?: string }> {
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

      // Extract candidates from response (supports multiple backend shapes)
      if (Array.isArray(data.candidates)) {
        return {
          candidates: data.candidates.map((c: any) => ({
            text: (c.text || '').trim().toUpperCase(),
            confidence: Math.min(1, Math.max(0, parseFloat(c.confidence) || 0)),
          })),
          method: String(data.method || ''),
        };
      }

      if (Array.isArray(data.results)) {
        return {
          candidates: data.results.map((c: any) => ({
            text: (c.text || c.plate || '').trim().toUpperCase(),
            confidence: Math.min(1, Math.max(0, parseFloat(c.confidence ?? c.score) || 0)),
          })),
          method: String(data.method || ''),
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
          method: String(data.method || ''),
        };
      }

      if (data.text) {
        return {
          candidates: [
            {
              text: String(data.text).trim().toUpperCase(),
              confidence: Math.min(1, Math.max(0, parseFloat(data.confidence ?? 0.5) || 0.5)),
            },
          ],
          method: String(data.method || ''),
        };
      }

      return { candidates: [] };
    } catch (error) {
      logger.warn('OCR_SERVICE', 'PaddleOCR extraction failed, fallback to retry', error);
      return { candidates: [] };
    }
  }

  private async extractWithPaddleOCRBatch(
    imagesBase64: string[]
  ): Promise<{ perFrameCandidates: Array<Array<{ text: string; confidence: number }>> }> {
    try {
      const response = await fetch(getApiUrl('/api/ocr/plate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesBase64.slice(0, this.maxBatchFrames) }),
      });

      if (!response.ok) {
        throw new Error(`OCR batch service returned ${response.status}`);
      }

      const data = await response.json();
      const topCandidates: Array<{ text: string; confidence: number }> = [];
      if (Array.isArray(data.candidates)) {
        for (const c of data.candidates) {
          const text = String(c?.text || '').trim().toUpperCase();
          const confidence = Math.min(1, Math.max(0, Number(c?.confidence ?? 0)));
          if (text) topCandidates.push({ text, confidence });
        }
      } else if (data?.plate) {
        const text = String(data.plate || '').trim().toUpperCase();
        const confidence = Math.min(1, Math.max(0, Number(data?.confidence ?? 0.5)));
        if (text) topCandidates.push({ text, confidence });
      }

      // Backend may not return per-frame split; use replicated candidates as fallback.
      const perFrameCandidates = imagesBase64.map(() => [...topCandidates]);
      return { perFrameCandidates };
    } catch (error) {
      logger.warn('OCR_SERVICE', 'PaddleOCR batch extraction failed; falling back to per-frame', error);
      const perFrameCandidates: Array<Array<{ text: string; confidence: number }>> = [];
      for (const img of imagesBase64) {
        const single = await this.extractWithPaddleOCR(img);
        perFrameCandidates.push(single.candidates || []);
      }
      return { perFrameCandidates };
    }
  }

  /**
   * Last-resort specialized OCR confirmation via Gemini Vision.
   */
  private async extractWithGeminiConfirmation(
    imageBase64: string
  ): Promise<{ text: string; confidence: number } | null> {
    try {
      const response = await fetch(getApiUrl('/api/ocr/plate-confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const plate = String(data?.plate || '')
        .trim()
        .toUpperCase();
      if (!plate) return null;
      const confidence = Math.min(1, Math.max(0, Number(data?.confidence ?? 0.6)));
      return { text: plate, confidence };
    } catch (error) {
      logger.warn('OCR_SERVICE', 'Gemini confirmation fallback failed', error);
      return null;
    }
  }

  private async extractWithGeminiMultiConfirmation(
    imagesBase64: string[]
  ): Promise<{ text: string; confidence: number } | null> {
    const votes = new Map<string, { hits: number; best: number; sum: number }>();
    for (const image of imagesBase64.slice(0, 4)) {
      const single = await this.extractWithGeminiConfirmation(image);
      if (!single?.text) continue;
      const key = single.text;
      const prev = votes.get(key) || { hits: 0, best: 0, sum: 0 };
      prev.hits += 1;
      prev.best = Math.max(prev.best, single.confidence);
      prev.sum += single.confidence;
      votes.set(key, prev);
    }

    let bestPlate: string | null = null;
    let bestScore = -1;
    for (const [plate, agg] of votes.entries()) {
      const avg = agg.sum / Math.max(1, agg.hits);
      const score = agg.hits * 0.7 + avg * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestPlate = plate;
      }
    }

    if (!bestPlate) return null;
    const agg = votes.get(bestPlate)!;
    return {
      text: bestPlate,
      confidence: Math.min(1, Math.max(0, agg.best * 0.8 + (agg.sum / agg.hits) * 0.2)),
    };
  }

  /**
   * Public hard fallback: force Gemini confirmation over multiple frames.
   * Used by evidentiary finalization when regular OCR yields no plate.
   */
  async extractPlateWithGeminiFromFrames(
    imagesBase64: string[]
  ): Promise<{ plate: string | null; confidence: number }> {
    try {
      const candidate = await this.extractWithGeminiMultiConfirmation(
        this.pickSpreadFrames(imagesBase64, 20)
      );
      if (!candidate?.text) return { plate: null, confidence: 0 };
      return { plate: candidate.text, confidence: candidate.confidence };
    } catch (error) {
      logger.warn('OCR_SERVICE', 'Forced Gemini multi-frame fallback failed', error);
      return { plate: null, confidence: 0 };
    }
  }

  /**
   * Deep fallback:
   * 1) Enhance every frame with backend enhancer.
   * 2) OCR over enhanced batch.
   * 3) Keep highest-confidence valid candidate.
   */
  async extractPlateDeepFallback(
    imagesBase64: string[]
  ): Promise<{ plate: string | null; confidence: number; method: string }> {
    try {
      const frames = this.pickSpreadFrames(imagesBase64.filter(Boolean), 20);
      if (!frames.length) return { plate: null, confidence: 0, method: 'deep_none' };

      const enhancedPool: string[] = [];
      for (const frame of frames) {
        try {
          const resp = await fetch(getApiUrl('/api/images/enhance'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: frame,
              target_height: 1400,
              profile: 'forensic_safe',
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const enhanced = String(data?.enhanced || '').trim();
            if (enhanced) {
              // enhancer may return with/without data URL prefix
              const b64 = enhanced.startsWith('data:') ? enhanced.split(',')[1] : enhanced;
              if (b64) enhancedPool.push(b64);
            }
          }
        } catch {
          // continue, best effort
        }
      }

      const ocrInputs = [...frames, ...enhancedPool];
      const batch = await this.extractWithPaddleOCRBatch(ocrInputs);
      let best: { text: string; confidence: number } | null = null;
      for (const arr of batch.perFrameCandidates) {
        for (const c of arr) {
          const v = validateOCRResult(c.text, c.confidence, 0.45);
          if (!v.isValid) continue;
          if (!best || c.confidence > best.confidence) best = c;
        }
      }

      if (best) {
        return { plate: best.text, confidence: best.confidence, method: 'deep_enhance_paddle' };
      }

      return { plate: null, confidence: 0, method: 'deep_none' };
    } catch (error) {
      logger.warn('OCR_SERVICE', 'Deep fallback OCR failed', error);
      return { plate: null, confidence: 0, method: 'deep_error' };
    }
  }

  /**
   * Generate plate-focused crop variants from a vehicle/detail frame.
   * Combines backend-detected region (if available) + robust heuristics.
   */
  private async generatePlateCropVariants(imageBase64: string): Promise<string[]> {
    try {
      const variants: string[] = [];
      const region = await this.detectPlateRegion(imageBase64);

      if (region) {
        const detected = await this.cropImageBase64(imageBase64, {
          x: Math.max(0, region.x - region.width * 0.15),
          y: Math.max(0, region.y - region.height * 0.25),
          width: Math.min(1, region.width * 1.3),
          height: Math.min(1, region.height * 1.5),
        });
        if (detected) variants.push(detected);
      }

      // Heuristic crops for common rear/front plate zones in vehicle crops.
      const heuristicRegions = [
        { x: 0.18, y: 0.52, width: 0.64, height: 0.28 },
        { x: 0.22, y: 0.58, width: 0.56, height: 0.24 },
        { x: 0.28, y: 0.6, width: 0.44, height: 0.2 },
        { x: 0.12, y: 0.46, width: 0.76, height: 0.34 },
      ];

      for (const rect of heuristicRegions) {
        const crop = await this.cropImageBase64(imageBase64, rect);
        if (crop) variants.push(crop);
      }

      // De-duplicate crop payloads
      return [...new Set(variants)];
    } catch (error) {
      logger.warn('OCR_SERVICE', 'Plate crop variant generation failed', error);
      return [];
    }
  }

  /**
   * Crop a base64 image using normalized rect [0..1].
   */
  private async cropImageBase64(
    imageBase64: string,
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const sx = Math.max(0, Math.floor(rect.x * img.width));
          const sy = Math.max(0, Math.floor(rect.y * img.height));
          const sw = Math.max(2, Math.floor(rect.width * img.width));
          const sh = Math.max(2, Math.floor(rect.height * img.height));

          const maxW = img.width - sx;
          const maxH = img.height - sy;
          const cw = Math.max(2, Math.min(sw, maxW));
          const ch = Math.max(2, Math.min(sh, maxH));

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(480, Math.min(1920, Math.round(cw * 2.8)));
          canvas.height = Math.max(180, Math.min(720, Math.round(ch * 2.8)));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.96).split(',')[1] || null);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/jpeg;base64,${imageBase64}`;
    });
  }

  /**
   * Generate enhanced variants to improve OCR in difficult frames.
   */
  private async generateEnhancedVariants(imageBase64: string): Promise<string[]> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const variants: string[] = [];
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve([]);
            return;
          }

          // Variant 1: high contrast + slight brightness
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.filter = 'contrast(1.45) brightness(1.08) saturate(0.9)';
          ctx.drawImage(img, 0, 0);
          variants.push(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);

          // Variant 2: grayscale + contrast
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.filter = 'grayscale(1) contrast(1.6) brightness(1.05)';
          ctx.drawImage(img, 0, 0);
          variants.push(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);

          // Variant 3: adaptive-ish threshold (simple binarization)
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.filter = 'grayscale(1) contrast(1.8)';
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const v = data[i];
            const t = v > 120 ? 255 : 0;
            data[i] = t;
            data[i + 1] = t;
            data[i + 2] = t;
          }
          ctx.putImageData(imageData, 0, 0);
          variants.push(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);

          ctx.filter = 'none';
          resolve(variants.filter(Boolean));
        } catch {
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = `data:image/jpeg;base64,${imageBase64}`;
    });
  }

  /**
   * Detect license plate region in image (bounding box)
   * Returns approximate location for detail crop
   */
  async detectPlateRegion(imageBase64: string): Promise<PlateDetectionRegion | null> {
    if (!this.plateRegionEndpointAvailable) return null;
    try {
      const response = await fetch(getApiUrl('/api/ocr/detect-plate-region'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          this.plateRegionEndpointAvailable = false;
          logger.warn(
            'OCR_SERVICE',
            `Plate region endpoint unavailable (${response.status}). Disabling this probe for current session.`
          );
        }
        return null;
      }

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
    logger.info(
      'OCR_SERVICE',
      `Initialized with min confidence ${(minConfidence * 100).toFixed(1)}%`
    );
  }
  return instance;
}

export function getOCRService(): OCRService {
  if (!instance) {
    instance = new OCRService();
  }
  return instance;
}
