/**
 * RAF (RequestAnimationFrame) Scheduler
 * Manages smooth rendering by batching updates and synchronizing with browser refresh rate
 * Prevents jank and improves visual smoothness
 */

import { logger } from './logger';

/**
 * Callback function for RAF scheduled work
 */
export type RAFCallback = (deltaTime: number, timestamp: number) => void;

/**
 * Scheduled task wrapper
 */
interface ScheduledTask {
  id: string;
  callback: RAFCallback;
  priority: number; // Higher = runs first
  createdAt: number;
  lastRun?: number;
}

/**
 * RAF Scheduler for coordinating frame updates
 */
export class RAFScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private frameId: number | null = null;
  private isRunning = false;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 60;
  private stats = {
    frameCount: 0,
    droppedFrames: 0,
    taskExecutionTime: 0,
  };

  constructor() {
    logger.info('RAF_SCHEDULER', 'RAF Scheduler initialized');
  }

  /**
   * Schedule a task to run on the next frame
   */
  schedule(id: string, callback: RAFCallback, priority: number = 0): () => void {
    const task: ScheduledTask = {
      id,
      callback,
      priority,
      createdAt: Date.now(),
    };

    this.tasks.set(id, task);

    // Start RAF loop if not already running
    if (!this.isRunning) {
      this.start();
    }

    // Return unschedule function
    return () => this.unschedule(id);
  }

  /**
   * Unschedule a task
   */
  unschedule(id: string): boolean {
    const removed = this.tasks.delete(id);
    if (removed && this.tasks.size === 0) {
      this.stop();
    }
    return removed;
  }

  /**
   * Start the RAF loop
   */
  private start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameLoop(this.lastFrameTime);
  }

  /**
   * Stop the RAF loop
   */
  private stop() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.isRunning = false;
    logger.debug('RAF_SCHEDULER', `Stopped. Processed ${this.stats.frameCount} frames`);
  }

  /**
   * Main frame loop
   */
  private frameLoop = (timestamp: number) => {
    const deltaTime = Math.min(timestamp - this.lastFrameTime, 33); // Cap at ~30ms per frame
    this.lastFrameTime = timestamp;
    this.frameCount++;
    this.stats.frameCount++;

    // Sort tasks by priority (descending) before execution
    const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => b.priority - a.priority);

    // Execute all scheduled tasks
    const startTime = performance.now();
    for (const task of sortedTasks) {
      try {
        task.callback(deltaTime, timestamp);
        task.lastRun = timestamp;
      } catch (error) {
        logger.error(
          'RAF_SCHEDULER',
          `Error executing task ${task.id}`,
          error
        );
      }
    }
    const executionTime = performance.now() - startTime;
    this.stats.taskExecutionTime = executionTime;

    // Schedule next frame if tasks remain
    if (this.tasks.size > 0) {
      this.frameId = requestAnimationFrame(this.frameLoop);
    } else {
      this.stop();
    }

    // Warn if frame execution exceeded 16.67ms (60fps target)
    if (executionTime > 16.67 && this.frameCount % 60 === 0) {
      logger.warn(
        'RAF_SCHEDULER',
        `Frame execution time exceeded 16.67ms: ${executionTime.toFixed(2)}ms (${this.tasks.size} tasks)`
      );
      this.stats.droppedFrames++;
    }
  };

  /**
   * Get current statistics
   */
  getStats() {
    const avgTaskTime =
      this.stats.frameCount > 0
        ? (this.stats.taskExecutionTime / this.stats.frameCount).toFixed(2)
        : '0';

    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.size,
      frameCount: this.stats.frameCount,
      droppedFrames: this.stats.droppedFrames,
      avgTaskExecutionTime: `${avgTaskTime}ms`,
      lastTaskExecutionTime: `${this.stats.taskExecutionTime.toFixed(2)}ms`,
      frameRate: this.calculateFrameRate(),
    };
  }

  /**
   * Calculate frame rate
   */
  private calculateFrameRate(): string {
    if (this.frameCount < 2) return 'N/A';
    const elapsedTime = (this.lastFrameTime - (this.lastFrameTime - this.frameCount * 16)) / 1000;
    const fps = (this.frameCount / elapsedTime).toFixed(1);
    return `${fps} FPS`;
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();
    logger.debug('RAF_SCHEDULER',
      `Tasks: ${stats.taskCount}, Frames: ${stats.frameCount}, Dropped: ${stats.droppedFrames}, ${stats.frameRate}`
    );
  }

  /**
   * Get number of active tasks
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Clear all tasks
   */
  clear() {
    this.tasks.clear();
    if (this.isRunning) {
      this.stop();
    }
  }
}

/**
 * Global RAF scheduler instance
 */
let globalRAFScheduler: RAFScheduler | null = null;

/**
 * Get global RAF scheduler (lazy initialization)
 */
export function getRAFScheduler(): RAFScheduler {
  if (!globalRAFScheduler && typeof window !== 'undefined') {
    globalRAFScheduler = new RAFScheduler();
  }
  if (!globalRAFScheduler) {
    throw new Error('RAF Scheduler not available (browser only)');
  }
  return globalRAFScheduler;
}

/**
 * Convenience function to schedule a frame update
 */
export function scheduleFrame(id: string, callback: RAFCallback, priority?: number): () => void {
  return getRAFScheduler().schedule(id, callback, priority);
}

/**
 * Convenience function to unschedule a frame update
 */
export function unscheduleFrame(id: string): boolean {
  return getRAFScheduler().unschedule(id);
}

/**
 * Throttle a function to run at most once per frame
 */
export function throttleToFrame<T extends (...args: any[]) => void>(
  id: string,
  func: T,
  priority?: number
): T {
  let pending = false;
  let lastArgs: any[] = [];

  const executeFrame = () => {
    if (pending) {
      pending = false;
      func(...lastArgs);
      scheduleFrame(id, executeFrame, priority);
    }
  };

  return ((...args: any[]) => {
    lastArgs = args;
    if (!pending) {
      pending = true;
      scheduleFrame(id, executeFrame, priority);
    }
  }) as T;
}
