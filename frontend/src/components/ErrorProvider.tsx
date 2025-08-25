/**
 * Error Provider
 * Global error handling and display system
 */

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { announceToScreenReader } from '../utils/accessibility'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ErrorType = 
  | 'network' 
  | 'validation' 
  | 'authorization' 
  | 'server' 
  | 'client' 
  | 'timeout'
  | 'unknown'

export interface ErrorAction {
  label: string
  handler: () => void
  variant: 'primary' | 'secondary' | 'danger'
  icon?: string
}

export interface ErrorInfo {
  id: string
  type: ErrorType
  severity: ErrorSeverity
  title: string
  message: string
  details?: string
  actions: ErrorAction[]
  timestamp: Date
  canRetry: boolean
  isDismissible: boolean
  retryCount?: number
  maxRetries?: number
}

export interface ErrorContextOptions {
  type?: ErrorType
  source?: string
  retryable?: boolean
  silent?: boolean
}

export interface ErrorContextType {
  errors: ErrorInfo[]
  showError: (error: Error | ErrorInfo, options?: ErrorContextOptions) => void
  dismissError: (id: string) => void
  retryError: (id: string) => void
  clearAllErrors: () => void
}

const ErrorContext = createContext<ErrorContextType | null>(null)

export interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [errors, setErrors] = useState<ErrorInfo[]>([])

  // Auto-dismiss low severity errors after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setErrors(prev => prev.filter(error => {
        if (error.severity === 'low' && error.isDismissible) {
          const age = Date.now() - error.timestamp.getTime()
          return age < 5000 // Keep for 5 seconds
        }
        return true
      }))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const showError = (error: Error | ErrorInfo, options: ErrorContextOptions = {}) => {
    let errorInfo: ErrorInfo

    if ('id' in error) {
      // Already an ErrorInfo object
      errorInfo = error
    } else {
      // Convert Error to ErrorInfo
      const severity = determineSeverity(error, options)
      const type = determineType(error, options)
      
      errorInfo = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity,
        title: getErrorTitle(error, type),
        message: getErrorMessage(error),
        details: getErrorDetails(error),
        actions: getErrorActions(error, type, options),
        timestamp: new Date(),
        canRetry: options.retryable ?? isRetryable(error, type),
        isDismissible: severity !== 'critical',
        retryCount: 0,
        maxRetries: 3
      }
    }

    setErrors(prev => [...prev, errorInfo])

    // Announce to screen readers
    if (!options.silent) {
      const announcement = `${errorInfo.severity} error: ${errorInfo.title}. ${errorInfo.message}`
      announceToScreenReader(announcement, errorInfo.severity === 'critical' ? 'assertive' : 'polite')
    }
  }

  const dismissError = (id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id))
  }

  const retryError = (id: string) => {
    setErrors(prev => prev.map(error => {
      if (error.id === id && error.canRetry) {
        const retryCount = (error.retryCount || 0) + 1
        if (retryCount >= (error.maxRetries || 3)) {
          return { ...error, canRetry: false }
        }
        return { ...error, retryCount }
      }
      return error
    }))
  }

  const clearAllErrors = () => {
    setErrors([])
  }

  const contextValue: ErrorContextType = {
    errors,
    showError,
    dismissError,
    retryError,
    clearAllErrors
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      <ErrorDisplay />
    </ErrorContext.Provider>
  )
}

