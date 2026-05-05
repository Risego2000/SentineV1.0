/**
 * Common Service Type Definitions
 * Provides type-safe interfaces for cross-service communication
 * Reduces bugs from type mismatches and improves IDE support
 */

import { AppConfig } from './appConfig';

/**
 * Service result wrapper for consistent error handling
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Async service result
 */
export type AsyncServiceResult<T> = Promise<ServiceResult<T>>;

/**
 * Create a successful service result
 */
export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

/**
 * Create a failed service result
 */
export function err<T>(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ServiceResult<T> {
  return {
    success: false,
    error: { code, message, details },
  };
}

/**
 * Video/Codec related types
 */
export interface VideoInfo {
  codec: (typeof AppConfig.Video.SUPPORTED_CODECS)[number] | 'unknown';
  duration: number;
  width: number;
  height: number;
  bitrate?: number;
}

export interface TranscodeOptions {
  inputPath: string;
  outputPath: string;
  outputCodec: (typeof AppConfig.Video.SUPPORTED_CODECS)[number];
  preset?: 'ultrafast' | 'fast' | 'medium' | 'slow';
  profile?: 'baseline' | 'main' | 'high';
}

/**
 * Geometry/Detection types with better type safety
 */
export interface ValidatedGeometry {
  x1: number; // 0-1 normalized
  y1: number; // 0-1 normalized
  x2: number; // 0-1 normalized
  y2: number; // 0-1 normalized
}

/**
 * Validation result with detailed feedback
 */
export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  error?: string;
  path?: string; // Property path for nested validations
}

/**
 * Retry policy for service calls
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry policy using config
 */
export const DefaultRetryPolicy: RetryPolicy = {
  maxAttempts: AppConfig.Queue.MAX_RETRIES,
  initialDelayMs: AppConfig.Queue.BASE_RETRY_DELAY_MS,
  maxDelayMs: AppConfig.Queue.MAX_RETRY_DELAY_MS,
  backoffMultiplier: 2,
};

/**
 * Audit log entry for compliance/security
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  resource: string;
  status: 'success' | 'failure' | 'pending';
  userId?: string;
  ip?: string;
  details?: Record<string, unknown>;
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: Date;
  uptime: number;
  services: {
    [key: string]: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
}

/**
 * Strict JSON validation helper
 */
export function isValidJson(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strict number validation with range
 */
export function isNumberInRange(value: unknown, min: number = 0, max: number = 1): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

/**
 * Strict string validation with length limits
 */
export function isValidString(value: unknown, minLength = 1, maxLength = 255): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

/**
 * Strict array validation with type checking
 */
export function isValidArray<T>(
  value: unknown,
  itemValidator: (item: unknown) => item is T,
  minLength = 0,
  maxLength = 1000
): value is T[] {
  return (
    Array.isArray(value) &&
    value.length >= minLength &&
    value.length <= maxLength &&
    value.every(itemValidator)
  );
}

/**
 * Enum-like string validation
 */
export function isEnumValue<T extends readonly string[]>(
  value: unknown,
  enumValues: T
): value is T[number] {
  return typeof value === 'string' && (enumValues as readonly string[]).includes(value);
}

/**
 * Request rate limiter state
 */
export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * Feature flag evaluator
 */
export interface FeatureFlagContext {
  userId?: string;
  isAdmin?: boolean;
  region?: string;
  [key: string]: unknown;
}

export function isFeatureEnabled(
  featureName: keyof typeof AppConfig.Features,
  context?: FeatureFlagContext
): boolean {
  // In the future, this could check feature flag service
  // For now, just return the static configuration value
  const value = AppConfig.Features[featureName];
  return typeof value === 'boolean' ? value : false;
}
