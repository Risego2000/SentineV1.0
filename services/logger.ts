/**
 * Sistema de Logging táctico para Sentinel AI.
 * Proporciona trazabilidad centralizada con niveles de severidad y visualización formateada.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS' | 'CORE' | 'AI';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class TacticalLogger {
  private static instance: TacticalLogger;
  private maxLogs = 1000;
  private logs: LogEntry[] = [];
  private onLogListeners: ((entry: LogEntry) => void)[] = [];

  private constructor() {}

  public static getInstance(): TacticalLogger {
    if (!TacticalLogger.instance) {
      TacticalLogger.instance = new TacticalLogger();
    }
    return TacticalLogger.instance;
  }

  public subscribe(listener: (entry: LogEntry) => void) {
    this.onLogListeners.push(listener);
    return () => {
      this.onLogListeners = this.onLogListeners.filter((l) => l !== listener);
    };
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notificar suscriptores (React UI)
    this.onLogListeners.forEach((listener) => listener(entry));

    const color = this.getLevelColor(level);
    const timestampStr = new Date().toLocaleTimeString();

    console.log(
      `%c[${timestampStr}] [${level}] [${category}] %c${message}`,
      `color: ${color}; font-weight: bold;`,
      'color: inherit;',
      data || ''
    );
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case 'INFO':
        return '#3b82f6'; // Blue
      case 'WARN':
        return '#f59e0b'; // Amber
      case 'ERROR':
        return '#ef4444'; // Red
      case 'DEBUG':
        return '#8b5cf6'; // Violet
      case 'SUCCESS':
        return '#10b981'; // Emerald
      case 'CORE':
        return '#d946ef'; // Fuchsia
      case 'AI':
        return '#06b6d4'; // Cyan
      default:
        return '#9ca3af'; // Gray
    }
  }

  public info(category: string, message: string, data?: unknown) {
    this.log('INFO', category, message, data);
  }

  public warn(category: string, message: string, data?: unknown) {
    this.log('WARN', category, message, data);
  }

  public error(category: string, message: string, data?: unknown) {
    this.log('ERROR', category, message, data);
  }

  public debug(category: string, message: string, data?: unknown) {
    this.log('DEBUG', category, message, data);
  }

  public success(category: string, message: string, data?: unknown) {
    this.log('SUCCESS', category, message, data);
  }

  public core(category: string, message: string, data?: unknown) {
    this.log('CORE', category, message, data);
  }

  public ai(category: string, message: string, data?: unknown) {
    this.log('AI', category, message, data);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Logging para servidor (JSON estructurado)
   */
  public errorWithContext(context: string, error: unknown, metadata?: Record<string, any>) {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry = {
      level: 'ERROR',
      context,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // En servidor: logging a stdout para centralized logging
    if (typeof window === 'undefined') {
      console.error(JSON.stringify(entry));
    } else {
      this.error(context, err.message, metadata);
    }

    return entry;
  }

  /**
   * Logging de acceso API (auditoría)
   */
  public auditLog(method: string, path: string, status: number, metadata?: Record<string, any>) {
    const entry = {
      level: 'INFO',
      context: 'API_AUDIT',
      method,
      path,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    if (typeof window === 'undefined') {
      console.log(JSON.stringify(entry));
    } else {
      this.info('API_AUDIT', `${method} ${path} [${status}]`, metadata);
    }

    return entry;
  }

  /**
   * Logging de validación fallida
   */
  public validationError(context: string, field: string, reason: string, value?: unknown) {
    this.warn(context, `Validación fallida: ${field} - ${reason}`, {
      field,
      reason,
      value: typeof value === 'object' ? '[object]' : value,
    });
  }

  /**
   * Limpiar logs antiguos
   */
  public clearOldLogs(maxAgeHours: number = 24) {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const initialCount = this.logs.length;

    this.logs = this.logs.filter((log) => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime > cutoffTime;
    });

    const removedCount = initialCount - this.logs.length;
    if (removedCount > 0) {
      this.debug('LOGGER', `Limpiados ${removedCount} logs antiguos`);
    }
  }
}

export const logger = TacticalLogger.getInstance();
