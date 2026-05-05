/**
 * Optimized Renderer
 * Integrates canvas pooling and RAF scheduling for smooth, efficient rendering
 * Provides high-level API for rendering operations with automatic performance optimization
 */

import { getCanvasPool, CanvasPoolManager } from './canvasPool';
import { getRAFScheduler, RAFScheduler } from './rafScheduler';
import { logger } from './logger';
import { GeometryLine, Track } from '../types';

/**
 * Render task descriptor
 */
export interface RenderTask {
  id: string;
  video: HTMLVideoElement;
  targetCanvas: HTMLCanvasElement;
  tracks: Track[];
  geometry: GeometryLine[];
  options?: RenderOptions;
}

/**
 * Render options for optimization
 */
export interface RenderOptions {
  isMeshRenderEnabled?: boolean;
  showDetections?: boolean;
  showROIs?: boolean;
  priority?: number; // RAF priority (higher = earlier)
  debounceMs?: number;
}

/**
 * Optimized Renderer implementation
 */
export class OptimizedRenderer {
  private canvasPool: CanvasPoolManager;
  private rafScheduler: RAFScheduler;
  private renderTasks: Map<string, RenderTask> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private stats = {
    totalRenders: 0,
    skippedFrames: 0,
    avgRenderTime: 0,
  };

  constructor() {
    this.canvasPool = getCanvasPool();
    this.rafScheduler = getRAFScheduler();
    logger.info('OPTIMIZED_RENDERER', 'Initialized');
  }

  /**
   * Schedule a render operation with automatic optimization
   */
  scheduleRender(task: RenderTask, options: RenderOptions = {}): () => void {
    const debounceMs = options.debounceMs || 0;

    // Clear existing debounce timer if present
    if (this.debounceTimers.has(task.id)) {
      clearTimeout(this.debounceTimers.get(task.id)!);
    }

    // Store render task
    this.renderTasks.set(task.id, task);

    // If debounce is enabled, delay scheduling
    if (debounceMs > 0) {
      const timer = setTimeout(() => {
        this.debounceTimers.delete(task.id);
        this.scheduleRAFRender(task, options);
      }, debounceMs);
      this.debounceTimers.set(task.id, timer);

      return () => {
        clearTimeout(timer);
        this.debounceTimers.delete(task.id);
        this.renderTasks.delete(task.id);
      };
    }

    return this.scheduleRAFRender(task, options);
  }

  /**
   * Schedule render on RAF (internal)
   */
  private scheduleRAFRender(task: RenderTask, options: RenderOptions): () => void {
    return this.rafScheduler.schedule(
      task.id,
      (deltaTime, timestamp) => {
        this.executeRender(task, options);
      },
      options.priority || 0
    );
  }

  /**
   * Execute the actual render operation
   */
  private executeRender(task: RenderTask, options: RenderOptions) {
    const startTime = performance.now();

    try {
      const { video, targetCanvas, tracks, geometry, options: taskOptions = {} } = task;

      // Get dimensions from source video
      const width = video.videoWidth;
      const height = video.videoHeight;

      // Sync target canvas dimensions
      if (targetCanvas.width !== width || targetCanvas.height !== height) {
        targetCanvas.width = width;
        targetCanvas.height = height;
      }

      const ctx = targetCanvas.getContext('2d');
      if (!ctx) {
        logger.error('OPTIMIZED_RENDERER', 'Failed to get 2D context');
        return;
      }

      // Draw video frame
      ctx.drawImage(video, 0, 0, width, height);

      // Draw geometry and tracks
      const isMeshRenderEnabled =
        options.isMeshRenderEnabled ?? taskOptions.isMeshRenderEnabled ?? false;
      const showDetections = options.showDetections ?? taskOptions.showDetections ?? true;
      const showROIs = options.showROIs ?? taskOptions.showROIs ?? true;

      // Save context state for performance
      ctx.save();

      try {
        // Render geometry (ROIs)
        if (showROIs) {
          this.renderGeometry(ctx, geometry, width, height, isMeshRenderEnabled);
        }

        // Render tracks/detections
        if (showDetections) {
          this.renderTracks(ctx, tracks, width, height);
        }
      } finally {
        ctx.restore();
      }

      this.stats.totalRenders++;

      // Log performance every 60 frames
      const renderTime = performance.now() - startTime;
      if (this.stats.totalRenders % 60 === 0) {
        this.stats.avgRenderTime = renderTime;
        if (renderTime > 16.67) {
          logger.warn(
            'OPTIMIZED_RENDERER',
            `Render exceeded 16.67ms target: ${renderTime.toFixed(2)}ms`
          );
          this.stats.skippedFrames++;
        }
      }
    } catch (error) {
      logger.error('OPTIMIZED_RENDERER', 'Render error', error);
    }
  }

