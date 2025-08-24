import React, { Component, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { logError, generateCorrelationId } from '../lib/errorHandling';

interface SearchErrorBoundaryState {
  hasError: boolean;
  correlationId: string | null;
  errorMessage: string | null;
}

interface SearchErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: string, correlationId: string, retry: () => void) => ReactNode;
}

export class SearchErrorBoundary extends Component<
  SearchErrorBoundaryProps,
  SearchErrorBoundaryState
> {
  constructor(props: SearchErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      correlationId: null,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: Error): SearchErrorBoundaryState {
    const correlationId = generateCorrelationId();
    return {
      hasError: true,
      correlationId,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const correlationId = logError(error, {
      component: 'SearchErrorBoundary',
      action: 'component_error',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });

    this.setState({ correlationId });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      correlationId: null,
      errorMessage: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { correlationId, errorMessage } = this.state;
      
      // Use custom fallback if provided
      if (this.props.fallback && correlationId) {
        return this.props.fallback(errorMessage || 'Unknown error', correlationId, this.handleRetry);
      }

      // Default search error fallback
      return (
        <div 
          className="bg-red-50 border-2 border-red-200 rounded-lg p-6 my-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg 
                className="w-6 h-6 text-red-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Search Temporarily Unavailable
              </h3>
              <p className="text-red-800 mb-4">
                We're experiencing technical difficulties with the search feature. 
                Our team has been notified and is working to resolve this issue.
              </p>
              
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-colors"
                  >
                    <svg 
                      className="w-4 h-4 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                    Try Again
                  </button>
                  
                  <Link
                    to="/"
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 transition-colors"
                  >
                    <svg 
                      className="w-4 h-4 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                      />
                    </svg>
                    Go Home
                  </Link>
                </div>
                
                <div className="text-sm text-red-700">
                  <p className="mb-1">
                    <strong>What you can do:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Wait a few moments and try again</li>
                    <li>Check your internet connection</li>
                    <li>Refresh the page</li>
                    <li>Contact support if the problem persists</li>
                  </ul>
                </div>
                
                {correlationId && (
                  <div className="mt-4 p-3 bg-red-100 rounded border">
                    <p className="text-xs font-mono text-red-700">
                      <strong>Error ID:</strong> {correlationId}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Please include this ID when contacting support.
                    </p>
                  </div>
                )}
                
                {import.meta.env.MODE === 'development' && errorMessage && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-red-600 font-medium">
                      Developer Details
                    </summary>
                    <pre className="mt-2 p-2 bg-red-100 text-xs text-red-800 overflow-auto rounded border">
                      {errorMessage}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
