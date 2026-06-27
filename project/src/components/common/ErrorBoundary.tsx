import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useErrorStore } from '../../store';
import type { AppError } from '../../types';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  componentName?: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    // Log error to store
    const appError: AppError = {
      code: `boundary-${this.props.componentName || 'unknown'}`,
      message: error.message,
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack
      },
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    // Use store to log error
    useErrorStore.getState().addError(appError);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback component if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      // Default error UI
      return (
        <div className="error-boundary-container">
          <DefaultErrorFallback
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            onRetry={this.handleRetry}
            showDetails={this.props.showErrorDetails}
            componentName={this.props.componentName}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  showDetails?: boolean;
  componentName?: string;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
  showDetails = false,
  componentName
}) => {
  const [showFullError, setShowFullError] = React.useState(false);

  return (
    <div className="min-h-[200px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-red-800">
              Something went wrong
            </h3>
            <p className="text-sm text-red-600">
              {componentName ? `Error in ${componentName} component` : 'An unexpected error occurred'}
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="mb-4">
            <button
              onClick={() => setShowFullError(!showFullError)}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              {showFullError ? 'Hide' : 'Show'} error details
            </button>
            
            {showFullError && (
              <div className="mt-2 p-3 bg-red-100 border border-red-200 rounded text-xs font-mono">
                <div className="mb-2">
                  <strong>Error:</strong> {error.message}
                </div>
                {error.stack && (
                  <div className="mb-2">
                    <strong>Stack:</strong>
                    <pre className="whitespace-pre-wrap text-xs mt-1">{error.stack}</pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="whitespace-pre-wrap text-xs mt-1">{errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

// Higher-order component for wrapping components with error boundaries
function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Specialized error boundaries for different parts of the app
const DiagramErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    componentName="Diagram"
    showErrorDetails={process.env.NODE_ENV === 'development'}
    fallback={({ error, retry }) => (
      <div className="h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Diagram failed to load
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error.message}
          </p>
          <button
            onClick={retry}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

const CanvasErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    componentName="Canvas"
    showErrorDetails={process.env.NODE_ENV === 'development'}
    fallback={({ error, retry }) => (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-lg">
        <div className="text-center text-white">
          <div className="text-4xl mb-2">🎨</div>
          <h3 className="text-lg font-medium mb-2">Canvas Error</h3>
          <p className="text-sm text-gray-300 mb-4">
            Failed to render diagram canvas
          </p>
          <button
            onClick={retry}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
          >
            Reload Canvas
          </button>
        </div>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;