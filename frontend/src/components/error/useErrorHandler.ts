/**
 * Error Handling Hooks
 * 
 * React hooks for handling errors in functional components
 */

import { useState, useEffect, useCallback } from 'react'
import { globalErrorHandler, ErrorType, ErrorSeverity } from './GlobalErrorHandler'

// Error state interface
interface ErrorState {
  error: Error | null
  errorId: string | null
  hasError: boolean
  isRetrying: boolean
}

// Async error state interface
interface AsyncErrorState extends ErrorState {
  loading: boolean
}

/**
 * Hook for handling component-level errors
 */
export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    errorId: null,
    hasError: false,
    isRetrying: false
  })

  const handleError = useCallback((error: Error, context?: Record<string, any>) => {
    const errorId = globalErrorHandler.handleError({
      type: ErrorType.COMPONENT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      error,
      context
    })

    setErrorState({
      error,
      errorId,
      hasError: true,
      isRetrying: false
    })

    return errorId
  }, [])

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      errorId: null,
      hasError: false,
      isRetrying: false
    })
  }, [])

  const retry = useCallback(async (retryFn?: () => Promise<void> | void) => {
    setErrorState(prev => ({ ...prev, isRetrying: true }))
    
    try {
      if (retryFn) {
        await retryFn()
      }
      clearError()
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Retry failed'))
    }
  }, [handleError, clearError])

  return {
    ...errorState,
    handleError,
    clearError,
    retry
  }
}

/**
 * Hook for handling async operations with error handling
 */
export function useAsyncError<T>() {
  const [state, setState] = useState<AsyncErrorState & { data: T | null }>({
    data: null,
    error: null,
    errorId: null,
    hasError: false,
    loading: false,
    isRetrying: false
  })

  const execute = useCallback(async (asyncFn: () => Promise<T>, context?: Record<string, any>) => {
    setState(prev => ({ ...prev, loading: true, hasError: false, error: null }))

    try {
      const result = await asyncFn()
      setState(prev => ({ 
        ...prev, 
        data: result, 
        loading: false, 
        hasError: false, 
        error: null,
        errorId: null 
      }))
      return result
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error('Async operation failed')
      const errorId = globalErrorHandler.handleError({
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: errorInstance.message,
        error: errorInstance,
        context
      })

      setState(prev => ({
        ...prev,
        error: errorInstance,
        errorId,
        hasError: true,
        loading: false,
        isRetrying: false
      }))

      throw error
    }
  }, [])

  const retry = useCallback(async (asyncFn: () => Promise<T>, context?: Record<string, any>) => {
    setState(prev => ({ ...prev, isRetrying: true }))
    try {
      return await execute(asyncFn, context)
    } finally {
      setState(prev => ({ ...prev, isRetrying: false }))
    }
  }, [execute])

  const clearError = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: null, 
      errorId: null, 
      hasError: false, 
      isRetrying: false 
    }))
  }, [])

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      errorId: null,
      hasError: false,
      loading: false,
      isRetrying: false
    })
  }, [])

  return {
    ...state,
    execute,
    retry,
    clearError,
    reset
  }
}

/**
 * Hook for safe fetch operations with error handling
 */
export function useSafeFetch() {
  const asyncError = useAsyncError<Response>()

  const safeFetch = useCallback(async (url: string, options?: RequestInit) => {
    return asyncError.execute(async () => {
      const response = await fetch(url, options)
      
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        ;(error as any).status = response.status
        ;(error as any).statusText = response.statusText
        ;(error as any).url = url
        throw error
      }
      
      return response
    }, { url, method: options?.method || 'GET' })
  }, [asyncError])

  return {
    ...asyncError,
    safeFetch,
    retryFetch: (url: string, options?: RequestInit) => 
      asyncError.retry(() => safeFetch(url, options))
  }
}

/**
 * Hook for handling form errors
 */
export function useFormError() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const setFieldError = useCallback((field: string, error: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: error }))
  }, [])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }, [])

  const setFormError = useCallback((error: string | Error) => {
    const message = error instanceof Error ? error.message : error
    setGeneralError(message)
    globalErrorHandler.handleError({
      type: ErrorType.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      message,
      error: error instanceof Error ? error : new Error(message)
    })
  }, [])

  const clearFormError = useCallback(() => {
    setGeneralError(null)
  }, [])

  const clearAllErrors = useCallback(() => {
    setFieldErrors({})
    setGeneralError(null)
  }, [])

  const hasErrors = Object.keys(fieldErrors).length > 0 || generalError !== null

  return {
    fieldErrors,
    generalError,
    hasErrors,
    setFieldError,
    clearFieldError,
    setFormError,
    clearFormError,
    clearAllErrors
  }
}

/**
 * Hook for monitoring network status and handling offline errors
 */
export function useNetworkError() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [networkError, setNetworkError] = useState<string | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setNetworkError(null)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setNetworkError('No internet connection')
      globalErrorHandler.handleError({
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: 'Network connection lost'
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    networkError,
    clearNetworkError: () => setNetworkError(null)
  }
}
