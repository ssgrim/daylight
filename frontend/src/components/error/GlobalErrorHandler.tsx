/**
 * Global Error Handler
 * 
 * Centralized error handling and reporting system for the application
 */

import * as React from 'react'
import { createContext, useContext, useCallback, useState, ReactNode } from 'react'

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error types
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown'
}

// Error information interface
export interface ErrorInfo {
  id: string
  message: string
  type: ErrorType
  severity: ErrorSeverity
  timestamp: Date
  stack?: string
  metadata?: Record<string, any>
  userAgent?: string
  url?: string
  userId?: string
}

// Error context interface
interface ErrorContextType {
  errors: ErrorInfo[]
  reportError: (error: Error, type?: ErrorType, severity?: ErrorSeverity, metadata?: Record<string, any>) => string
  reportCustomError: (message: string, type?: ErrorType, severity?: ErrorSeverity, metadata?: Record<string, any>) => string
  clearError: (errorId: string) => void
  clearAllErrors: () => void
  getErrorById: (errorId: string) => ErrorInfo | undefined
}

// Create error context
const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

// Error handler provider props
interface ErrorHandlerProviderProps {
  children: ReactNode
  onError?: (errorInfo: ErrorInfo) => void
  maxErrors?: number
}

// Generate unique error ID
const generateErrorId = (): string => {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Get user context information
const getUserContext = () => {
  return {
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date(),
    // Add more context as needed
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  }
}

// Error handler provider component
export const ErrorHandlerProvider: React.FC<ErrorHandlerProviderProps> = ({
  children,
  onError,
  maxErrors = 100
}) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([])

  const reportError = useCallback((
    error: Error,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    metadata: Record<string, any> = {}
  ): string => {
    const errorId = generateErrorId()
    const userContext = getUserContext()

    const errorInfo: ErrorInfo = {
      id: errorId,
      message: error.message,
      type,
      severity,
      timestamp: userContext.timestamp,
      stack: error.stack,
      metadata: {
        ...metadata,
        ...userContext
      },
      userAgent: userContext.userAgent,
      url: userContext.url
    }

    setErrors(prev => {
      const newErrors = [errorInfo, ...prev].slice(0, maxErrors)
      return newErrors
    })

    // Call external error handler if provided
    onError?.(errorInfo)

    // Dispatch custom event for notifications
    window.dispatchEvent(new CustomEvent('user-notification', {
      detail: {
        type: severity === ErrorSeverity.CRITICAL ? 'error' : 'warning',
        message: error.message,
        errorId,
        severity
      }
    }))

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', errorInfo)
    }

    return errorId
  }, [onError, maxErrors])

  const reportCustomError = useCallback((
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    metadata: Record<string, any> = {}
  ): string => {
    const customError = new Error(message)
    return reportError(customError, type, severity, metadata)
  }, [reportError])

  const clearError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(error => error.id !== errorId))
  }, [])

  const clearAllErrors = useCallback(() => {
    setErrors([])
  }, [])

  const getErrorById = useCallback((errorId: string) => {
    return errors.find(error => error.id === errorId)
  }, [errors])

  const contextValue: ErrorContextType = {
    errors,
    reportError,
    reportCustomError,
    clearError,
    clearAllErrors,
    getErrorById
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  )
}

// Hook to use error context
export const useErrorHandler = (): ErrorContextType => {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useErrorHandler must be used within an ErrorHandlerProvider')
  }
  return context
}

// Utility functions for common error scenarios
export const errorUtils = {
  // Network error handling
  handleNetworkError: (error: Error, metadata?: Record<string, any>) => {
    return generateErrorId() // Would use actual error handler in real implementation
  },

  // API error handling
  handleApiError: (response: Response, metadata?: Record<string, any>) => {
    const error = new Error(`API Error: ${response.status} ${response.statusText}`)
    return generateErrorId() // Would use actual error handler in real implementation
  },

  // Validation error handling
  handleValidationError: (message: string, field?: string) => {
    const error = new Error(message)
    return generateErrorId() // Would use actual error handler in real implementation
  }
}

export default ErrorHandlerProvider
