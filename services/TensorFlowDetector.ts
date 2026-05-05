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
import { calculateIoU } from '../utils';

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
  private confidenceThreshold: number = 0.20; // Reduced from 0.25 for better detection in dense scenes
  private isLoading: boolean = false;
  private lastDetections: DetectionOutput[] = [];
  private frameCount: number = 0;
  private maxDensityFrames: number = 0; // Track dense scene occurrences

  constructor(config?: TensorFlowDetectorConfig) {
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.20;
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

      logger.ai(
        'TENSORFLOW_DETECTOR',
        'COCO-SSD model loaded successfully (90 COCO classes, GPU acceleration)'
      );
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
      let detections: DetectionOutput[] = predictions
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

      // Duplicate suppression within same frame (NMS-style)
      // Remove lower-confidence detections that heavily overlap with higher-confidence ones
      detections = this.suppressDuplicateDetections(detections);

      // Detect dense scenes
      if (detections.length >= 800) {
        this.maxDensityFrames++;
        if (detections.length >= 950) {
          logger.warn(
            'TENSORFLOW_DETECTOR',
            `Dense scene detected: ${detections.length} vehicles (${this.maxDensityFrames} dense frames total)`
          );
        }
      }

      // Cache detections for frame-to-frame continuity
      this.lastDetections = detections;
      this.frameCount++;

      if (this.frameCount % 30 === 0) {
        logger.debug(
          'TENSORFLOW_DETECTOR',
          `Frame ${this.frameCount}: ${detections.length} detections`
        );
      }

      return detections;
    } catch (error) {
      logger.error('TENSORFLOW_DETECTOR', 'Detection error', error);
      // Return cached detections for continuity on error
      return this.lastDetections;
    }
  }

  /**
   * Suppress duplicate detections within same frame using IoU-based NMS with grid indexing
   * Grid-based spatial indexing reduces O(n²) comparisons to O(n*k) where k is avg detections per cell
   * Essential for dense scenes with 800+ vehicles
   */
  private suppressDuplicateDetections(detections: DetectionOutput[]): DetectionOutput[] {
    if (detections.length <= 1) return detections;

    const GRID_SIZE = 10; // 10x10 grid = 100 cells
    const suppressed: DetectionOutput[] = [];
    const usedIndices = new Set<number>();

    // Grid-based spatial indexing: map detections to grid cells
    const grid = new Map<string, number[]>();
    for (let i = 0; i < detections.length; i++) {
      const det = detections[i];
      const cellX = Math.floor((det.box.x + det.box.w / 2) * GRID_SIZE);
      const cellY = Math.floor((det.box.y + det.box.h / 2) * GRID_SIZE);
      const key = `${cellX},${cellY}`;

      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key)!.push(i);
    }

    // Process detections, checking only nearby cells
    for (let i = 0; i < detections.length; i++) {
      if (usedIndices.has(i)) continue;

      const current = detections[i];
      suppressed.push(current);

      // Get neighboring cells
      const cellX = Math.floor((current.box.x + current.box.w / 2) * GRID_SIZE);
      const cellY = Math.floor((current.box.y + current.box.h / 2) * GRID_SIZE);

      const nearbyIndices = new Set<number>();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cellX + dx},${cellY + dy}`;
          const cellIndices = grid.get(key);
          if (cellIndices) {
            cellIndices.forEach((idx) => nearbyIndices.add(idx));
          }
        }
      }

      // Only compare with detections in nearby cells
      for (const j of nearbyIndices) {
        if (i >= j || usedIndices.has(j)) continue;

        const other = detections[j];

        // Only suppress same-class detections
        if (current.label !== other.label) continue;

        // Calculate IoU
        const iou = calculateIoU(current.box, other.box);

        // Suppress if >50% overlap
        if (iou > 0.5) {
          usedIndices.add(j);
        }
      }
    }

    return suppressed;
  }


  /**
   * Get max density frame count
   */
  getMaxDensityFrameCount(): number {
    return this.maxDensityFrames;
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
