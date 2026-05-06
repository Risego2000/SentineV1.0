/**
 * Error Recovery Service
 * Handles automatic retries, fallbacks, and graceful degradation
 */

import { logger } from './logger.ts';

/**
 * Retry configuration per operation type
 */
const RETRY_CONFIG = {
  ocr: {
    maxRetries: 1,
    baseDelayMs: 100,
    backoffMultiplier: 1.5,
    timeoutMs: 8000,
    retryableErrors: [
      'TIMEOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EOF',
      'EPIPE',
      'ECONNRESET',
      'BROKEN PIPE',
      'stdin',
    ],
  },
  gemini: {
    maxRetries: 1,
    baseDelayMs: 200,
    backoffMultiplier: 1.5,
    timeoutMs: 10000,
    retryableErrors: ['429', 'TIMEOUT', 'INTERNAL_ERROR'],
  },
  transcoding: {
    maxRetries: 2,
    baseDelayMs: 2000,
    backoffMultiplier: 2,
    timeoutMs: 600000, // 10 minutes
    retryableErrors: ['ENOSPACE', 'EAGAIN', 'TIMEOUT'],
  },
  express: {
    maxRetries: 5,
    baseDelayMs: 300,
    backoffMultiplier: 1.5,
    timeoutMs: 5000,
    retryableErrors: ['ECONNREFUSED', 'ENOTFOUND', 'TIMEOUT'],
  },
};

/**
 * Execute async function with automatic retries
 *
 * @param {Function} operation - Async function to execute
 * @param {string} operationType - Type: 'ocr', 'gemini', 'transcoding', 'express'
 * @param {object} options - Override config
 * @returns {Promise<any>} Operation result
 */
export async function retryWithBackoff(operation, operationType = 'express', options = {}) {
  const config = { ...RETRY_CONFIG[operationType], ...options };
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await executeWithTimeout(operation, config.timeoutMs);
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error, config.retryableErrors);

      if (!isRetryable || attempt === config.maxRetries) {
        logger.error(
          'ERROR_RECOVERY',
          `Operation failed after ${attempt + 1} attempts: ${error.message}`,
          {
            operationType,
            attempt: attempt + 1,
            maxRetries: config.maxRetries,
            isRetryable,
          }
        );
        throw error;
      }

      // Calculate backoff delay
      const delayMs = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
      const jitterMs = Math.random() * delayMs * 0.1; // ±10% jitter

      logger.warn(
        'ERROR_RECOVERY',
        `Retry ${attempt + 1}/${config.maxRetries} for ${operationType} in ${(delayMs + jitterMs).toFixed(0)}ms`,
        {
          error: error.message,
          attempt: attempt + 1,
          delayMs: delayMs + jitterMs,
        }
      );

      // Wait before retry
      await sleep(delayMs + jitterMs);
    }
  }

  throw lastError;
}

/**
 * Execute function with timeout
 */
