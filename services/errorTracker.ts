import { logger } from './logger';

export interface ErrorReport {
    timestamp: string;
    source: string;
    message: string;
    stack?: string;
    context?: any;
}

class ErrorTracker {
    private static instance: ErrorTracker;

    private constructor() {
        this.setupGlobalHandlers();
    }

    public static getInstance(): ErrorTracker {
        if (!ErrorTracker.instance) {
            ErrorTracker.instance = new ErrorTracker();
        }
        return ErrorTracker.instance;
    }

    private setupGlobalHandlers() {
        window.onerror = (message, source, lineno, colno, error) => {
            this.track('WINDOW', error || new Error(String(message)), { source, lineno, colno });
        };

        window.onunhandledrejection = (event) => {
            this.track('PROMISE', event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
        };
    }

    public track(source: string, error: Error, context?: any) {
        const report: ErrorReport = {
            timestamp: new Date().toISOString(),
            source,
            message: error.message,
            stack: error.stack,
            context,
        };

        logger.error(`CRITICAL_ERROR_${source}`, error.message, report);

        // Aquí se podría integrar con Sentry, LogRocket, o un endpoint propio.
        if (process.env.NODE_ENV === 'production') {
            // simulate production reporting
            console.warn('Producción: Error enviado a la unidad de monitoreo central.');
        }
    }
}

export const errorTracker = ErrorTracker.getInstance();
