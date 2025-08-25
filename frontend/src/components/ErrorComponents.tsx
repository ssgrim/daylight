/**
 * Error UI Components
 * User-friendly error display components with actionable options
 */

import React from 'react'
import { UserFriendlyError, ErrorAction, ErrorSeverity, ErrorType } from '../utils/error-handler'

interface ErrorDisplayProps {
  error: UserFriendlyError
  onDismiss?: () => void
  className?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: UserFriendlyError
}

/**
 * Inline error display component
 */
export function ErrorDisplay({ error, onDismiss, className = '' }: ErrorDisplayProps) {
  const severityStyles = {
    LOW: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    MEDIUM: 'bg-orange-50 border-orange-200 text-orange-800',
    HIGH: 'bg-red-50 border-red-200 text-red-800',
    CRITICAL: 'bg-red-100 border-red-300 text-red-900'
  }

  const iconMap = {
    LOW: '⚠️',
    MEDIUM: '❗',
    HIGH: '🚫',
    CRITICAL: '💥'
  }

  return (
    <div className={`border rounded-lg p-4 ${severityStyles[error.severity]} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl" role="img" aria-label="Error icon">
            {iconMap[error.severity]}
          </span>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-semibold mb-1">
            {error.title}
          </h3>
          
          <p className="text-sm mb-2">
            {error.message}
          </p>
          
          {error.details && (
            <p className="text-xs opacity-75 mb-3">
              {error.details}
            </p>
          )}
          
          {error.actionable && error.actions && error.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {error.actions.map((action, index) => (
                <ActionButton key={index} action={action} />
              ))}
            </div>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            aria-label="Dismiss error"
          >
            <span className="text-xl">×</span>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Full-page error display component
 */
export function ErrorPage({ error, className = '' }: ErrorDisplayProps) {
  const severityStyles = {
    LOW: 'text-yellow-600',
    MEDIUM: 'text-orange-600',
    HIGH: 'text-red-600',
    CRITICAL: 'text-red-700'
  }

  const backgroundStyles = {
    LOW: 'bg-yellow-50',
    MEDIUM: 'bg-orange-50',
    HIGH: 'bg-red-50',
    CRITICAL: 'bg-red-100'
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${backgroundStyles[error.severity]} ${className}`}>
      <div className="max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-6xl mb-4">
            {error.severity === 'CRITICAL' ? '💥' : 
             error.severity === 'HIGH' ? '🚫' :
             error.severity === 'MEDIUM' ? '❗' : '⚠️'}
          </div>
          
          <h1 className={`text-3xl font-bold mb-4 ${severityStyles[error.severity]}`}>
            {error.title}
          </h1>
          
          <p className="text-gray-700 mb-4 text-lg">
            {error.message}
          </p>
          
          {error.details && (
            <p className="text-gray-600 mb-6 text-sm">
              {error.details}
            </p>
          )}
          
          {error.actionable && error.actions && error.actions.length > 0 && (
            <div className="space-y-3">
              {error.actions.map((action, index) => (
                <div key={index} className="w-full">
                  <ActionButton action={action} fullWidth />
                </div>
              ))}
            </div>
          )}
          
          {error.timestamp && (
            <p className="text-xs text-gray-500 mt-6">
              Error occurred at {error.timestamp.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Toast notification error component
 */
export function ErrorToast({ error, onDismiss, className = '' }: ErrorDisplayProps) {
  const [isVisible, setIsVisible] = React.useState(true)

  React.useEffect(() => {
    if (error.severity === 'LOW') {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error.severity, onDismiss])

  if (!isVisible) return null

  const severityStyles = {
    LOW: 'bg-yellow-500 text-white',
    MEDIUM: 'bg-orange-500 text-white',
    HIGH: 'bg-red-500 text-white',
    CRITICAL: 'bg-red-600 text-white'
  }

  return (
    <div className={`fixed top-4 right-4 max-w-sm w-full z-50 ${className}`}>
      <div className={`rounded-lg shadow-lg p-4 ${severityStyles[error.severity]}`}>
        <div className="flex items-start">
          <div className="flex-1">
            <h4 className="font-semibold mb-1">
              {error.title}
            </h4>
            <p className="text-sm opacity-90">
              {error.message}
            </p>
            
            {error.actionable && error.actions && error.actions.length > 0 && (
              <div className="mt-3 flex gap-2">
                {error.actions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className="text-xs px-3 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
                  >
                    {action.icon} {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {onDismiss && (
            <button
              onClick={() => {
                setIsVisible(false)
                onDismiss()
              }}
              className="ml-2 text-white opacity-70 hover:opacity-100 focus:outline-none"
              aria-label="Dismiss"
            >
              <span className="text-lg">×</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Action button component
 */
function ActionButton({ action, fullWidth = false }: { action: ErrorAction; fullWidth?: boolean }) {
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  }

  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
  const widthClass = fullWidth ? 'w-full' : ''
  const variantClass = variantStyles[action.variant || 'primary']

  return (
    <button
      onClick={action.action}
      className={`${baseClasses} ${variantClass} ${widthClass}`}
    >
      {action.icon && <span className="mr-2">{action.icon}</span>}
      {action.label}
    </button>
  )
}

/**
 * React Error Boundary with enhanced error handling
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: UserFriendlyError; retry: () => void }> },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType<{ error: UserFriendlyError; retry: () => void }> }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error: {
        type: ErrorType.CLIENT_ERROR,
        severity: ErrorSeverity.HIGH,
        title: 'Application Error',
        message: 'Something went wrong in the application.',
        details: 'The page encountered an unexpected error and needs to be reloaded.',
        actionable: true,
        actions: [
          {
            label: 'Reload Page',
            action: () => window.location.reload(),
            variant: 'primary',
            icon: '🔄'
          },
          {
            label: 'Go Home',
            action: () => { window.location.href = '/' },
            variant: 'secondary',
            icon: '🏠'
          }
        ],
        originalError: error,
        timestamp: new Date()
      }
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo)
    
    // Report to error tracking service
    // errorTrackingService.captureException(error, { extra: errorInfo })
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} retry={this.retry} />
      }

      return <ErrorPage error={this.state.error} />
    }

    return this.props.children
  }
}

/**
 * Hook for managing error state
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<UserFriendlyError | null>(null)

  const handleError = React.useCallback((err: Error | any, context?: Record<string, any>) => {
    // Import errorHandler dynamically to avoid circular dependencies
    import('../utils/error-handler').then(({ errorHandler }) => {
      const userError = errorHandler.handleError(err, context)
      setError(userError)
    })
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return {
    error,
    handleError,
    clearError,
    hasError: error !== null
  }
}
