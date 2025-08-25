/**
 * React Error Boundary Components
 * 
 * Provides error boundaries for catching and handling JavaScript errors
 * in React component trees with fallback UI and error reporting
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

// Error boundary state interface
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

// Error boundary props interface
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void
  showErrorDetails?: boolean
  name?: string
}

/**
 * General Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorId: string

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.errorId = ''
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.setState({
      error,
      errorInfo,
      errorId
    })

    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId)
    }

    // Report error to global error service
    this.reportError(error, errorInfo, errorId)
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    try {
      // Send error to global error handler
      window.dispatchEvent(new CustomEvent('app-error', {
        detail: {
          type: 'component-error',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          errorInfo,
          errorId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          boundaryName: this.props.name || 'Unknown'
        }
      }))
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-64 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-800">Something went wrong</h3>
            </div>
            
            <p className="text-red-700 mb-4">
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </p>

            {this.state.errorId && (
              <p className="text-xs text-red-600 mb-4 font-mono">
                Error ID: {this.state.errorId}
              </p>
            )}

            {this.props.showErrorDetails && this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-red-700 cursor-pointer mb-2">Error Details</summary>
                <div className="bg-red-100 p-2 rounded text-xs text-red-800 font-mono overflow-auto max-h-32">
                  <div className="font-semibold">{this.state.error.name}: {this.state.error.message}</div>
                  {this.state.error.stack && (
                    <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex space-x-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Route Error Boundary
 * 
 * Specialized error boundary for route-level errors
 */
export const RouteErrorBoundary: React.FC<{ children: ReactNode; routeName?: string }> = ({ 
  children, 
  routeName 
}) => {
  return (
    <ErrorBoundary
      name={`Route-${routeName || 'Unknown'}`}
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Error</h2>
            <p className="text-gray-600 mb-6">
              This page encountered an error and couldn't load properly.
            </p>
            <div className="space-x-2">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-block"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Component Error Boundary
 * 
 * Lightweight error boundary for individual components
 */
export const ComponentErrorBoundary: React.FC<{ 
  children: ReactNode
  componentName?: string
  minimal?: boolean
}> = ({ children, componentName, minimal = false }) => {
  if (minimal) {
    return (
      <ErrorBoundary
        name={`Component-${componentName || 'Unknown'}`}
        fallback={
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700 text-sm">
              Component failed to load. <button 
                onClick={() => window.location.reload()} 
                className="underline hover:no-underline"
              >
                Refresh page
              </button>
            </p>
          </div>
        }
      >
        {children}
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary
      name={`Component-${componentName || 'Unknown'}`}
      fallback={
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center mb-3">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h4 className="text-red-800 font-medium">Component Error</h4>
          </div>
          <p className="text-red-700 text-sm mb-3">
            {componentName ? `The ${componentName} component` : 'This component'} encountered an error.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
