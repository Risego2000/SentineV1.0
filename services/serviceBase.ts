/**
 * Base Service Class
 * Provides common functionality for all services:
 * - Structured error handling
 * - Retry logic with exponential backoff
 * - Audit logging
 * - Type safety
 */

import { logger } from './logger';
import { AppConfig } from './appConfig';
import { ServiceResult, ok, err, RetryPolicy, DefaultRetryPolicy } from './serviceTypes';

/**
 * Base class for all services with common utilities
 */
export abstract class BaseService {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Execute an async operation with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    policy: RetryPolicy = DefaultRetryPolicy
  ): Promise<ServiceResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.info(
            this.name,
            `${operationName} completó en intento ${attempt}/${policy.maxAttempts}`
          );
        }
        return ok(result);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < policy.maxAttempts) {
          const delayMs = this.calculateBackoffDelay(attempt - 1, policy);
          logger.warn(
            this.name,
            `${operationName} intento ${attempt} falló. Reintentando en ${delayMs}ms: ${lastError.message}`
          );
          await this.delay(delayMs);
        } else {
          logger.error(
            this.name,
            `${operationName} falló después de ${policy.maxAttempts} intentos`,
            error
          );
        }
      }
    }

    return err(
      'OPERATION_FAILED',
      `${operationName} falló después de ${policy.maxAttempts} intentos`,
      { operation: operationName, lastError: lastError?.message }
    );
  }

  /**
   * Execute operation with timeout
   */
  protected async executeWithTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number = AppConfig.API.REQUEST_TIMEOUT_MS,
    operationName: string = 'Operation'
  ): Promise<ServiceResult<T>> {
    try {
      const result = await Promise.race([
        operation,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
      return ok(result);
    } catch (error) {
      logger.error(this.name, `${operationName} timeout or failed`, error);
      return err(
        'OPERATION_TIMEOUT',
        `${operationName} timeout o fallo: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  protected calculateBackoffDelay(retryCount: number, policy: RetryPolicy): number {
    const exponentialDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryCount);
    return Math.min(exponentialDelay, policy.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate input with structured error response
   */
  protected validateInput<T>(
    validator: () => boolean,
    errorMessage: string,
    errorCode: string = 'VALIDATION_FAILED'
  ): ServiceResult<T> | null {
    if (!validator()) {
      logger.validationError(this.name, 'input', errorMessage);
      return err(errorCode, errorMessage);
    }
    return null;
  }

  /**
   * Safe JSON parsing with error handling
   */
  protected safeJsonParse<T>(jsonString: string, fallback?: T): ServiceResult<T> {
    try {
      const parsed = JSON.parse(jsonString) as T;
      return ok(parsed);
    } catch (error) {
      logger.error(this.name, 'JSON parse error', error);
      if (fallback !== undefined) {
        return ok(fallback);
      }
      return err('JSON_PARSE_ERROR', 'Failed to parse JSON', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log audit event
   */
  protected auditLog(
    action: string,
    resource: string,
    status: 'success' | 'failure' = 'success',
    details?: Record<string, unknown>
  ): void {
    if (AppConfig.Features.ENABLE_AUDIT_LOGGING) {
      logger.auditLog(action, resource, status === 'success' ? 200 : 400, {
        service: this.name,
        ...details,
      });
    }
  }

  /**
   * Check if feature is enabled
   */
  protected isFeatureEnabled(feature: keyof typeof AppConfig.Features): boolean {
    return AppConfig.Features[feature] as boolean;
  }
}

/**
 * Error factory for consistent error handling
 */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }

  static fromResult<T>(result: ServiceResult<T>): ServiceError | null {
    if (result.success || !result.error) return null;
    return new ServiceError(result.error.code, result.error.message, result.error.details);
  }
}
