/**
 * YOLO-based License Plate Detection Service
 * Detects license plate locations in vehicle frames
 * Complements COCO-SSD vehicle detection
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.ts';

// Use services directory relative to current working directory
const __dirname = path.join(process.cwd(), 'services');

// Python script for YOLO plate detection
const YOLO_PLATE_DETECTOR_SCRIPT = path.join(__dirname, 'yolo_plate_detector.py');

/**
 * Detect license plate in image using YOLO
 * @param {string} frameBase64 - Frame as base64 JPEG
 * @returns {Promise<{plate_box: {x, y, width, height}, confidence: number, detections: array}>}
 */
export async function detectPlateWithYOLO(frameBase64) {
  return new Promise((resolve, reject) => {
    try {
      if (!frameBase64 || typeof frameBase64 !== 'string') {
        return resolve({ plate_box: null, confidence: 0, detections: [] });
      }

      // Check if Python script exists
      if (!fs.existsSync(YOLO_PLATE_DETECTOR_SCRIPT)) {
        logger.warn('YOLO_PLATE', `Script not found: ${YOLO_PLATE_DETECTOR_SCRIPT}`);
        return resolve({ plate_box: null, confidence: 0, detections: [] });
      }

      const pythonProcess = spawn('python', [YOLO_PLATE_DETECTOR_SCRIPT]);

      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('YOLO plate detection timeout (>10s)'));
      }, 10000);

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          logger.debug('YOLO_PLATE', `Detection failed (code ${code}): ${stderr.slice(0, 100)}`);
          return resolve({ plate_box: null, confidence: 0, detections: [] });
        }

        try {
          const result = JSON.parse(stdout);
          return resolve(result);
        } catch (parseErr) {
          logger.warn('YOLO_PLATE', `JSON parse error: ${parseErr.message}`);
          return resolve({ plate_box: null, confidence: 0, detections: [] });
        }
      });

      // Send request
      const request = {
        operation: 'detect_plate',
        image: frameBase64,
      };

      pythonProcess.stdin.write(JSON.stringify(request));
      pythonProcess.stdin.end();
    } catch (error) {
      logger.warn('YOLO_PLATE', `Spawn error: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Detect plates in multiple frames and return best detection
 * @param {string[]} framesBase64 - Array of frames as base64
 * @returns {Promise<{plate_box, confidence, best_frame_index}>}
 */
export async function detectPlateInFrames(framesBase64) {
  try {
    if (!Array.isArray(framesBase64) || framesBase64.length === 0) {
      return { plate_box: null, confidence: 0, best_frame_index: -1 };
    }

    const detections = await Promise.all(
      framesBase64.map((frame, idx) =>
        detectPlateWithYOLO(frame)
          .then((result) => ({
            ...result,
            frame_index: idx,
          }))
          .catch((err) => {
            logger.debug('YOLO_PLATE', `Frame ${idx} detection error: ${err.message}`);
            return { plate_box: null, confidence: 0, frame_index: idx };
          })
      )
    );

    // Find best detection
    const validDetections = detections.filter((d) => d.plate_box && d.confidence > 0.5);

    if (validDetections.length === 0) {
      return { plate_box: null, confidence: 0, best_frame_index: -1 };
    }

    // Sort by confidence and return best
    const best = validDetections.sort((a, b) => b.confidence - a.confidence)[0];
    logger.info('YOLO_PLATE', `Best plate detection: confidence=${best.confidence}, frame=${best.frame_index}`);

    return {
      plate_box: best.plate_box,
      confidence: best.confidence,
      best_frame_index: best.frame_index,
      all_detections: validDetections.length,
    };
  } catch (error) {
    logger.warn('YOLO_PLATE', `Error detecting plates in frames: ${error.message}`);
    return { plate_box: null, confidence: 0, best_frame_index: -1 };
  }
}

/**
 * Extract plate region from frame using YOLO detection
 * @param {string} frameBase64 - Full frame as base64
 * @param {object} plateBox - Bounding box from YOLO: {x, y, width, height}
 * @returns {string} Cropped plate region as base64
 */
export function extractPlateRegionFromBox(frameBase64, plateBox) {
  if (!frameBase64 || !plateBox) {
    return frameBase64;
  }

  try {
    // In Node.js context (server-side), we'd need to use a library like sharp
    // For now, return the detection box info
    return {
      original: frameBase64,
      plate_box: plateBox,
      note: 'Use client-side canvas API or sharp library to crop',
    };
  } catch (error) {
    logger.warn('YOLO_PLATE', `Error extracting plate region: ${error.message}`);
    return frameBase64;
  }
}

export default {
  detectPlateWithYOLO,
  detectPlateInFrames,
  extractPlateRegionFromBox,
};
