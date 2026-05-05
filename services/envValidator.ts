/**
 * Environment Variable Validator
 * Validates that all required environment variables are set and properly formatted
 * Runs at application startup to fail fast on configuration errors
 */

import { AppConfig } from './appConfig';

/**
 * Environment variable schema with validation
 */
export interface EnvSchema {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  default?: string;
  validator?: (value: string) => boolean;
}

/**
 * Required environment variables schema
 */
const ENV_SCHEMA: EnvSchema[] = [
  {
    name: 'PORT',
    required: false,
    type: 'number',
    description: 'Server port number',
    default: '3002',
    validator: (val) => {
      const num = parseInt(val, 10);
      return num > 0 && num < 65536;
    },
  },
  {
    name: 'GEMINI_API_KEY',
    required: true,
    type: 'string',
    description: 'Google Gemini API key for AI services',
    validator: (val) => val.length > 20,
  },
  {
    name: 'SENTINEL_API_TOKEN',
    required: true,
    type: 'string',
    description: 'API token for authentication',
    validator: (val) => /^[a-zA-Z0-9_-]{32,}$/.test(val),
  },
  {
    name: 'ALLOWED_ORIGINS',
    required: false,
    type: 'string',
    description: 'Comma-separated list of allowed CORS origins',
    default: 'http://localhost:3001,http://127.0.0.1:3001',
  },
  {
    name: 'REPORTS_DIR',
    required: false,
    type: 'string',
    description: 'Directory for storing forensic reports',
    default: 'C:\\Denuncias',
  },
  {
    name: 'TRANSCODE_MAX_BYTES',
    required: false,
    type: 'number',
    description: 'Maximum video file size in bytes',
    default: String(250 * 1024 * 1024),
    validator: (val) => {
      const num = parseInt(val, 10);
      return num > 1_000_000 && num < 2_000_000_000;
    },
  },
  {
    name: 'TRANSCODE_MAX_CONCURRENCY',
    required: false,
    type: 'number',
    description: 'Maximum concurrent transcode operations',
    default: '2',
    validator: (val) => {
      const num = parseInt(val, 10);
      return num > 0 && num <= 16;
    },
  },
  {
    name: 'API_RATE_LIMIT_WINDOW_MS',
    required: false,
    type: 'number',
    description: 'Rate limit window in milliseconds',
    default: String(60_000),
    validator: (val) => {
      const num = parseInt(val, 10);
      return num >= 1000 && num <= 3_600_000;
    },
  },
  {
    name: 'API_RATE_LIMIT_MAX_REQUESTS',
    required: false,
    type: 'number',
    description: 'Maximum requests per rate limit window',
    default: '120',
    validator: (val) => {
      const num = parseInt(val, 10);
      return num >= 1 && num <= 10_000;
    },
  },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: Array<{
    variable: string;
    message: string;
  }>;
  warnings: Array<{
    variable: string;
    message: string;
  }>;
  values: Record<string, unknown>;
}

/**
 * Validate environment variables at startup
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: Array<{ variable: string; message: string }> = [];
  const warnings: Array<{ variable: string; message: string }> = [];
  const values: Record<string, unknown> = {};

  for (const schema of ENV_SCHEMA) {
    const envValue = process.env[schema.name];

    // Check if required variable is missing
    if (schema.required && !envValue) {
      errors.push({
        variable: schema.name,
        message: `Required environment variable "${schema.name}" is not set. ${schema.description}`,
      });
      continue;
    }

    // Use default value if available
    const value = envValue || schema.default;
    if (!value) {
      if (schema.required) {
        errors.push({
          variable: schema.name,
          message: `Required environment variable "${schema.name}" has no value and no default.`,
        });
      }
      continue;
    }

    // Type validation and conversion
    try {
      switch (schema.type) {
        case 'number': {
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            errors.push({
              variable: schema.name,
              message: `Environment variable "${schema.name}" must be a valid number, got "${value}"`,
            });
          } else {
            values[schema.name] = num;
          }
          break;
        }

        case 'boolean': {
          const bool = value.toLowerCase() === 'true' || value === '1';
          values[schema.name] = bool;
          break;
        }

        case 'json': {
          try {
            const json = JSON.parse(value);
            values[schema.name] = json;
          } catch {
            errors.push({
              variable: schema.name,
              message: `Environment variable "${schema.name}" must be valid JSON`,
            });
          }
          break;
        }

        case 'string':
        default: {
          values[schema.name] = value;
          break;
        }
      }
    } catch (error) {
      errors.push({
        variable: schema.name,
        message: `Error parsing environment variable "${schema.name}": ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    // Custom validation
    if (schema.validator && typeof values[schema.name] === 'string') {
      if (!schema.validator(values[schema.name] as string)) {
        errors.push({
          variable: schema.name,
          message: `Environment variable "${schema.name}" value is invalid. ${schema.description}`,
        });
      }
    }
  }

  // Check for suspicious/dangerous configurations
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SENTINEL_API_TOKEN?.includes('default-')) {
      warnings.push({
        variable: 'SENTINEL_API_TOKEN',
        message: 'Default API token detected in production. Please set a strong token.',
      });
    }

    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    if (
      allowedOrigins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1'))
    ) {
      warnings.push({
        variable: 'ALLOWED_ORIGINS',
        message:
          'localhost origins detected in production. Ensure firewall is properly configured.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    values,
  };
}

/**
 * Assert environment is valid, throw if not
 */
export function assertValidEnvironment(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `  - ${e.variable}: ${e.message}`).join('\n');
    throw new Error(
      `Environment validation failed:\n${errorMessages}\n\nPlease check your .env.local file and ensure all required variables are set.`
    );
  }

  // Log warnings in development/staging
  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    const warningMessages = result.warnings
      .map((w) => `  - ${w.variable}: ${w.message}`)
      .join('\n');
    console.warn(`[ENV] Warnings:\n${warningMessages}`);
  }
}

/**
 * Get validated environment value with type safety
 */
export function getEnvValue<T = string>(name: string, defaultValue?: T): T {
  const result = validateEnvironment();
  const value = result.values[name];

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable "${name}" is not set and no default provided`);
  }

  return value as T;
}

/**
 * Log environment configuration summary
 */
export function logEnvironmentInfo(): void {
  const result = validateEnvironment();

  console.log('[ENV] Configuration Summary:');
  console.log(`[ENV] Valid: ${result.valid ? '✓' : '✗'}`);

  if (result.errors.length > 0) {
    console.error('[ENV] Errors:');
    result.errors.forEach((e) => console.error(`  - ${e.variable}: ${e.message}`));
  }

  if (result.warnings.length > 0) {
    console.warn('[ENV] Warnings:');
    result.warnings.forEach((w) => console.warn(`  - ${w.variable}: ${w.message}`));
  }

  // Log non-sensitive config values
  console.log('[ENV] Configuration:');
  console.log(`  - PORT: ${result.values.PORT || 3002}`);
  console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '***set***' : 'NOT SET'}`);
  console.log(
    `  - SENTINEL_API_TOKEN: ${process.env.SENTINEL_API_TOKEN ? '***set***' : 'NOT SET'}`
  );
  console.log(`  - REPORTS_DIR: ${result.values.REPORTS_DIR || 'C:\\Denuncias'}`);
}
