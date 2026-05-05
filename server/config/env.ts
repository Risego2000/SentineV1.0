/**
 * Server Configuration - Environment Validation
 * Centralizes all environment variable parsing and validation
 * PHASE 4: Modularization of server.js config validation
 */

import { loadLocalEnvFile } from '../../services/aiServer.js';

export interface ServerConfig {
  port: number;
  isProduction: boolean;
  isElectron: boolean;
  resourcesPath?: string;
  reportsDir: string;
  maxTranscodeBytes: number;
  maxReportMb: number;
  maxTranscodeConcurrency: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  apiToken: string;
  allowedOrigins: string[];
  allowedCameraHosts: string[];
}

/**
 * Parse positive integer from environment variable with validation
 */
function parsePositiveIntEnv(
  name: string,
  fallback: number,
  min: number = 1,
  max: number = Number.MAX_SAFE_INTEGER
): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`[ENV] ${name} inválida: "${raw}". Debe ser entero entre ${min} y ${max}.`);
  }
  return parsed;
}

/**
 * Load and validate all server configuration from environment
 * Throws if any critical environment variable is invalid
 */
export function validateServerEnv(): ServerConfig {
  loadLocalEnvFile();

  const port = parsePositiveIntEnv('PORT', 3002, 1, 65535);
  const isProduction = process.env.NODE_ENV === 'production';
  const isElectron = process.env.IS_ELECTRON === 'true';
  const resourcesPath = process.env.RESOURCES_PATH;
  const reportsDir = process.env.REPORTS_DIR || 'C:\\Denuncias';

  const maxTranscodeBytes = parsePositiveIntEnv(
    'TRANSCODE_MAX_BYTES',
    250 * 1024 * 1024,
    1_000_000,
    2_000_000_000
  );
  const maxReportMb = parsePositiveIntEnv('REPORT_MAX_MB', 100, 1, 2000);
  const maxTranscodeConcurrency = parsePositiveIntEnv('TRANSCODE_MAX_CONCURRENCY', 2, 1, 16);

  const rateLimitWindowMs = parsePositiveIntEnv(
    'API_RATE_LIMIT_WINDOW_MS',
    60_000,
    1000,
    3_600_000
  );
  const rateLimitMaxRequests = parsePositiveIntEnv('API_RATE_LIMIT_MAX_REQUESTS', 120, 1, 10_000);

  const apiToken = process.env.SENTINEL_API_TOKEN || '';
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedCameraHosts = (process.env.IP_CAMERA_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error('[ENV] ALLOWED_ORIGINS no puede quedar vacío.');
  }

  return {
    port,
    isProduction,
    isElectron,
    resourcesPath,
    reportsDir,
    maxTranscodeBytes,
    maxReportMb,
    maxTranscodeConcurrency,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    apiToken,
    allowedOrigins,
    allowedCameraHosts,
  };
}
