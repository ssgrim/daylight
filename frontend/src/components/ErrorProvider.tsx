/**
 * Error Provider Component
 * Context provider for global error handling and display
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { UserFriendlyError, ErrorContext } from '../utils/error-handler'
import errorHandler from '../utils/error-handler'

interface ErrorContextType {
  // Current error state
  currentError: UserFriendlyError | null
  
  // Error display functions
  showError: (error: Error | UserFriendlyError, context?: ErrorContext) => void
  clearError: () => void
  
  // Error state
  hasError: boolean
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [currentError, setCurrentError] = useState<UserFriendlyError | null>(null)

  const showError = useCallback((error: Error | UserFriendlyError, context?: ErrorContext) => {
    let userFriendlyError: UserFriendlyError

    // Check if it's already a UserFriendlyError
    if (error && typeof error === 'object' && 'id' in error && 'title' in error) {
      userFriendlyError = error as UserFriendlyError
    } else {
      // Convert using error handler
      userFriendlyError = errorHandler.handleError(error, context)
    }

    setCurrentError(userFriendlyError)

    // Auto-clear low severity errors after 5 seconds
    if (userFriendlyError.severity === 'low' && userFriendlyError.isDismissible) {
      setTimeout(() => {
        setCurrentError(prev => 
          prev?.id === userFriendlyError.id ? null : prev
        )
      }, 5000)
    }
  }, [])

  const clearError = useCallback(() => {
    setCurrentError(null)
  }, [])

  const contextValue: ErrorContextType = {
    currentError,
    showError,
    clearError,
    hasError: currentError !== null
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  )
}

export function useError(): ErrorContextType {
  const context = useContext(ErrorContext)
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

/**
 * Hook for form error handling
 */
export function useFormError() {
  const { showError } = useError()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const clearFieldError = useCallback((fieldName: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[fieldName]
      return newErrors
    })
  }, [])

  const setFieldError = useCallback((fieldName: string, errors: string[]) => {
    setFieldErrors(prev => ({ ...prev, [fieldName]: errors }))
  }, [])

  const handleFormError = useCallback((error: any) => {
    // Check if it's a validation error with field details
    if (error.details && Array.isArray(error.details)) {
      const fieldErrorMap: Record<string, string[]> = {}
      
      error.details.forEach((detail: any) => {
        if (detail.field && detail.message) {
          if (!fieldErrorMap[detail.field]) {
            fieldErrorMap[detail.field] = []
          }
          fieldErrorMap[detail.field].push(detail.message)
        }
      })
      
      setFieldErrors(fieldErrorMap)
    }

    // Show the error using the global error handler
    showError(error, { component: 'form' })
  }, [showError])

  return {
    fieldErrors,
    clearFieldError,
    setFieldError,
    handleFormError,
    hasFieldErrors: Object.keys(fieldErrors).length > 0
  }
}
