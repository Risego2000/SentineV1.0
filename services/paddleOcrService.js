/**
 * PaddleOCR Service - License plate and timestamp extraction
 * Uses Python PaddleOCR via subprocess for reliable execution
 * WITH ERROR RECOVERY AND AUTO-RETRY
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { retryWithBackoff, fallbacks } from './errorRecoveryService.js';

// Get __dirname - use URL fallback for CommonJS compatibility
let __dirname;
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  // Fallback for CommonJS or when import.meta is unavailable
  __dirname = path.join(process.cwd(), 'services');
}

const PADDLE_OCR_SCRIPT = path.join(__dirname, 'paddle_ocr_extractor.py');

/**
 * Run Python PaddleOCR script with given input
 * @param {Object} request - Request object with operation and parameters
 * @returns {Promise<Object>} Result from OCR processing
 */
async function runPaddleOcr(request) {
  return new Promise((resolve, reject) => {
    let timeoutHandle = null;

    const process = spawn('python', [PADDLE_OCR_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set timeout
    timeoutHandle = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        process.kill('SIGTERM');
        reject(new Error('PaddleOCR process timeout (2 minutes)'));
      }
    }, 120000);

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutHandle);
        console.error('[PaddleOCR] Process error:', error);
        reject(error);
      }
    });

    process.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutHandle);

        if (code !== 0 && code !== null) {
          // code can be null if process was killed
          console.error('[PaddleOCR] Python script failed:', stderr);
          reject(new Error(`PaddleOCR process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (err) {
          console.error('[PaddleOCR] Failed to parse output:', stdout);
          reject(new Error(`Invalid JSON output from PaddleOCR: ${err.message}`));
        }
      }
    });

    // Send request as JSON to stdin
    process.stdin.write(JSON.stringify(request));
    process.stdin.end();
  });
}

/**
 * Extract license plate from multiple base64 images using PaddleOCR
 * WITH AUTO-RETRY AND FALLBACK
 */
export async function extractLicensePlateFromImages(base64Images = []) {
  try {
    if (!base64Images || base64Images.length === 0) {
      return { plate: 'NO_IMAGES', candidates: [], confidence: 0 };
    }

    console.log(`[PaddleOCR] Processing ${base64Images.length} image(s) for license plate extraction...`);

    // 🔴 USE AUTO-RETRY WITH EXPONENTIAL BACKOFF
    const result = await retryWithBackoff(
      async (signal) => {
        return await runPaddleOcr({
          operation: 'extract_plate',
          images: base64Images,
        });
      },
      'ocr',
      { maxRetries: 3 }
    );

    console.log(`[PaddleOCR] Result: plate="${result.plate}", candidates=${JSON.stringify(result.candidates)}`);
    return result;
  } catch (error) {
    console.error('[PaddleOCR] Error extracting license plate (all retries failed):', error);
    // 🔴 USE FALLBACK ON FINAL FAILURE
    return fallbacks.ocr(error);
  }
}

/**
 * Extract timestamp from OSD (On-Screen Display) using PaddleOCR
 * WITH AUTO-RETRY AND FALLBACK
 */
export async function extractTimestampFromOSD(base64Image) {
  try {
    if (!base64Image) {
      return { timestamp: null, osdText: null, confidence: 0 };
    }

    console.log('[PaddleOCR] Extracting timestamp from OSD...');

    // 🔴 USE AUTO-RETRY WITH EXPONENTIAL BACKOFF
    const result = await retryWithBackoff(
      async (signal) => {
        return await runPaddleOcr({
          operation: 'extract_timestamp',
          image: base64Image,
        });
      },
      'ocr',
      { maxRetries: 2 } // Fewer retries for timestamp (simpler task)
    );

    console.log(`[PaddleOCR] OSD text: "${result.osdText}", extracted timestamp: "${result.timestamp}"`);
    return result;
  } catch (error) {
    console.error('[PaddleOCR] Error extracting timestamp (all retries failed):', error);
    // Return fallback with timestamp null (will use system time)
    return {
      timestamp: null,
      osdText: null,
      confidence: 0,
      error: error.message,
      fallback: true,
    };
  }
}

/**
 * Shutdown OCR worker (no-op for subprocess-based implementation)
 */
export async function shutdownOcrWorker() {
  console.log('[PaddleOCR] Shutdown (no-op for subprocess implementation)');
}
