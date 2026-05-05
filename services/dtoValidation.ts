/**
 * Data Transfer Object (DTO) Validation
 * Provides strict validation and type-safe DTOs for API requests/responses
 * Ensures data integrity across service boundaries
 */

import { AppConfig } from './appConfig';
import {
  isValidString,
  isValidArray,
  isNumberInRange,
  isEnumValue,
  ValidationResult,
} from './serviceTypes';

/**
 * AI Geometry Request DTO
 */
export interface AIGeometryRequestDTO {
  directives: string;
  instruction?: string;
  image?: string;
}

export class AIGeometryRequestValidator {
  static validate(data: unknown): ValidationResult<AIGeometryRequestDTO> {
    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        error: 'Request body must be an object',
        path: '$',
      };
    }

    const obj = data as Record<string, unknown>;

    // Validate directives (required)
    if (!isValidString(obj.directives, 1, 1000)) {
      return {
        valid: false,
        error: 'directives must be a non-empty string (max 1000 chars)',
        path: '$.directives',
      };
    }

    // Validate instruction (optional)
    if (obj.instruction !== undefined && !isValidString(obj.instruction as unknown, 0, 1000)) {
      return {
        valid: false,
        error: 'instruction must be a string (max 1000 chars)',
        path: '$.instruction',
      };
    }

    // Validate image (optional, base64 string)
    if (obj.image !== undefined) {
      if (
        !isValidString(
          obj.image as unknown,
          100,
          AppConfig.Validation.MAX_IMAGE_SIZE_MB * 1024 * 1024
        )
      ) {
        return {
          valid: false,
          error: `image must be base64 string (max ${AppConfig.Validation.MAX_IMAGE_SIZE_MB}MB)`,
          path: '$.image',
        };
      }
      // Basic base64 validation
      if (!/^[A-Za-z0-9+/=]+$/.test((obj.image as string).slice(0, 100))) {
        return {
          valid: false,
          error: 'image must be valid base64 string',
          path: '$.image',
        };
      }
    }

    return {
      valid: true,
      value: {
        directives: obj.directives as string,
        instruction: obj.instruction as string | undefined,
        image: obj.image as string | undefined,
      },
    };
  }
}

/**
 * AI Audit Request DTO
 */
export interface AIAuditRequestDTO {
  track: {
    id: number;
    label: string;
    bbox: { x: number; y: number; w: number; h: number };
    avgVelocity: number;
    velocityHistory?: number[];
    heading: number;
    dwellTime: number;
    isAnomalous: boolean;
    anomalyLabel?: string;
    roiHistory: string[];
    tail: { x: number; y: number }[];
    snapshots?: string[];
    contextSnapshots?: string[];
    zoomSnapshots?: string[];
  };
  line: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    id?: string;
    label?: string;
    type?: string;
  };
  directives: string;
  auditPreset?: (typeof AppConfig.AIService.AUDIT_PRESETS)[number];
}

export class AIAuditRequestValidator {
  static validate(data: unknown): ValidationResult<AIAuditRequestDTO> {
    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        error: 'Request body must be an object',
        path: '$',
      };
    }

    const obj = data as Record<string, unknown>;

    // Validate track
    if (!obj.track || typeof obj.track !== 'object') {
      return {
        valid: false,
        error: 'track is required and must be an object',
        path: '$.track',
      };
    }

    const track = obj.track as Record<string, unknown>;
    if (typeof track.id !== 'number') {
      return { valid: false, error: 'track.id must be a number', path: '$.track.id' };
    }
    if (!isValidString(track.label as unknown)) {
      return { valid: false, error: 'track.label must be a string', path: '$.track.label' };
    }
    if (typeof track.avgVelocity !== 'number') {
      return {
        valid: false,
        error: 'track.avgVelocity must be a number',
        path: '$.track.avgVelocity',
      };
    }

    // Validate line
    if (!obj.line || typeof obj.line !== 'object') {
      return {
        valid: false,
        error: 'line is required and must be an object',
        path: '$.line',
      };
    }

    const line = obj.line as Record<string, unknown>;
    if (
      !isNumberInRange(line.x1) ||
      !isNumberInRange(line.y1) ||
      !isNumberInRange(line.x2) ||
      !isNumberInRange(line.y2)
    ) {
      return {
        valid: false,
        error: 'line coordinates must be numbers between 0-1',
        path: '$.line',
      };
    }

    // Validate directives
    if (!isValidString(obj.directives as unknown, 1, 1000)) {
      return {
        valid: false,
        error: 'directives must be a non-empty string',
        path: '$.directives',
      };
    }

    // Validate auditPreset (optional)
    if (
      obj.auditPreset !== undefined &&
      !isEnumValue(obj.auditPreset, AppConfig.AIService.AUDIT_PRESETS)
    ) {
      return {
        valid: false,
        error: `auditPreset must be one of: ${AppConfig.AIService.AUDIT_PRESETS.join(', ')}`,
        path: '$.auditPreset',
      };
    }

    return {
      valid: true,
      value: {
        track: track as AIAuditRequestDTO['track'],
        line: line as AIAuditRequestDTO['line'],
        directives: obj.directives as string,
        auditPreset: obj.auditPreset as
          | (typeof AppConfig.AIService.AUDIT_PRESETS)[number]
          | undefined,
      },
    };
  }
}

