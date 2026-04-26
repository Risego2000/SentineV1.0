import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback UI. If omitted a minimal error card is rendered. */
  fallback?: ReactNode;
  /** Optional callback invoked on uncaught errors. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — contains React render / commit errors so the rest of the
 * application survives a localised crash (e.g. a bad video frame or a failed
 * canvas operation inside MainViewer).
 */
export class ErrorBoundary extends Component<Props, State> {
  props!: Readonly<Props>;
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SENTINEL] ErrorBoundary caught:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center h-full w-full bg-black/80 text-slate-200 gap-4 p-8"
        >
          <span className="text-red-400 font-bold text-lg uppercase tracking-widest">
            Error de Renderizado
          </span>
          <p className="text-slate-400 text-sm font-mono max-w-md text-center break-words">
            {this.state.errorMessage}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-2 px-6 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
