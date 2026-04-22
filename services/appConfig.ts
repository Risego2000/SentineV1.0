/**
 * Centralized Application Configuration
 * Single source of truth for all configurable settings
 * Enables easy modifications without scattered constants across codebase
 */

/**
 * Queue Configuration
 */
export const QueueConfig = {
  MAX_QUEUE_SIZE: 50,
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY_MS: 500, // Base delay for exponential backoff
  MAX_RETRY_DELAY_MS: 30000, // 30 seconds max
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  JOB_EXPIRY_HOURS: 24,
} as const;

/**
 * Validation Configuration
 */
export const ValidationConfig = {
  MAX_IMAGE_SIZE_MB: 5,
  MAX_JSON_SIZE_MB: 1,
  MAX_VIDEO_SIZE_MB: 250,
  MAX_REQUEST_SIZE_MB: 10,
  MAX_FILENAME_LENGTH: 255,
  MAX_RETRIES_STORAGE: 5,
} as const;

/**
 * API Configuration
 */
export const APIConfig = {
  TRANSCODE_MAX_BYTES: 250 * 1024 * 1024,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX_REQUESTS: 120,
  REQUEST_TIMEOUT_MS: 30_000,
  AI_SERVICE_TIMEOUT_MS: 60_000,
} as const;

/**
 * Video Configuration
 */
export const VideoConfig = {
  SUPPORTED_CODECS: ['h264', 'h265', 'hevc'] as const,
  SUPPORTED_AUDIO_CODECS: ['aac', 'mp3', 'libopus'] as const,
  DEFAULT_OUTPUT_CODEC: 'h264' as const,
  H264_PRESET: 'fast' as const,
  H265_PRESET: 'fast' as const,
  VIDEO_PROFILE: 'baseline' as const,
} as const;

/**
 * Camera Configuration
 */
export const CameraConfig = {
  IP_CAMERA_SESSION_TTL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_CONCURRENT_STREAMS: 4,
} as const;

/**
 * Evidence Configuration
 */
export const EvidenceConfig = {
  INDEXEDDB_NAME: 'sentinel_evidence_v2',
  QUEUE_STORAGE_NAME: 'sentinel_forensic_queue',
  MAX_EVIDENCE_AGE_HOURS: 24,
  AUTO_CLEANUP_ENABLED: true,
} as const;

/**
 * AI Service Configuration
 */
export const AIServiceConfig = {
  GEMINI_MODEL: 'gemini-2.5-flash',
  RESPONSE_MIME_TYPE: 'application/json',
  MAX_GEOMETRY_LINES: 15,
  SEVERITY_LEVELS: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
  AUDIT_PRESETS: ['standard', 'strict', 'permissive'] as const,
} as const;

/**
 * Logging Configuration
 */
export const LoggingConfig = {
  MAX_LOGS_IN_MEMORY: 1000,
  LOG_RETENTION_HOURS: 24,
  AUDIT_LOG_ENABLED: true,
  ERROR_CONTEXT_LOGGING_ENABLED: true,
} as const;

/**
 * Feature Flags
 */
export const FeatureFlags = {
  ENABLE_GPU_ACCELERATION: true,
  ENABLE_QUEUE_PERSISTENCE: true,
  ENABLE_FALLBACK_AUDITING: true,
  ENABLE_AUTO_CLEANUP: true,
  ENABLE_AUDIT_LOGGING: true,
  ENABLE_H265_WARNING: true,
  ENABLE_DETAILED_ERROR_CONTEXT: true,
} as const;

/**
 * Error Messages (Centralized for consistency)
 */
export const ErrorMessages = {
  INVALID_TOKEN: 'Token inválido o faltante.',
  ORIGIN_NOT_PERMITTED: 'Origin no permitido por CORS.',
  INVALID_CODEC: 'Codec de salida inválido.',
  INVALID_JOB_ID: 'Job ID inválido.',
  IMAGE_TOO_LARGE: 'La imagen excede 5MB.',
  CONFIG_TOO_LARGE: 'Configuración excede 1MB.',
  VIDEO_TOO_LARGE: 'Vídeo excede límite de tamaño.',
  INVALID_TRACK: 'Track inválido o faltante.',
  INVALID_GEOMETRY: 'Geometría de línea inválida (coordenadas 0-1).',
  INVALID_DIRECTIVES: 'Directivas deben ser texto.',
  INVALID_PRESET: 'Preset de auditoría no válido.',
  EVIDENCE_NOT_FOUND: 'Evidencia no disponible.',
  QUEUE_FULL: 'Cola forense llena.',
  TRANSCODE_FAILED: 'Transcodificación fallida.',
  FFMPEG_NOT_FOUND: 'FFmpeg no encontrado o error de ejecución.',
  STREAM_COPY_FAILED: 'Stream copy fallido.',
  PATH_NOT_PERMITTED: 'Ruta de archivo no permitida.',
  RATE_LIMIT_EXCEEDED: 'Rate limit excedido.',
  TOO_MANY_TRANSCODES: 'Demasiadas transcodificaciones simultáneas.',
} as const;

/**
 * Success Messages
 */
export const SuccessMessages = {
  CONFIG_SAVED: 'Configuración guardada exitosamente.',
  JOB_ENQUEUED: 'Trabajo encolado para procesamiento.',
  UPLOAD_SUCCESSFUL: 'Upload completado exitosamente.',
} as const;

/**
 * Type definitions for config values (for stricter typing)
 */
export type SeverityLevel = (typeof AIServiceConfig.SEVERITY_LEVELS)[number];
export type AuditPreset = (typeof AIServiceConfig.AUDIT_PRESETS)[number];
export type VideoCodec = (typeof VideoConfig.SUPPORTED_CODECS)[number];
export type AudioCodec = (typeof VideoConfig.SUPPORTED_AUDIO_CODECS)[number];

/**
 * Get all configuration as a single object
 */
export const AppConfig = {
  Queue: QueueConfig,
  Validation: ValidationConfig,
  API: APIConfig,
  Video: VideoConfig,
  Camera: CameraConfig,
  Evidence: EvidenceConfig,
  AIService: AIServiceConfig,
  Logging: LoggingConfig,
  Features: FeatureFlags,
  Errors: ErrorMessages,
  Success: SuccessMessages,
} as const;

export default AppConfig;
