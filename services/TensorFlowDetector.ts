/**
 * TensorFlow COCO-SSD Object Detector
 * Real browser-native detection using @tensorflow-models/coco-ssd
 *
 * Replaces YOLOv5m ONNX with proven TensorFlow.js implementation
 * Output format matches StandardDetection for drop-in replacement
 *
 * OPTIMIZADO PARA:
 * - Detecciones persistentes frame-to-frame
 * - Tracking robusto con ByteTracker
 * - IDs consistentes para vehículos
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { logger } from './logger';
import { RELEVANT_CLASSES } from '../constants';

interface DetectionOutput {
  label: string;
  score: number;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface TensorFlowDetectorConfig {
  confidenceThreshold?: number;
}

/**
 * TensorFlow COCO-SSD detector using TensorFlow.js
 * - 90 COCO classes (comprehensive vehicle detection)
 * - GPU acceleration via WebGL
 * - Optimized for persistent tracking (ByteTracker)
 * - ~100-150ms per frame on modern hardware
 */
export class TensorFlowDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  private confidenceThreshold: number = 0.25;
  private isLoading: boolean = false;
  private lastDetections: DetectionOutput[] = [];
  private frameCount: number = 0;

  constructor(config?: TensorFlowDetectorConfig) {
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.25;
  }

  /**
   * Initialize and load the COCO-SSD model
   */
  async init(): Promise<void> {
    if (this.model || this.isLoading) return;
    this.isLoading = true;

    try {
      logger.info('TENSORFLOW_DETECTOR', 'Loading COCO-SSD model...');

      // Load the model from CDN
      this.model = await cocoSsd.load();

      logger.ai('TENSORFLOW_DETECTOR', 'COCO-SSD model loaded successfully (90 COCO classes, GPU acceleration)');
    } catch (error) {
      logger.error('TENSORFLOW_DETECTOR', 'Failed to load COCO-SSD model', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Detect objects in video frame or canvas
   * Optimized for persistent tracking with ByteTracker
   * @param source HTMLVideoElement or HTMLCanvasElement
   * @returns Array of StandardDetection objects with consistent formatting
   */
  async detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<DetectionOutput[]> {
    if (!this.model) {
      logger.warn('TENSORFLOW_DETECTOR', 'Model not initialized');
      // Return last known detections for frame continuity (helps tracking)
      return this.lastDetections;
    }

    try {
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
      const readyState = source instanceof HTMLVideoElement ? source.readyState : 2;

      if (width === 0 || height === 0 || readyState < 2) {
        return this.lastDetections; // Return previous detections for continuity
      }

      // Run inference with fresh predictions
      const predictions = await this.model.detect(source);

      // Convert COCO-SSD format to StandardDetection
      const detections: DetectionOutput[] = predictions
        .filter((pred) => {
          // Confident detections for stable tracking
          if (pred.score < this.confidenceThreshold) return false;

          // Filter by relevant classes (vehicles, persons, bicycles)
          const label = pred.class.toLowerCase();
          return RELEVANT_CLASSES.includes(label);
        })
        .map((pred) => {
          const label = pred.class.toLowerCase();
          const bbox = pred.bbox; // [x, y, width, height]

          // Normalize bbox coordinates to [0-1] range
          // bbox format: [x_pixel, y_pixel, width_pixel, height_pixel]
          const x = Math.max(0, Math.min(1, bbox[0] / width));
          const y = Math.max(0, Math.min(1, bbox[1] / height));
          const w = Math.max(0.01, Math.min(1 - x, bbox[2] / width));
          const h = Math.max(0.01, Math.min(1 - y, bbox[3] / height));

          return {
            label,
            score: pred.score,
            box: { x, y, w, h },
          } as DetectionOutput;
        })
        // Sort by score (descending) for consistency in matching
        .sort((a, b) => b.score - a.score);

      // Cache detections for frame-to-frame continuity
      this.lastDetections = detections;
      this.frameCount++;

      if (this.frameCount % 30 === 0) {
        logger.debug('TENSORFLOW_DETECTOR', `Frame ${this.frameCount}: ${detections.length} detections`);
      }

      return detections;
    } catch (error) {
      logger.error('TENSORFLOW_DETECTOR', 'Detection error', error);
      // Return cached detections for continuity on error
      return this.lastDetections;
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.model) {
      logger.info('TENSORFLOW_DETECTOR', 'Disposing COCO-SSD model');
      // COCO-SSD doesn't require explicit disposal
      this.model = null;
    }
    tf.disposeVariables();
  }
}
