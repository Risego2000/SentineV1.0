/**
 * OCR Module Router - PHASE 6
 * Handles PaddleOCR license plate and timestamp extraction
 */

import { Router } from 'express';
import type { ServerConfig } from '../../config/env.js';
import { OCRController } from './controller';

export function createOCRRouter(config: ServerConfig): Router {
  const router = Router();

  /**
   * POST /api/ocr/extract-plate
   * Extract license plate from base64 image
   */
  router.post('/api/ocr/extract-plate', OCRController.extractPlate);
  // Backward-compatible aliases used by frontend/electron clients.
  router.post('/api/ocr/plate', OCRController.extractPlate);
  router.post('/api/ocr/plate-confirm', OCRController.extractPlate);

  /**
   * POST /api/ocr/detect-plate-region
   * Detect license plate region (bounding box)
   */
  router.post('/api/ocr/detect-plate-region', OCRController.detectPlateRegion);

  /**
   * POST /api/ocr/timestamp
   * Extract timestamp from image OSD
   */
  router.post('/api/ocr/timestamp', OCRController.extractTimestamp);

  return router;
}
