/**
 * PaddleOCR Service - License plate and timestamp extraction
 * Uses Python PaddleOCR via subprocess for reliable execution
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PADDLE_OCR_SCRIPT = path.join(__dirname, 'paddle_ocr_extractor.py');

/**
 * Run Python PaddleOCR script with given input
 * @param {Object} request - Request object with operation and parameters
 * @returns {Promise<Object>} Result from OCR processing
 */
async function runPaddleOcr(request) {
  return new Promise((resolve, reject) => {
    const process = spawn('python', [PADDLE_OCR_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000, // 2 minutes timeout
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      console.error('[PaddleOCR] Process error:', error);
      reject(error);
    });

    process.on('close', (code) => {
      if (code !== 0) {
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
    });

    // Send request as JSON to stdin
    process.stdin.write(JSON.stringify(request));
    process.stdin.end();
  });
}

/**
 * Extract license plate from multiple base64 images using PaddleOCR
 */
export async function extractLicensePlateFromImages(base64Images = []) {
  try {
    if (!base64Images || base64Images.length === 0) {
      return { plate: 'NO_IMAGES', candidates: [], confidence: 0 };
    }

    console.log(`[PaddleOCR] Processing ${base64Images.length} image(s) for license plate extraction...`);

    const result = await runPaddleOcr({
      operation: 'extract_plate',
      images: base64Images,
    });

    console.log(`[PaddleOCR] Result: plate="${result.plate}", candidates=${JSON.stringify(result.candidates)}`);
    return result;
  } catch (error) {
    console.error('[PaddleOCR] Error extracting license plate:', error);
    return {
      plate: 'ERROR',
      candidates: [],
      confidence: 0,
    };
  }
}

/**
 * Extract timestamp from OSD (On-Screen Display) using PaddleOCR
 */
export async function extractTimestampFromOSD(base64Image) {
  try {
    if (!base64Image) {
      return { timestamp: null, osdText: null, confidence: 0 };
    }

    console.log('[PaddleOCR] Extracting timestamp from OSD...');

    const result = await runPaddleOcr({
      operation: 'extract_timestamp',
      image: base64Image,
    });

    console.log(`[PaddleOCR] OSD text: "${result.osdText}", extracted timestamp: "${result.timestamp}"`);
    return result;
  } catch (error) {
    console.error('[PaddleOCR] Error extracting timestamp:', error);
    return {
      timestamp: null,
      osdText: null,
      confidence: 0,
    };
  }
}

/**
 * Shutdown OCR worker (no-op for subprocess-based implementation)
 */
export async function shutdownOcrWorker() {
  console.log('[PaddleOCR] Shutdown (no-op for subprocess implementation)');
}
