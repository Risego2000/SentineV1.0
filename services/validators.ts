/**
 * Validadores centralizados para SentinelV16
 * Previene inyección de datos malformados en toda la API
 */

export interface Geometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const validators = {
  /**
   * Validar coordenadas de geometría (0-1 normalizadas)
   */
  isValidGeometry: (geo: unknown): geo is Geometry => {
    if (!geo || typeof geo !== 'object') return false;

    const g = geo as any;
    return (
      typeof g.x1 === 'number' && g.x1 >= 0 && g.x1 <= 1 &&
      typeof g.y1 === 'number' && g.y1 >= 0 && g.y1 <= 1 &&
      typeof g.x2 === 'number' && g.x2 >= 0 && g.x2 <= 1 &&
      typeof g.y2 === 'number' && g.y2 >= 0 && g.y2 <= 1
    );
  },

  /**
   * Validar tamaño de JSON (previene DoS)
   * @param data - String JSON
   * @param maxSizeMB - Tamaño máximo en MB (default 10MB)
   */
  isValidJSONSize: (data: string, maxSizeMB: number = 10): boolean => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return Buffer.byteLength(data, 'utf8') <= maxBytes;
  },

  /**
   * Validar códec de video
   */
  isValidCodec: (codec: unknown): codec is ('h264' | 'hevc' | 'h265') => {
    return ['h264', 'hevc', 'h265'].includes(String(codec).toLowerCase());
  },

  /**
   * Validar códec de audio
   */
  isValidAudioCodec: (codec: unknown): codec is ('aac' | 'mp3' | 'libopus') => {
    return ['aac', 'mp3', 'libopus'].includes(String(codec).toLowerCase());
  },

  /**
   * Validar URL de cámara IP
   */
  isValidCameraUrl: (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;

    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * Validar dirección IP (no privada para SSRF prevention)
   */
  isPrivateIp: (ip: string): boolean => {
    const privateRanges = [
      /^127\.\d+\.\d+\.\d+$/, // 127.0.0.0/8
      /^10\.\d+\.\d+\.\d+$/, // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12
      /^192\.168\.\d+\.\d+$/, // 192.168.0.0/16
      /^localhost$/i,
      /^::1$/, // IPv6 loopback
      /^fc00:/i, // IPv6 private
    ];

    return privateRanges.some(pattern => pattern.test(ip));
  },

  /**
   * Validar estructura de Track para auditoría
   */
  isValidTrack: (track: unknown): boolean => {
    if (!track || typeof track !== 'object') return false;

    const t = track as any;
    return (
      typeof t.id === 'string' &&
      typeof t.heading === 'number' &&
      Array.isArray(t.box) && t.box.length === 4 &&
      Array.isArray(t.velocityHistory)
    );
  },

  /**
   * Validar ID de trabajo (UUID v4)
   */
  isValidUUID: (id: string): boolean => {
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidv4Regex.test(id);
  },

  /**
   * Validar longitud y caracteres de nombre de archivo
   */
  isValidFilename: (filename: string): boolean => {
    if (!filename || typeof filename !== 'string') return false;

    // Sin caracteres peligrosos
    const dangerousChars = /[<>:"|?*\x00-\x1f\\]/;
    if (dangerousChars.test(filename)) return false;

    // Sin path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return false;
    }

    // Longitud razonable
    return filename.length > 0 && filename.length <= 255;
  },

  /**
   * Validar número de puerto
   */
  isValidPort: (port: number): boolean => {
    return Number.isInteger(port) && port > 0 && port < 65536;
  },

  /**
   * Validar nivel de severidad
   */
  isValidSeverity: (severity: unknown): severity is ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(severity));
  },

  /**
   * Validar estado de trabajo
   */
  isValidJobStatus: (status: unknown): status is ('pending' | 'processing' | 'completed' | 'failed') => {
    return ['pending', 'processing', 'completed', 'failed'].includes(String(status));
  },

  /**
   * Validar token Bearer
   */
  isValidToken: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false;

    // Debe ser alfanumérico + guiones/underscore, 32+ caracteres
    return /^[a-zA-Z0-9_-]{32,}$/.test(token);
  },

  /**
   * Validar rango de confianza (0-1)
   */
  isValidConfidence: (confidence: number): boolean => {
    return typeof confidence === 'number' && confidence >= 0 && confidence <= 1;
  },

  /**
   * Validar objeto de directives de auditoría
   */
  isValidDirectives: (directives: unknown): boolean => {
    if (!directives || typeof directives !== 'object') return false;

    const d = directives as any;
    return (
      (d.protocolName === undefined || typeof d.protocolName === 'string') &&
      (d.zoneNames === undefined || Array.isArray(d.zoneNames)) &&
      (d.additionalContext === undefined || typeof d.additionalContext === 'string')
    );
  }
};

/**
 * Aplicar validaciones en cadena y retornar primer error
 */
export function validateRequest(
  data: unknown,
  validations: Array<{
    test: (d: unknown) => boolean;
    message: string;
  }>
): { valid: boolean; error?: string } {
  for (const { test, message } of validations) {
    if (!test(data)) {
      return { valid: false, error: message };
    }
  }

  return { valid: true };
}
