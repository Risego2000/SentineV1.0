/**
 * Image Enhancement Service - JavaScript Wrapper
 * Mejora de imágenes para OCR de alta calidad
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Get __dirname - use URL fallback for CommonJS compatibility
let __dirname;
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  // Fallback for CommonJS or when import.meta is unavailable
  __dirname = path.join(process.cwd(), 'services');
}

/**
 * Enhance single image for OCR
 * @param {string} imageBase64 - Input image as base64
 * @param {number} targetHeight - Target height for upsampling (default 600)
 * @returns {Promise<{enhanced: string, metadata: object, error: null|string}>}
 */
export async function enhanceImageForOCR(
  imageBase64,
  targetHeight = 600,
  profile = 'forensic_safe'
) {
  return new Promise((resolve, reject) => {
    try {
      const pythonProcess = spawn('python', [path.join(__dirname, 'image_enhancement.py')]);

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Image enhancement timeout (>15s)'));
      }, 15000);

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          console.error(`[IMAGE_ENHANCEMENT] Error (code ${code}):`, stderr);
          reject(new Error(`Image enhancement failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            console.warn(`[IMAGE_ENHANCEMENT] Enhancement warning:`, result.error);
          }
          resolve(result);
        } catch (parseErr) {
          console.error('[IMAGE_ENHANCEMENT] JSON parse error:', parseErr);
          reject(parseErr);
        }
      });

      // Send request
      const request = {
        operation: 'enhance_single',
        image: imageBase64,
        target_height: targetHeight,
        profile,
      };

      pythonProcess.stdin.write(JSON.stringify(request));
      pythonProcess.stdin.end();
    } catch (error) {
      console.error('[IMAGE_ENHANCEMENT] Spawn error:', error);
      reject(error);
    }
  });
}

/**
 * Enhance batch of images for OCR
 * @param {string[]} imagesBase64 - Array of base64 images
 * @param {number} targetHeight - Target height for upsampling (default 600)
 * @returns {Promise<{enhanced_images: string[], metadata: object[], success_count: number}>}
 */
export async function enhanceImagesForOCR(
  imagesBase64,
  targetHeight = 600,
  profile = 'forensic_safe'
) {
  return new Promise((resolve, reject) => {
    try {
      const pythonProcess = spawn('python', [path.join(__dirname, 'image_enhancement.py')]);

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Batch enhancement timeout (>30s)'));
      }, 30000);

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          console.error(`[IMAGE_ENHANCEMENT] Batch error (code ${code}):`, stderr);
          reject(new Error(`Batch enhancement failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          console.log(
            `[IMAGE_ENHANCEMENT] Batch: ${result.success_count}/${result.total} enhanced`
          );
          resolve(result);
        } catch (parseErr) {
          console.error('[IMAGE_ENHANCEMENT] JSON parse error:', parseErr);
          reject(parseErr);
        }
      });

      // Send request
      const request = {
        operation: 'enhance_batch',
        images: imagesBase64,
        target_height: targetHeight,
        profile,
      };

      pythonProcess.stdin.write(JSON.stringify(request));
      pythonProcess.stdin.end();
    } catch (error) {
      console.error('[IMAGE_ENHANCEMENT] Spawn error:', error);
      reject(error);
    }
  });
}

const sha256Base64 = (base64) =>
  crypto.createHash('sha256').update(Buffer.from(base64 || '', 'base64')).digest('hex');

export async function enhanceImageDualForOCR(imageBase64, targetHeight = 600) {
  const [forensicSafe, visualAggressive] = await Promise.all([
    enhanceImageForOCR(imageBase64, targetHeight, 'forensic_safe'),
    enhanceImageForOCR(imageBase64, targetHeight, 'visual_aggressive'),
  ]);

  return {
    forensic_safe: forensicSafe,
    visual_aggressive: visualAggressive,
    hashes: {
      original_sha256: sha256Base64(imageBase64),
      forensic_safe_sha256: forensicSafe?.enhanced ? sha256Base64(forensicSafe.enhanced) : null,
      visual_aggressive_sha256: visualAggressive?.enhanced
        ? sha256Base64(visualAggressive.enhanced)
        : null,
    },
  };
}

/**
 * Quality check - determine if image needs enhancement
 * @param {string} imageBase64 - Base64 image
 * @returns {boolean} true if needs enhancement
 */
export async function needsEnhancement(imageBase64) {
  try {
    const result = await enhanceImageForOCR(imageBase64, 600);
    if (!result.metadata) return false;

    const metrics = result.metadata.quality_metrics || {};

    // Needs enhancement si: blur alto O contraste bajo
    const needsBlurFix = result.metadata.blur_score > 0.4;
    const needsContrastFix = result.metadata.contrast_improvement_percent < 90;

    return needsBlurFix || needsContrastFix;
  } catch (error) {
    console.warn('[IMAGE_ENHANCEMENT] needsEnhancement check failed:', error.message);
    return false; // Default: use original if check fails
  }
}

export default {
  enhanceImageForOCR,
  enhanceImagesForOCR,
  enhanceImageDualForOCR,
  needsEnhancement,
};
