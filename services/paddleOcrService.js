/**
 * PaddleOCR Service - License plate and timestamp extraction
 * Uses Python PaddleOCR via subprocess for reliable execution
 * WITH ERROR RECOVERY AND AUTO-RETRY
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
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

const resolvePythonExecutable = () => {
  const bundled = path.join(process.cwd(), 'resources', 'python', 'python.exe');
  try {
    if (process.platform === 'win32' && fs.existsSync(bundled)) return bundled;
  } catch {
    // Fallback to system python.
  }
  return 'python';
};

const PADDLE_OCR_SCRIPT = path.join(process.cwd(), 'resources', 'paddle_ocr_extractor.py');
const PYTHON_EXE = resolvePythonExecutable();

/**
 * Run Python PaddleOCR script with given input
 * @param {Object} request - Request object with operation and parameters
 * @returns {Promise<Object>} Result from OCR processing
 */
async function runPaddleOcr(request) {
  return new Promise((resolve, reject) => {
    let timeoutHandle = null;
    let settled = false;
    let earlyExit = null;

    const childProc = spawn(PYTHON_EXE, [PADDLE_OCR_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';

    const fail = (error, shouldKill = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      if (shouldKill) {
        try {
          childProc.kill('SIGTERM');
        } catch {
          // ignore kill errors
        }
      }
      reject(error);
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(value);
    };

    // Set timeout
    timeoutHandle = setTimeout(() => {
      fail(new Error('PaddleOCR process timeout (2 minutes)'), true);
    }, 120000);

    childProc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProc.stdin.on('error', (error) => {
      console.error('[PaddleOCR] Failed to write request to Python stdin:', error);
      const details = stderr?.trim() ? ` | stderr: ${stderr.trim()}` : '';
      const wrapped = new Error(`PaddleOCR stdin write failed (${error.code || 'UNKNOWN'}): ${error.message}${details}`);
      wrapped.code = error.code || 'EPIPE';
      fail(wrapped, true);
    });

    childProc.on('error', (error) => {
      console.error('[PaddleOCR] Process error:', error);
      fail(error);
    });

    childProc.on('exit', (code, signal) => {
      if (settled) return;
      earlyExit = { code, signal };
    });

    childProc.on('close', (code) => {
      if (settled) return;

      if (code !== 0 && code !== null) {
        console.error('[PaddleOCR] Python script failed:', stderr);
        const err = new Error(`PaddleOCR process exited with code ${code}: ${stderr}`);
        err.code = 'PROCESS_EXIT';
        fail(err);
        return;
      }

      if (!stdout || !stdout.trim()) {
        const exitInfo = earlyExit
          ? `exitCode=${earlyExit.code}, signal=${earlyExit.signal}`
          : 'exit info unavailable';
        const err = new Error(
          `PaddleOCR returned empty output (${exitInfo}). stderr: ${stderr || 'none'}`
        );
        err.code = 'EOF';
        fail(err);
        return;
      }

      try {
        const result = JSON.parse(stdout);
        succeed(result);
      } catch (err) {
        console.error('[PaddleOCR] Failed to parse output:', stdout);
        fail(new Error(`Invalid JSON output from PaddleOCR: ${err.message}`));
      }
    });

    // Send request as JSON to stdin. Python may exit early on startup errors,
    // so handle EPIPE/EOF through the stdin error listener above.
    childProc.stdin.write(JSON.stringify(request), (error) => {
      if (error) {
        childProc.stdin.emit('error', error);
        return;
      }
      if (!settled) {
        childProc.stdin.end();
      }
    });
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

    console.log(
      `[PaddleOCR] Processing ${base64Images.length} image(s) for license plate extraction...`
    );

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

    console.log(
      `[PaddleOCR] Result: plate="${result.plate}", candidates=${JSON.stringify(result.candidates)}`
    );
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

    console.log(
      `[PaddleOCR] OSD text: "${result.osdText}", extracted timestamp: "${result.timestamp}"`
    );
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
