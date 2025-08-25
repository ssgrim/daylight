/**
 * Error Handling Hooks
 * 
 * Custom React hooks for various error handling scenarios
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ErrorSeverity, ErrorType } from './GlobalErrorHandler'

// Generate unique error ID
const generateErrorId = (): string => {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Base error handler hook
export const useErrorHandler = () => {
  const handleError = useCallback((error: Error, severity: ErrorSeverity = ErrorSeverity.MEDIUM) => {
    const errorId = generateErrorId()
    
    // Dispatch error event for global handling
    window.dispatchEvent(new CustomEvent('user-notification', {
      detail: { 
        type: severity === ErrorSeverity.CRITICAL ? 'error' : 'warning',
        message: error.message, 
        errorId,
        severity
      }
    }))
    
    return errorId
  }, [])

  const showNotification = useCallback((message: string, type: 'error' | 'warning' | 'info' = 'error', errorId?: string) => {
    window.dispatchEvent(new CustomEvent('user-notification', {
      detail: { type, message, errorId }
    }))
  }, [])

  return {
    handleError,
    showNotification
  }
}

// Async error handling hook
export interface UseAsyncErrorReturn<T> {
  data: T | null
  error: Error | null
  loading: boolean
  hasError: boolean
  errorId: string | null
  execute: (asyncFn: () => Promise<T>) => Promise<void>
  retry: (asyncFn?: () => Promise<T>) => Promise<void>
  clearError: () => void
}

export const useAsyncError = <T = any>(): UseAsyncErrorReturn<T> => {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorId, setErrorId] = useState<string | null>(null)
  const lastAsyncFnRef = useRef<(() => Promise<T>) | null>(null)

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    lastAsyncFnRef.current = asyncFn
    setLoading(true)
    setError(null)
    setErrorId(null)
    
    try {
      const result = await asyncFn()
      setData(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const id = generateErrorId()
      
      // Dispatch error notification
      window.dispatchEvent(new CustomEvent('user-notification', {
        detail: { 
          type: 'error',
          message: error.message, 
          errorId: id,
          severity: ErrorSeverity.MEDIUM
        }
      }))
      
      setError(error)
      setErrorId(id)
    } finally {
      setLoading(false)
    }
  }, [])

  const retry = useCallback(async (asyncFn?: () => Promise<T>) => {
    const fnToExecute = asyncFn || lastAsyncFnRef.current
    if (fnToExecute) {
      await execute(fnToExecute)
    }
  }, [execute])

  const clearError = useCallback(() => {
    setError(null)
    setErrorId(null)
  }, [])

  return {
    data,
    error,
    loading,
    hasError: !!error,
    errorId,
    execute,
    retry,
    clearError
  }
}

// Safe fetch hook with automatic error handling
export interface UseSafeFetchReturn<T> {
  data: T | null
  error: Error | null
  loading: boolean
  hasError: boolean
  refetch: () => Promise<void>
  clearError: () => void
}

export const useSafeFetch = <T = any>(
  url: string, 
  options?: RequestInit,
  autoFetch: boolean = true
): UseSafeFetchReturn<T> => {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const errorId = generateErrorId()
      
      // Dispatch error notification
      window.dispatchEvent(new CustomEvent('user-notification', {
        detail: { 
          type: 'error',
          message: error.message, 
          errorId,
          severity: ErrorSeverity.MEDIUM
        }
      }))
      
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [url, options])

  useEffect(() => {
    if (autoFetch) {
      fetchData()
    }
  }, [fetchData, autoFetch])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    data,
    error,
    loading,
    hasError: !!error,
    refetch: fetchData,
    clearError
  }
}

// Form error handling hook
export interface UseFormErrorReturn {
  fieldErrors: Record<string, string>
  generalError: string | null
  hasErrors: boolean
  setFieldError: (field: string, message: string) => void
  setGeneralError: (message: string) => void
  clearFieldError: (field: string) => void
  clearGeneralError: () => void
  clearAllErrors: () => void
  getFieldError: (field: string) => string | undefined
}

export const useFormError = (): UseFormErrorReturn => {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralErrorState] = useState<string | null>(null)

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }))
  }, [])

  const setGeneralError = useCallback((message: string) => {
    setGeneralErrorState(message)
  }, [])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const clearGeneralError = useCallback(() => {
    setGeneralErrorState(null)
  }, [])

  const clearAllErrors = useCallback(() => {
    setFieldErrors({})
    setGeneralErrorState(null)
  }, [])

  const getFieldError = useCallback((field: string) => {
    return fieldErrors[field]
  }, [fieldErrors])

  const hasErrors = Object.keys(fieldErrors).length > 0 || !!generalError

  return {
    fieldErrors,
    generalError,
    hasErrors,
    setFieldError,
    setGeneralError,
    clearFieldError,
    clearGeneralError,
    clearAllErrors,
    getFieldError
  }
}

// Network error monitoring hook
export interface UseNetworkErrorReturn {
  isOnline: boolean
  networkError: string | null
  connectionSpeed: string | null
  lastCheck: Date | null
}

export const useNetworkError = (): UseNetworkErrorReturn => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionSpeed, setConnectionSpeed] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setNetworkError(null)
      setLastCheck(new Date())
    }

    const handleOffline = () => {
      setIsOnline(false)
      setNetworkError('Network connection lost')
      setLastCheck(new Date())
    }

    // Check connection quality
    const checkConnectionSpeed = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        if (connection) {
          setConnectionSpeed(connection.effectiveType || 'unknown')
        }
      }
    }

    // Network event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial connection speed
    checkConnectionSpeed()

    // Periodic connection check
    const intervalId = setInterval(() => {
      setLastCheck(new Date())
      if (!navigator.onLine) {
        setNetworkError('Network connection unavailable')
      } else {
        setNetworkError(null)
      }
      checkConnectionSpeed()
    }, 30000) // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [])

  // Monitor fetch failures
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        if (!response.ok && response.status >= 500) {
          setNetworkError(`Server error: ${response.status}`)
        }
        return response
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          setNetworkError('Network request failed - check your connection')
        }
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return {
    isOnline,
    networkError,
    connectionSpeed,
    lastCheck
  }
}