async function executeWithTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      operation(controller.signal),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs + 100)
      ),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error, retryableErrors = []) {
  const errorStr = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toString() || '';

  return retryableErrors.some(
    (pattern) => errorStr.includes(pattern.toLowerCase()) || errorCode.includes(pattern)
  );
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fallback strategies for different operation failures
 */
export const fallbacks = {
  /**
   * OCR fallback: return default "unknown" response
   */
  ocr: (error) => {
    logger.warn('ERROR_RECOVERY', `OCR fallback triggered: ${error.message}`);
    return {
      plate: 'UNKNOWN',
      candidates: [],
      confidence: 0,
      error: error.message,
      fallback: true,
    };
  },

  /**
   * Gemini analysis fallback: mark for manual review
   */
  gemini: (error) => {
    logger.warn('ERROR_RECOVERY', `Gemini fallback triggered: ${error.message}`);
    return {
      infraction: false,
      severity: 'LOW',
      description: 'Análisis automático falló. Requiere revisión manual.',
      ruleCategory: 'MANUAL_REVIEW',
      legalBase: 'Revisión Manual',
      reasoning: ['Error en análisis automático'],
      _requiresManualReview: true,
      _fallback: true,
      error: error.message,
    };
  },

  /**
   * Geometry generation fallback: return empty geometry
   */
  geometry: (error) => {
    logger.warn('ERROR_RECOVERY', `Geometry fallback triggered: ${error.message}`);
    return {
      lines: [],
      suggestedDirectives: 'Error en generación. Configure geometría manualmente.',
      _fallback: true,
      error: error.message,
    };
  },

  /**
   * Image enhancement fallback: return original image
   */
  imageEnhance: (error, originalBase64) => {
    logger.warn('ERROR_RECOVERY', `Image enhancement fallback triggered: ${error.message}`);
    return {
      enhanced: originalBase64, // Return original
      metadata: null,
      error: error.message,
      fallback: true,
    };
  },

  /**
   * Express server connection fallback
   */
  expressServer: (error) => {
    logger.error('ERROR_RECOVERY', `Express server unavailable: ${error.message}`);
    return {
      error: 'Backend server unavailable',
      status: 'offline',
      fallback: true,
      retry_in_seconds: 5,
    };
  },
};

/**
 * Health check with automatic reconnection
 */
export async function healthCheckWithRecovery(checkFn, maxAttempts = 5) {
  let consecutiveFailures = 0;

  return async function wrappedHealthCheck() {
    try {
      const result = await checkFn();
      if (result.healthy || result.status === 'ok') {
        consecutiveFailures = 0;
        return { healthy: true, uptime: result.uptime };
      }
    } catch (error) {
      consecutiveFailures++;
      logger.warn('HEALTH_CHECK', `Health check failed (${consecutiveFailures}/${maxAttempts})`, {
        error: error.message,
      });

      if (consecutiveFailures >= maxAttempts) {
        logger.error('HEALTH_CHECK', 'Service declared unhealthy');
        // Trigger recovery mechanism
        return {
          healthy: false,
          consecutiveFailures,
          recoverNeeded: true,
        };
      }
    }

    return { healthy: false };
  };
}

/**
 * Graceful degradation for rate-limited endpoints
 */
export class RateLimitHandler {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxQueueSize = 100;
    this.delaySinceLastRequestMs = 100;
  }

  async enqueueOperation(operation, priority = 0) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue full (${this.maxQueueSize} items)`);
    }

    this.queue.push({ operation, priority, timestamp: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);

    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const { operation } = this.queue.shift();

      try {
        await operation();
      } catch (error) {
        logger.error('RATE_LIMIT_QUEUE', `Operation failed: ${error.message}`);
      }

      // Delay between operations
      await sleep(this.delaySinceLastRequestMs);
    }

    this.processing = false;
  }

  getQueueStats() {
    return {
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      processing: this.processing,
      percentFull: (this.queue.length / this.maxQueueSize) * 100,
    };
  }
}

/**
 * Circuit breaker pattern for failing services
 */
export class CircuitBreaker {
  constructor(threshold = 5, timeoutMs = 60000) {
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.failureThreshold = threshold;
    this.timeoutMs = timeoutMs;
    this.openedAt = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      // Check if timeout elapsed
      if (Date.now() - this.openedAt > this.timeoutMs) {
        this.state = 'HALF_OPEN';
        logger.info('CIRCUIT_BREAKER', 'Entering HALF_OPEN state, attempting recovery');
      } else {
        throw new Error('Circuit breaker is OPEN (service unavailable)');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        logger.info('CIRCUIT_BREAKER', 'Service recovered, circuit CLOSED');
      }

      this.successCount++;
      return result;
    } catch (error) {
      this.failureCount++;

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
        logger.error('CIRCUIT_BREAKER', `Service failed ${this.failureCount} times, circuit OPEN`);
      }

      throw error;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      timeoutMs: this.timeoutMs,
      openedAt: this.openedAt,
    };
  }
}

export default {
  retryWithBackoff,
  fallbacks,
  healthCheckWithRecovery,
  RateLimitHandler,
  CircuitBreaker,
};
