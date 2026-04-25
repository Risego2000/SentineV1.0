/**
 * YOLOv5m Object Detector
 * ONNX Runtime implementation for real-time vehicle detection
 *
 * Replaces MediaPipe EfficientDet Lite0 with +43% mAP improvement
 * Output format matches StandardDetection for drop-in replacement
 */

import * as ort from 'onnxruntime-web';
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

interface YOLOv5Config {
  modelPath?: string;
  confidenceThreshold?: number;
  iouThreshold?: number;
  imgSize?: number;
}

/**
 * YOLOv5m detector using ONNX Runtime
 */
export class YOLOv5Detector {
  private session: ort.InferenceSession | null = null;
  private modelPath: string;
  private confidenceThreshold: number = 0.25;
  private iouThreshold: number = 0.45;
  private imgSize: number = 640; // YOLOv5 standard input size

  // COCO class names (80 classes)
  private classNames = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
    'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis',
    'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
    'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
  ];

  constructor(config?: YOLOv5Config) {
    this.modelPath = config?.modelPath || '/models/yolov5m.onnx';
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.25;
    this.iouThreshold = config?.iouThreshold ?? 0.45;
    this.imgSize = config?.imgSize ?? 640;
  }

  /**
   * Initialize ONNX session and load model
   */
  async init(): Promise<void> {
    try {
      logger.info('YOLO_DETECTOR', `Initializing YOLOv5m model from ${this.modelPath}`);

      // Configure ONNX Runtime to use WebGL for GPU acceleration
      try {
        ort.env.wasm.wasmPaths = '/onnx-wasm/';
      } catch (e) {
        // Fallback if WASM path not available
        logger.warn('YOLO_DETECTOR', 'WASM path not configured, using default');
      }

      // Create inference session
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['webgl', 'wasm'],
        logSeverityLevel: 2, // Error level
      });

      logger.ai('YOLO_DETECTOR', 'YOLOv5m model loaded successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('YOLO_DETECTOR', 'Failed to initialize YOLOv5m', err);
      throw err;
    }
  }

  /**
   * Detect objects in video frame or canvas
   * @param source HTMLVideoElement or HTMLCanvasElement
   * @returns Array of StandardDetection objects
   */
  async detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<DetectionOutput[]> {
    if (!this.session) {
      logger.warn('YOLO_DETECTOR', 'Session not initialized');
      return [];
    }

    try {
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
      const readyState = source instanceof HTMLVideoElement ? source.readyState : 2;

      if (width === 0 || height === 0 || readyState < 2) {
        return [];
      }

      // Preprocess: resize and normalize
      const { tensor, originalWidth, originalHeight, scaleX, scaleY } = this.preprocessFrame(
        source,
        width,
        height
      );

      try {
        // Run inference
        const outputName = this.session.outputNames[0];
        const output = await this.session.run({ images: tensor });
        const outputTensor = output[outputName];

        // Postprocess: NMS and filtering
        const detections = this.postprocess(
          outputTensor.data as Float32Array,
          outputTensor.dims as number[],
          originalWidth,
          originalHeight,
          scaleX,
          scaleY
        );

        return detections;
      } finally {
        tensor.dispose();
      }
    } catch (error) {
      logger.error('YOLO_DETECTOR', 'Detection error', error);
      return [];
    }
  }

  /**
   * Preprocess frame: resize to 640x640, normalize, convert to tensor
   */
  private preprocessFrame(
    source: HTMLVideoElement | HTMLCanvasElement,
    width: number,
    height: number
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = this.imgSize;
    canvas.height = this.imgSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Letterbox: maintain aspect ratio with padding
    const scale = Math.min(this.imgSize / width, this.imgSize / height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (this.imgSize - scaledWidth) / 2;
    const offsetY = (this.imgSize - scaledHeight) / 2;

    ctx.fillStyle = '#128';
    ctx.fillRect(0, 0, this.imgSize, this.imgSize);
    ctx.drawImage(source, offsetX, offsetY, scaledWidth, scaledHeight);

    const imageData = ctx.getImageData(0, 0, this.imgSize, this.imgSize);
    const data = imageData.data;

    // Convert RGBA to RGB and normalize [0, 1]
    const rgbData = new Float32Array(3 * this.imgSize * this.imgSize);
    for (let i = 0; i < data.length; i += 4) {
      rgbData[(i / 4) | 0] = data[i] / 255.0; // R
      rgbData[this.imgSize * this.imgSize + ((i / 4) | 0)] = data[i + 1] / 255.0; // G
      rgbData[2 * this.imgSize * this.imgSize + ((i / 4) | 0)] = data[i + 2] / 255.0; // B
    }

    const tensor = new ort.Tensor('float32', rgbData, [
      1,
      3,
      this.imgSize,
      this.imgSize,
    ]);

    return {
      tensor,
      originalWidth: width,
      originalHeight: height,
      scaleX: scaledWidth / width,
      scaleY: scaledHeight / height,
      offsetX,
      offsetY,
    };
  }

  /**
   * Postprocess: decode detections and apply NMS
   */
  private postprocess(
    output: Float32Array,
    dims: number[],
    originalWidth: number,
    originalHeight: number,
    scaleX: number,
    scaleY: number
  ): DetectionOutput[] {
    // YOLOv5 output format: [1, 25200, 85]
    // 25200 = 80x80 + 40x40 + 20x20 anchor boxes
    // Each box: [x, y, w, h, conf, class0, class1, ..., class79]

    const numDetections = dims[1];
    const numValues = dims[2];

    const detections: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      confidence: number;
      classIdx: number;
      classConfidence: number;
    }> = [];

    const offsetX = (this.imgSize - originalWidth * scaleX) / 2;
    const offsetY = (this.imgSize - originalHeight * scaleY) / 2;

    // Decode detections
    for (let i = 0; i < numDetections; i++) {
      const baseIdx = i * numValues;

      // Box coordinates (center point format in model output)
      const xCenter = output[baseIdx];
      const yCenter = output[baseIdx + 1];
      const w = output[baseIdx + 2];
      const h = output[baseIdx + 3];
      const confidence = output[baseIdx + 4];

      // Skip low confidence
      if (confidence < this.confidenceThreshold) continue;

      // Find class with highest probability
      let maxClassProb = 0;
      let classIdx = -1;
      for (let c = 0; c < 80; c++) {
        const classProb = output[baseIdx + 5 + c];
        if (classProb > maxClassProb) {
          maxClassProb = classProb;
          classIdx = c;
        }
      }

      if (classIdx === -1 || maxClassProb < 0.3) continue;

      // Convert from model coordinates back to original frame
      const x = (xCenter - offsetX) / scaleX;
      const y = (yCenter - offsetY) / scaleY;

      detections.push({
        x,
        y,
        w: w / scaleX,
        h: h / scaleY,
        confidence,
        classIdx,
        classConfidence: maxClassProb,
      });
    }

    // Apply NMS (Non-Maximum Suppression)
    const nmsDetections = this.nms(detections, this.iouThreshold);

    // Convert to StandardDetection format
    const results: DetectionOutput[] = nmsDetections
      .map((det) => ({
        label: this.classNames[det.classIdx] || `class_${det.classIdx}`,
        score: det.confidence * det.classConfidence,
        box: {
          x: Math.max(0, Math.min(1, (det.x - det.w / 2) / originalWidth)),
          y: Math.max(0, Math.min(1, (det.y - det.h / 2) / originalHeight)),
          w: Math.min(1, det.w / originalWidth),
          h: Math.min(1, det.h / originalHeight),
        },
      }))
      .filter((det) => RELEVANT_CLASSES.includes(det.label.toLowerCase()));

    return results;
  }

  /**
   * Non-Maximum Suppression
   */
  private nms(
    detections: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      confidence: number;
      classIdx: number;
      classConfidence: number;
    }>,
    iouThreshold: number
  ) {
    // Sort by confidence descending
    detections.sort((a, b) => b.confidence * b.classConfidence - a.confidence * a.classConfidence);

    const kept: typeof detections = [];

    for (const detection of detections) {
      let keep = true;

      for (const keptDet of kept) {
        // Only apply NMS to same class
        if (detection.classIdx !== keptDet.classIdx) continue;

        const iou = this.calculateIoU(detection, keptDet);
        if (iou > iouThreshold) {
          keep = false;
          break;
        }
      }

      if (keep) {
        kept.push(detection);
      }
    }

    return kept;
  }

  /**
   * Calculate Intersection over Union
   */
  private calculateIoU(
    box1: { x: number; y: number; w: number; h: number },
    box2: { x: number; y: number; w: number; h: number }
  ): number {
    const x1Min = box1.x - box1.w / 2;
    const y1Min = box1.y - box1.h / 2;
    const x1Max = box1.x + box1.w / 2;
    const y1Max = box1.y + box1.h / 2;

    const x2Min = box2.x - box2.w / 2;
    const y2Min = box2.y - box2.h / 2;
    const x2Max = box2.x + box2.w / 2;
    const y2Max = box2.y + box2.h / 2;

    const xIntersectMin = Math.max(x1Min, x2Min);
    const yIntersectMin = Math.max(y1Min, y2Min);
    const xIntersectMax = Math.min(x1Max, x2Max);
    const yIntersectMax = Math.min(y1Max, y2Max);

    if (xIntersectMax < xIntersectMin || yIntersectMax < yIntersectMin) return 0;

    const intersectArea = (xIntersectMax - xIntersectMin) * (yIntersectMax - yIntersectMin);
    const box1Area = box1.w * box1.h;
    const box2Area = box2.w * box2.h;
    const unionArea = box1Area + box2Area - intersectArea;

    return unionArea > 0 ? intersectArea / unionArea : 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
  }
}