export function useError(): ErrorContextType {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

// Helper functions
function determineSeverity(error: Error, options: ErrorContextOptions): ErrorSeverity {
  const status = (error as any).status
  
  if (status === 401 || status === 403) return 'medium'
  if (status === 404) return 'low'
  if (status >= 500) return 'high'
  if (options.type === 'network') return 'medium'
  if (options.type === 'validation') return 'low'
  
  return 'medium'
}

function determineType(error: Error, options: ErrorContextOptions): ErrorType {
  if (options.type) return options.type
  
  const status = (error as any).status
  const message = error.message.toLowerCase()
  
  if (status === 401 || status === 403) return 'authorization'
  if (status === 404) return 'client'
  if (status >= 500) return 'server'
  if (message.includes('network') || message.includes('fetch')) return 'network'
  if (message.includes('validation') || message.includes('invalid')) return 'validation'
  if (message.includes('timeout')) return 'timeout'
  
  return 'unknown'
}

function getErrorTitle(error: Error, type: ErrorType): string {
  const status = (error as any).status
  
  switch (status) {
    case 401: return 'Authentication Required'
    case 403: return 'Access Denied'
    case 404: return 'Not Found'
    case 500: return 'Server Error'
    default:
      switch (type) {
        case 'network': return 'Connection Problem'
        case 'validation': return 'Invalid Input'
        case 'authorization': return 'Access Denied'
        case 'timeout': return 'Request Timeout'
        default: return 'Something Went Wrong'
      }
  }
}

function getErrorMessage(error: Error): string {
  const status = (error as any).status
  
  switch (status) {
    case 401: return 'Please log in to continue.'
    case 403: return 'You don\'t have permission to perform this action.'
    case 404: return 'The requested resource could not be found.'
    case 500: return 'An internal server error occurred. Please try again later.'
    default: return error.message || 'An unexpected error occurred.'
  }
}

function getErrorDetails(error: Error): string | undefined {
  const details = (error as any).details
  if (Array.isArray(details)) {
    return details.map(d => `${d.field}: ${d.message}`).join(', ')
  }
  return details
}

function getErrorActions(error: Error, type: ErrorType, options: ErrorContextOptions): ErrorAction[] {
  const actions: ErrorAction[] = []
  const status = (error as any).status
  
  // Add retry action for retryable errors
  if (isRetryable(error, type)) {
    actions.push({
      label: 'Retry',
      handler: () => console.log('Retrying...'),
      variant: 'primary',
      icon: '🔄'
    })
  }
  
  // Add specific actions based on error type
  switch (status) {
    case 401:
      actions.push({
        label: 'Log In',
        handler: () => window.location.href = '/login',
        variant: 'primary',
        icon: '🔐'
      })
      break
    case 403:
      actions.push({
        label: 'Contact Support',
        handler: () => window.open('mailto:support@example.com'),
        variant: 'secondary',
        icon: '📧'
      })
      break
    case 404:
      actions.push({
        label: 'Go Home',
        handler: () => window.location.href = '/',
        variant: 'secondary',
        icon: '🏠'
      })
      break
  }
  
  return actions
}

function isRetryable(error: Error, type: ErrorType): boolean {
  const status = (error as any).status
  
  // Don't retry client errors
  if (status >= 400 && status < 500) return false
  
  // Retry server errors and network issues
  if (status >= 500) return true
  if (type === 'network' || type === 'timeout') return true
  
  return false
}

// Error Display Component
function ErrorDisplay() {
  const { errors, dismissError, retryError } = useError()

  if (errors.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {errors.map(error => (
        <div
          key={error.id}
          className={`rounded-lg shadow-lg p-4 ${getSeverityClasses(error.severity)}`}
          role="alert"
          aria-live={error.severity === 'critical' ? 'assertive' : 'polite'}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-sm">{error.title}</h3>
            {error.isDismissible && (
              <button
                onClick={() => dismissError(error.id)}
                className="ml-2 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            )}
          </div>
          
          <p className="text-sm mb-2">{error.message}</p>
          
          {error.details && (
            <p className="text-xs opacity-75 mb-2">{error.details}</p>
          )}
          
          {error.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {error.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.handler}
                  className={`text-xs px-3 py-1 rounded ${getActionClasses(action.variant)}`}
                >
                  {action.icon && <span className="mr-1">{action.icon}</span>}
                  {action.label}
                </button>
              ))}
              
              {error.canRetry && (
                <button
                  onClick={() => retryError(error.id)}
                  className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  🔄 Retry ({error.retryCount || 0}/{error.maxRetries || 3})
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function getSeverityClasses(severity: ErrorSeverity): string {
  switch (severity) {
    case 'low': return 'bg-blue-50 border border-blue-200 text-blue-800'
    case 'medium': return 'bg-yellow-50 border border-yellow-200 text-yellow-800'
    case 'high': return 'bg-orange-50 border border-orange-200 text-orange-800'
    case 'critical': return 'bg-red-50 border border-red-200 text-red-800'
    default: return 'bg-gray-50 border border-gray-200 text-gray-800'
  }
}

function getActionClasses(variant: string): string {
  switch (variant) {
    case 'primary': return 'bg-blue-600 text-white hover:bg-blue-700'
    case 'secondary': return 'bg-gray-600 text-white hover:bg-gray-700'
    case 'danger': return 'bg-red-600 text-white hover:bg-red-700'
    default: return 'bg-gray-600 text-white hover:bg-gray-700'
  }
}
