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
    data?: any;
}

class TacticalLogger {
    private static instance: TacticalLogger;
    private maxLogs = 1000;
    private logs: LogEntry[] = [];

    private constructor() { }

    public static getInstance(): TacticalLogger {
        if (!TacticalLogger.instance) {
            TacticalLogger.instance = new TacticalLogger();
        }
        return TacticalLogger.instance;
    }

    private log(level: LogLevel, category: string, message: string, data?: any) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data
        };

        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

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
            case 'INFO': return '#3b82f6'; // Blue
            case 'WARN': return '#f59e0b'; // Amber
            case 'ERROR': return '#ef4444'; // Red
            case 'DEBUG': return '#8b5cf6'; // Violet
            case 'SUCCESS': return '#10b981'; // Emerald
            case 'CORE': return '#d946ef'; // Fuchsia
            case 'AI': return '#06b6d4'; // Cyan
            default: return '#9ca3af'; // Gray
        }
    }

    public info(category: string, message: string, data?: any) {
        this.log('INFO', category, message, data);
    }

    public warn(category: string, message: string, data?: any) {
        this.log('WARN', category, message, data);
    }

    public error(category: string, message: string, data?: any) {
        this.log('ERROR', category, message, data);
    }

    public debug(category: string, message: string, data?: any) {
        this.log('DEBUG', category, message, data);
    }

    public success(category: string, message: string, data?: any) {
        this.log('SUCCESS', category, message, data);
    }

    public core(category: string, message: string, data?: any) {
        this.log('CORE', category, message, data);
    }

    public ai(category: string, message: string, data?: any) {
        this.log('AI', category, message, data);
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }
}

export const logger = TacticalLogger.getInstance();
