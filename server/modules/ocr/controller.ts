/**
 * OCR Controller - Server-side PHASE 6
 * Handles OCR extraction requests from client
 */

import { Request, Response } from 'express';
import { getOCRBackend } from './service';
import { logger } from '../../../services/logger';

export class OCRController {
  /**
   * POST /api/ocr/extract-plate
   * Extract license plate from image
   */
  static async extractPlate(req: Request, res: Response): Promise<void> {
    try {
      const { image, images } = req.body;
      const normalizedImages = Array.isArray(images)
        ? images.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
        : [];
      const singleImage = typeof image === 'string' && image.length > 0 ? image : null;

      if (!singleImage && normalizedImages.length === 0) {
        res.status(400).json({ error: 'Missing or invalid image/images parameter' });
        return;
      }

      const ocrBackend = getOCRBackend();
      const result = await ocrBackend.extractPlate(singleImage ?? normalizedImages);

      res.json({
        plate: result.plate,
        candidates: result.candidates,
        confidence: result.confidence,
        method: result.method,
      });
    } catch (error) {
      logger.error('OCR_CONTROLLER', 'Extract plate failed', error);
      res.status(500).json({
        error: 'License plate extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/ocr/detect-plate-region
   * Detect license plate region in image
   */
  static async detectPlateRegion(req: Request, res: Response): Promise<void> {
    try {
      const { image } = req.body;

      if (!image || typeof image !== 'string') {
        res.status(400).json({ error: 'Missing or invalid image parameter' });
        return;
      }

      const ocrBackend = getOCRBackend();
      const region = await ocrBackend.detectPlateRegion(image);

      if (!region) {
        res.json({ error: 'Could not detect plate region' });
        return;
      }

      res.json(region);
    } catch (error) {
      logger.error('OCR_CONTROLLER', 'Detect plate region failed', error);
      res.status(500).json({
        error: 'Plate region detection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/ocr/timestamp
   * Extract timestamp from image OSD
   */
  static async extractTimestamp(req: Request, res: Response): Promise<void> {
    try {
      const { image } = req.body;

      if (!image || typeof image !== 'string') {
        res.status(400).json({ error: 'Missing or invalid image parameter' });
        return;
      }

      const ocrBackend = getOCRBackend();
      const result = await ocrBackend.extractTimestamp(image);

      res.json({
        timestamp: result.timestamp,
        osdText: result.osdText,
        confidence: result.confidence,
      });
    } catch (error) {
      logger.error('OCR_CONTROLLER', 'Extract timestamp failed', error);
      res.status(500).json({
        error: 'Timestamp extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