  /**
   * Render geometry (ROIs) with optimizations
   */
  private renderGeometry(
    ctx: CanvasRenderingContext2D,
    geometry: GeometryLine[],
    width: number,
    height: number,
    isMeshRenderEnabled: boolean
  ) {
    geometry.forEach((line) => {
      ctx.save();
      const opacity = isMeshRenderEnabled ? 0.3 : 1.0;
      ctx.globalAlpha = opacity;

      // Get points for rendering
      const polyPoints =
        line.points && line.points.length > 1
          ? line.points
          : [
              { x: line.x1, y: line.y1 },
              { x: line.x2, y: line.y2 },
            ];

      // Draw path
      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x * width, polyPoints[0].y * height);
      for (let i = 1; i < polyPoints.length; i++) {
        ctx.lineTo(polyPoints[i].x * width, polyPoints[i].y * height);
      }

      // Style based on geometry type
      this.applyGeometryStyle(ctx, line);

      const isClosed = line.type === 'box_junction';
      if (isClosed) {
        ctx.closePath();
        ctx.fillStyle = this.getGeometryColor(line.type) + '26'; // 15% opacity
        ctx.fill();
      }

      ctx.stroke();

      // Draw control points if mesh rendering enabled
      if (isMeshRenderEnabled) {
        ctx.fillStyle = this.getGeometryColor(line.type);
        polyPoints.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    });
  }

  /**
   * Render tracks/detections
   */
  private renderTracks(
    ctx: CanvasRenderingContext2D,
    tracks: Track[],
    width: number,
    height: number
  ) {
    tracks.forEach((track) => {
      ctx.save();

      // Draw bounding box
      const { x, y, w, h } = track.bbox || { x: 0, y: 0, w: 0, h: 0 };
      const boxX = x * width;
      const boxY = y * height;
      const boxW = w * width;
      const boxH = h * height;

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Draw label
      if (track.label) {
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px Arial';
        ctx.fillText(track.label, boxX, boxY - 5);
      }

      ctx.restore();
    });
  }

  /**
   * Apply style to geometry context
   */
  private applyGeometryStyle(ctx: CanvasRenderingContext2D, line: GeometryLine) {
    const color = this.getGeometryColor(line.type);
    const lineWidth = this.getGeometryLineWidth(line.type);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    if (line.type === 'lane_divider') {
      ctx.setLineDash([15, 10]);
    }
  }

  /**
   * Get color for geometry type
   */
  private getGeometryColor(type?: string): string {
    switch (type) {
      case 'forbidden':
        return '#ef4444'; // Red
      case 'stop_line':
        return '#f59e0b'; // Amber
      case 'lane_divider':
        return '#06b6d4'; // Cyan
      case 'pedestrian':
        return '#06b6d4'; // Cyan
      case 'bus_lane':
        return '#f97316'; // Orange
      default:
        return '#ffffff'; // White
    }
  }

  /**
   * Get line width for geometry type
   */
  private getGeometryLineWidth(type?: string): number {
    switch (type) {
      case 'forbidden':
        return 4;
      case 'stop_line':
        return 5;
      case 'lane_divider':
        return 2;
      case 'pedestrian':
      case 'bus_lane':
        return 3;
      default:
        return 2;
    }
  }

  /**
   * Cancel a scheduled render
   */
  cancelRender(taskId: string): boolean {
    const timer = this.debounceTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(taskId);
    }

    this.renderTasks.delete(taskId);
    return this.rafScheduler.unschedule(taskId);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      totalRenders: this.stats.totalRenders,
      skippedFrames: this.stats.skippedFrames,
      avgRenderTime: `${this.stats.avgRenderTime.toFixed(2)}ms`,
      canvasPoolStats: this.canvasPool.getStats(),
      rafSchedulerStats: this.rafScheduler.getStats(),
    };
  }

  /**
   * Log performance statistics
   */
  logStats() {
    const stats = this.getStats();
    logger.debug(
      'OPTIMIZED_RENDERER',
      `Renders: ${stats.totalRenders}, Skipped: ${stats.skippedFrames}, Avg Time: ${stats.avgRenderTime}`
    );
    this.canvasPool.logStats();
    this.rafScheduler.logStats();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Clear all render tasks
    this.renderTasks.clear();

    // Clear all debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear RAF scheduler
    this.rafScheduler.clear();

    logger.info('OPTIMIZED_RENDERER', 'Destroyed');
  }
}

/**
 * Global optimized renderer instance
 */
let globalRenderer: OptimizedRenderer | null = null;

/**
 * Get global optimized renderer (lazy initialization)
 */
export function getOptimizedRenderer(): OptimizedRenderer {
  if (!globalRenderer && typeof window !== 'undefined') {
    globalRenderer = new OptimizedRenderer();
  }
  if (!globalRenderer) {
    throw new Error('Optimized Renderer not available (browser only)');
  }
  return globalRenderer;
}
