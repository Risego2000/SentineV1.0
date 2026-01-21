type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE';

interface LogEntry {
    level: LogLevel;
    module: string;
    message: string;
    timestamp: string;
    data?: any;
}

class Logger {
    private static instance: Logger;
    private logs: LogEntry[] = [];
    private readonly MAX_LOGS = 1000;

    private constructor() { }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatMessage(entry: LogEntry): string {
        return `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}`;
    }

    public log(level: LogLevel, module: string, message: string, data?: any) {
        const entry: LogEntry = {
            level,
            module,
            message,
            timestamp: new Date().toISOString(),
            data,
        };

        this.logs.unshift(entry);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }

        // Console output with colors
        const colors = {
            INFO: 'color: #3b82f6',
            WARN: 'color: #f59e0b',
            ERROR: 'color: #ef4444; font-weight: bold',
            AI: 'color: #8b5cf6',
            CORE: 'color: #10b981',
        };

        console.log(`%c${this.formatMessage(entry)}`, colors[level], data || '');
    }

    public info(module: string, message: string, data?: any) {
        this.log('INFO', module, message, data);
    }

    public warn(module: string, message: string, data?: any) {
        this.log('WARN', module, message, data);
    }

    public error(module: string, message: string, data?: any) {
        this.log('ERROR', module, message, data);
    }

    public ai(module: string, message: string, data?: any) {
        this.log('AI', module, message, data);
    }

    public core(module: string, message: string, data?: any) {
        this.log('CORE', module, message, data);
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }
}

export const logger = Logger.getInstance();
