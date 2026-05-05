/**
 * Robust License Plate OCR Service
 * Garantiza detección de placas con múltiples métodos y reintentos
 */

import { logger } from './logger.ts';

/**
 * Validar que la imagen sea base64 válida
 */
function isValidBase64Image(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return false;
  }

  // Check if it looks like base64
  const base64Regex = /^data:image\/\w+;base64,(.+)$|^([A-Za-z0-9+/=]+)$/;
  if (!base64Regex.test(base64String.trim())) {
    return false;
  }

  // Check minimum length (valid images are typically 1KB+)
  const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');
  return cleanBase64.length > 100;
}

/**
 * Normalize and validate plate text
 */
function normalizePlateText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove spaces, dashes, and normalize
  let normalized = text
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');

  // Spanish plates are typically 4 digits + 3 letters or variations
  // Match common patterns
  const patterns = [
    /^(\d{4}[A-Z]{3})$/, // Standard: 1234ABC
    /^(\d{3}[A-Z]{3}\d)$/, // Alternative
    /^([A-Z]{1,2}\d{4}[A-Z]{2})$/, // Some regions
  ];

  for (const pattern of patterns) {
    if (pattern.test(normalized)) {
      return normalized;
    }
  }

  // If text is long enough and has numbers+letters, it might be valid
  if (normalized.length >= 7 && /\d/.test(normalized) && /[A-Z]/.test(normalized)) {
    return normalized;
  }

  return '';
}

/**
 * Extract best image from array
 */
function selectBestImage(images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return null;
  }

  // Filter valid base64 images
  const validImages = images.filter(isValidBase64Image);

  if (validImages.length === 0) {
    return null;
  }

  // Prefer middle frames (usually best quality)
  if (validImages.length > 1) {
    return validImages[Math.floor(validImages.length / 2)];
  }

  return validImages[0];
}

/**
 * Main robust OCR function
 */
export async function robustPlateOCR(images, geminiExtractor, paddleExtractor) {
  try {
    // Validate input
    if (!images || !Array.isArray(images)) {
      logger.warn('ROBUST_OCR', 'Invalid images input');
      return { plate: null, confidence: 0, method: 'error_invalid_input' };
    }

    const validImages = images.filter(isValidBase64Image);
    if (validImages.length === 0) {
      logger.warn('ROBUST_OCR', 'No valid base64 images found');
      return { plate: null, confidence: 0, method: 'error_no_valid_images' };
    }

    logger.info('ROBUST_OCR', `Processing ${validImages.length} images for plate detection`);

    // Strategy 1: Try Gemini on multiple frames (parallel)
    logger.debug('ROBUST_OCR', 'Strategy 1: Gemini multi-frame');
    const geminiPlates = [];
    const geminiPromises = validImages.slice(0, 5).map(async (img) => {
      try {
        const result = await geminiExtractor(img);
        const plate = normalizePlateText(result?.plate || '');
        if (plate) {
          return {
            plate,
            confidence: Math.min(0.98, Number(result?.confidence || 0.85)),
          };
        }
      } catch (e) {
        logger.debug('ROBUST_OCR', `Gemini attempt failed: ${e instanceof Error ? e.message : 'unknown'}`);
      }
      return null;
    });

    const geminiResults = await Promise.all(geminiPromises);
    const validGemini = geminiResults.filter((r) => r && r.plate);

    if (validGemini.length > 0) {
      // Consensus: most common plate
      const plateCounts = new Map();
      for (const result of validGemini) {
        const count = (plateCounts.get(result.plate) || 0) + 1;
        plateCounts.set(result.plate, count);
      }

      const bestPlate = Array.from(plateCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      const finalPlate = bestPlate[0];
      const confidence = Math.min(0.98, 0.90 + Math.min(0.08, bestPlate[1] * 0.02));

      logger.info('ROBUST_OCR', `✓ SUCCESS via Gemini: ${finalPlate} (${bestPlate[1]} votes)`);
      return {
        plate: finalPlate,
        confidence,
        method: 'gemini_multiframe_consensus',
        detections: validGemini.length,
      };
    }

    logger.warn('ROBUST_OCR', 'Gemini failed, trying PaddleOCR');

    // Strategy 2: Try PaddleOCR (faster local fallback)
    try {
      const paddleResult = await paddleExtractor(validImages);

      if (paddleResult && paddleResult.plate) {
        const plate = normalizePlateText(paddleResult.plate);
        if (plate) {
          const confidence = Math.max(0.75, Number(paddleResult.confidence || 0.80));
          logger.info('ROBUST_OCR', `✓ SUCCESS via PaddleOCR: ${plate}`);
          return {
            plate,
            confidence,
            method: 'paddle_ocr_single',
            detections: 1,
          };
        }
      }

      // Check candidates
      if (paddleResult && paddleResult.candidates && Array.isArray(paddleResult.candidates)) {
        for (const candidate of paddleResult.candidates) {
          const plate = normalizePlateText(candidate.text || candidate.plate || '');
          if (plate) {
            const confidence = Math.max(0.75, Number(candidate.confidence || 0.75));
            logger.info('ROBUST_OCR', `✓ SUCCESS via PaddleOCR candidate: ${plate}`);
            return {
              plate,
              confidence,
              method: 'paddle_ocr_candidate',
              detections: 1,
            };
          }
        }
      }
    } catch (paddleError) {
      logger.debug('ROBUST_OCR', `PaddleOCR failed: ${paddleError instanceof Error ? paddleError.message : 'unknown'}`);
    }

    logger.warn('ROBUST_OCR', 'All OCR methods failed - no plate detected');
    return {
      plate: null,
      confidence: 0,
      method: 'all_methods_failed',
      detections: 0,
    };
  } catch (error) {
    logger.error('ROBUST_OCR', `Unexpected error: ${error instanceof Error ? error.message : 'unknown'}`);
    return {
      plate: null,
      confidence: 0,
      method: 'error_exception',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate plate result
 */
export function isValidPlateResult(result) {
  return (
    result &&
    result.plate &&
    typeof result.plate === 'string' &&
    result.plate.length >= 6 &&
    /[0-9]/.test(result.plate) &&
    /[A-Z]/.test(result.plate)
  );
}