/**
 * Config Save Request DTO
 */
export interface ConfigSaveRequestDTO {
  fileName: string;
  config: Record<string, unknown>;
}

export class ConfigSaveRequestValidator {
  static validate(data: unknown): ValidationResult<ConfigSaveRequestDTO> {
    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        error: 'Request body must be an object',
        path: '$',
      };
    }

    const obj = data as Record<string, unknown>;

    // Validate fileName
    if (!isValidString(obj.fileName as unknown, 1, AppConfig.Validation.MAX_FILENAME_LENGTH)) {
      return {
        valid: false,
        error: `fileName must be a non-empty string (max ${AppConfig.Validation.MAX_FILENAME_LENGTH} chars)`,
        path: '$.fileName',
      };
    }

    // Validate no dangerous characters in filename
    const fileName = obj.fileName as string;
    for (let i = 0; i < fileName.length; i += 1) {
      const ch = fileName[i];
      const code = fileName.charCodeAt(i);
      if (
        code < 32 ||
        ch === '<' ||
        ch === '>' ||
        ch === ':' ||
        ch === '"' ||
        ch === '|' ||
        ch === '?' ||
        ch === '*' ||
        ch === '\\' ||
        ch === '/'
      ) {
        return {
          valid: false,
          error: 'fileName contains invalid characters',
          path: '$.fileName',
        };
      }
    }

    // Validate config
    if (typeof obj.config !== 'object' || obj.config === null || Array.isArray(obj.config)) {
      return {
        valid: false,
        error: 'config must be a non-null object',
        path: '$.config',
      };
    }

    // Check config size
    const configStr = JSON.stringify(obj.config);
    if (configStr.length > AppConfig.Validation.MAX_JSON_SIZE_MB * 1024 * 1024) {
      return {
        valid: false,
        error: `config exceeds ${AppConfig.Validation.MAX_JSON_SIZE_MB}MB limit`,
        path: '$.config',
      };
    }

    return {
      valid: true,
      value: {
        fileName: obj.fileName as string,
        config: obj.config as Record<string, unknown>,
      },
    };
  }
}

/**
 * Transcode Request DTO
 */
export interface TranscodeRequestDTO {
  jobId: string;
  outputCodec: (typeof AppConfig.Video.SUPPORTED_CODECS)[number];
}

export class TranscodeRequestValidator {
  static validate(query: Record<string, unknown>): ValidationResult<TranscodeRequestDTO> {
    const jobId = query.id as unknown;
    const outputCodec = (query.outputCodec as unknown) || 'h264';

    // Validate jobId
    if (!isValidString(jobId, 1, 100)) {
      return {
        valid: false,
        error: 'Job ID must be a string (1-100 chars)',
        path: '$.id',
      };
    }

    // Validate codec
    if (!isEnumValue(outputCodec, AppConfig.Video.SUPPORTED_CODECS)) {
      return {
        valid: false,
        error: `outputCodec must be one of: ${AppConfig.Video.SUPPORTED_CODECS.join(', ')}`,
        path: '$.outputCodec',
      };
    }

    return {
      valid: true,
      value: {
        jobId: jobId as string,
        outputCodec: outputCodec as (typeof AppConfig.Video.SUPPORTED_CODECS)[number],
      },
    };
  }
}

/**
 * IP Camera Session Request DTO
 */
export interface IPCameraSessionRequestDTO {
  url: string;
  username?: string;
  password?: string;
}

export class IPCameraSessionRequestValidator {
  static validate(data: unknown): ValidationResult<IPCameraSessionRequestDTO> {
    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        error: 'Request body must be an object',
        path: '$',
      };
    }

    const obj = data as Record<string, unknown>;

    // Validate URL
    if (!isValidString(obj.url as unknown, 10, 2048)) {
      return {
        valid: false,
        error: 'url must be a valid string',
        path: '$.url',
      };
    }

    try {
      const url = new URL(obj.url as string);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          valid: false,
          error: 'url must use http:// or https:// protocol',
          path: '$.url',
        };
      }
    } catch {
      return {
        valid: false,
        error: 'url must be a valid URL',
        path: '$.url',
      };
    }

    // Validate optional credentials
    if (obj.username !== undefined && !isValidString(obj.username as unknown, 0, 256)) {
      return {
        valid: false,
        error: 'username must be a string (max 256 chars)',
        path: '$.username',
      };
    }

    if (obj.password !== undefined && !isValidString(obj.password as unknown, 0, 256)) {
      return {
        valid: false,
        error: 'password must be a string (max 256 chars)',
        path: '$.password',
      };
    }

    return {
      valid: true,
      value: {
        url: obj.url as string,
        username: obj.username as string | undefined,
        password: obj.password as string | undefined,
      },
    };
  }
}
