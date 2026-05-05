/**
 * Canvas Pool Manager
 * Manages a pool of reusable canvas elements to reduce memory allocation overhead
 * Improves performance by reusing canvas elements instead of creating new ones
 */

import { logger } from './logger';

/**
 * Canvas pool configuration
 */
export interface CanvasPoolConfig {
  maxPoolSize: number;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * Pooled canvas wrapper with metadata
 */
interface PooledCanvas {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  inUse: boolean;
  createdAt: number;
  lastUsedAt: number;
  width: number;
  height: number;
}

/**
 * Canvas Pool Manager
 * Implements object pool pattern for canvas elements
 */
export class CanvasPoolManager {
  private pool: PooledCanvas[] = [];
  private config: CanvasPoolConfig;
  private stats = {
    createdCount: 0,
    requestCount: 0,
    cacheHitCount: 0,
  };

  constructor(config: Partial<CanvasPoolConfig> = {}) {
    this.config = {
      maxPoolSize: config.maxPoolSize || 10,
      defaultWidth: config.defaultWidth || 1920,
      defaultHeight: config.defaultHeight || 1080,
    };
    logger.info('CANVAS_POOL', `Initialized with max pool size: ${this.config.maxPoolSize}`);
  }

  /**
   * Get or create a canvas element
   */
  acquire(width: number = this.config.defaultWidth, height: number = this.config.defaultHeight) {
    // Try to find a matching canvas in the pool
    const availableCanvas = this.pool.find(
      (c) => !c.inUse && c.width === width && c.height === height
    );

    if (availableCanvas) {
      availableCanvas.inUse = true;
      availableCanvas.lastUsedAt = Date.now();
      this.stats.cacheHitCount++;
      return {
        canvas: availableCanvas.canvas,
        context: availableCanvas.context,
        release: () => this.release(availableCanvas),
      };
    }

    // Create a new canvas if pool not full
    if (this.pool.length < this.config.maxPoolSize) {
      return this.createNew(width, height);
    }

    // Pool is full, evict least recently used
    const lru = this.pool.reduce((min, current) =>
      current.lastUsedAt < min.lastUsedAt ? current : min
    );
    this.reset(lru, width, height);

    return {
      canvas: lru.canvas,
      context: lru.context,
      release: () => this.release(lru),
    };
  }

  /**
   * Create a new canvas and add to pool
   */
  private createNew(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }

    const pooled: PooledCanvas = {
      canvas,
      context,
      inUse: true,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      width,
      height,
    };

    this.pool.push(pooled);
    this.stats.createdCount++;
    this.stats.requestCount++;

    return {
      canvas,
      context,
      release: () => this.release(pooled),
    };
  }

  /**
   * Reset a canvas to new dimensions
   */
  private reset(pooled: PooledCanvas, width: number, height: number) {
    pooled.canvas.width = width;
    pooled.canvas.height = height;
    pooled.inUse = true;
    pooled.lastUsedAt = Date.now();
    pooled.width = width;
    pooled.height = height;

    // Clear context state
    const ctx = pooled.context;
    if (typeof ctx.reset === 'function') {
      ctx.reset();
    } else {
      this.clearContext(ctx);
    }

    this.stats.requestCount++;
  }

  /**
   * Clear canvas context state (fallback for browsers without reset())
   */
  private clearContext(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.resetTransform?.();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 1;
  }

  /**
   * Release a canvas back to the pool
   */
  release(pooled: PooledCanvas) {
    if (pooled.inUse) {
      pooled.inUse = false;
      pooled.lastUsedAt = Date.now();

      // Clear context to release image data
      this.clearContext(pooled.context);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const inUseCount = this.pool.filter((c) => c.inUse).length;
    const hitRate =
      this.stats.requestCount > 0
        ? ((this.stats.cacheHitCount / this.stats.requestCount) * 100).toFixed(1)
        : '0';

    return {
      poolSize: this.pool.length,
      maxPoolSize: this.config.maxPoolSize,
      inUse: inUseCount,
      available: this.pool.length - inUseCount,
      createdTotal: this.stats.createdCount,
      requestCount: this.stats.requestCount,
      cacheHitRate: `${hitRate}%`,
    };
  }

  /**
   * Cleanup all canvases and clear pool
   */
  destroy() {
    this.pool.forEach((pooled) => {
      pooled.canvas.remove();
    });
    this.pool = [];
    this.stats = { createdCount: 0, requestCount: 0, cacheHitCount: 0 };
    logger.info('CANVAS_POOL', 'Pool destroyed and cleared');
  }

  /**
   * Log pool statistics
   */
  logStats() {
    const stats = this.getStats();
    logger.info(
      'CANVAS_POOL',
      `Stats - Size: ${stats.poolSize}/${stats.maxPoolSize}, In Use: ${stats.inUse}, Hit Rate: ${stats.cacheHitRate}`
    );
  }
}

/**
 * Global canvas pool instance
 */
export let globalCanvasPool: CanvasPoolManager | null = null;

/**
 * Initialize global canvas pool
 */
export function initializeCanvasPool(config?: Partial<CanvasPoolConfig>): CanvasPoolManager {
  if (typeof window !== 'undefined') {
    globalCanvasPool = new CanvasPoolManager(config);
    return globalCanvasPool;
  }
  throw new Error('Canvas pool can only be initialized in browser environment');
}

/**
 * Get global canvas pool (lazy initialization)
 */
export function getCanvasPool(): CanvasPoolManager {
  if (!globalCanvasPool && typeof window !== 'undefined') {
    globalCanvasPool = new CanvasPoolManager();
  }
  if (!globalCanvasPool) {
    throw new Error('Canvas pool not initialized');
  }
  return globalCanvasPool;
}
