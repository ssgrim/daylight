/**
 * Global Error Provider
 * Provides application-wide error handling and display
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import { UserFriendlyError, errorHandler } from '../utils/error-handler'
import { ErrorToast, ErrorDisplay } from './ErrorComponents'

interface ErrorContextType {
  errors: UserFriendlyError[]
  showError: (error: Error | UserFriendlyError, context?: Record<string, any>) => void
  dismissError: (errorId: string) => void
  clearAllErrors: () => void
  hasErrors: boolean
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

interface ErrorProviderProps {
  children: React.ReactNode
  maxErrors?: number
  autoDecayTime?: number
}

export function ErrorProvider({ 
  children, 
  maxErrors = 5, 
  autoDecayTime = 10000 
}: ErrorProviderProps) {
  const [errors, setErrors] = useState<UserFriendlyError[]>([])

  // Generate unique ID for errors
  const generateErrorId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Add error to the list
  const showError = useCallback((
    error: Error | UserFriendlyError, 
    context?: Record<string, any>
  ) => {
    let userError: UserFriendlyError

    if ('type' in error && 'severity' in error) {
      // Already a UserFriendlyError
      userError = error as UserFriendlyError
    } else {
      // Transform regular error
      userError = errorHandler.handleError(error as Error, context)
    }

    // Add unique ID for tracking
    const errorWithId = {
      ...userError,
      id: generateErrorId()
    } as UserFriendlyError & { id: string }

    setErrors(prevErrors => {
      const newErrors = [errorWithId, ...prevErrors]
      // Limit the number of errors shown
      return newErrors.slice(0, maxErrors)
    })

    // Auto-dismiss for low severity errors
    if (userError.severity === 'LOW') {
      setTimeout(() => {
        dismissError(errorWithId.id)
      }, autoDecayTime)
    }
  }, [generateErrorId, maxErrors, autoDecayTime])

  // Remove specific error
  const dismissError = useCallback((errorId: string) => {
    setErrors(prevErrors => prevErrors.filter(error => 
      (error as any).id !== errorId
    ))
  }, [])

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors([])
  }, [])

  // Subscribe to global error handler
  React.useEffect(() => {
    const unsubscribe = errorHandler.onError((error) => {
      showError(error)
    })

    return unsubscribe
  }, [showError])

  // Handle unhandled promise rejections
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      showError(event.reason || new Error('Unhandled promise rejection'))
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [showError])

  // Handle global JavaScript errors
  React.useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      showError(event.error || new Error(event.message))
    }

    window.addEventListener('error', handleGlobalError)
    return () => {
      window.removeEventListener('error', handleGlobalError)
    }
  }, [showError])

  const contextValue: ErrorContextType = {
    errors,
    showError,
    dismissError,
    clearAllErrors,
    hasErrors: errors.length > 0
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      <ErrorDisplayContainer 
        errors={errors} 
        onDismiss={dismissError}
      />
    </ErrorContext.Provider>
  )
}

/**
 * Hook to use error context
 */
export function useError(): ErrorContextType {
  const context = useContext(ErrorContext)
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

/**
 * Error display container component
 */
function ErrorDisplayContainer({ 
  errors, 
  onDismiss 
}: { 
  errors: UserFriendlyError[]
  onDismiss: (id: string) => void 
}) {
  if (errors.length === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="container mx-auto px-4 pt-4">
        <div className="space-y-3 pointer-events-auto">
          {errors.map((error, index) => {
            const errorWithId = error as UserFriendlyError & { id: string }
            
            // Show critical and high severity errors as full displays
            if (error.severity === 'CRITICAL' || error.severity === 'HIGH') {
              return (
                <ErrorDisplay
                  key={errorWithId.id || index}
                  error={error}
                  onDismiss={() => onDismiss(errorWithId.id)}
                  className="shadow-lg"
                />
              )
            }
            
            // Show medium and low severity errors as toasts
            return (
              <ErrorToast
                key={errorWithId.id || index}
                error={error}
                onDismiss={() => onDismiss(errorWithId.id)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: UserFriendlyError; retry: () => void }>
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

/**
 * Error boundary component (imported from ErrorComponents)
 */
function ErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: UserFriendlyError; retry: () => void }>
}) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<UserFriendlyError | null>(null)

  React.useEffect(() => {
    const handleError = (error: Error) => {
      const userError = errorHandler.handleError(error, {
        source: 'error-boundary',
        timestamp: new Date().toISOString()
      })
      setError(userError)
      setHasError(true)
    }

    const handleErrorEvent = (event: ErrorEvent) => {
      handleError(event.error || new Error(event.message))
    }

    window.addEventListener('error', handleErrorEvent)
    return () => window.removeEventListener('error', handleErrorEvent)
  }, [])

  const retry = useCallback(() => {
    setHasError(false)
    setError(null)
  }, [])

  if (hasError && error) {
    if (fallback) {
      const FallbackComponent = fallback
      return <FallbackComponent error={error} retry={retry} />
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <ErrorDisplay error={error} />
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Hook for form error handling
 */
export function useFormError() {
  const { showError } = useError()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }))
  }, [])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({})
  }, [])

  const handleValidationError = useCallback((error: any) => {
    if (error?.details && Array.isArray(error.details)) {
      const newFieldErrors: Record<string, string> = {}
      error.details.forEach((detail: any) => {
        if (detail.field && detail.message) {
          newFieldErrors[detail.field] = detail.message
        }
      })
      setFieldErrors(newFieldErrors)
    } else {
      showError(error)
    }
  }, [showError])

  return {
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    handleValidationError,
    hasFieldErrors: Object.keys(fieldErrors).length > 0
  }
}
