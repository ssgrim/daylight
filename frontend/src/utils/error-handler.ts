/**
 * Error Handler Utility
 * Centralized error handling and user-friendly error messages
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ErrorType = 
  | 'network'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'server_error'
  | 'client_error'
  | 'timeout'
  | 'unknown'

export interface ErrorAction {
  label: string
  handler: () => void
  variant?: 'primary' | 'secondary'
  icon?: string
}

export interface UserFriendlyError {
  id: string
  title: string
  message: string
  details?: string
  severity: ErrorSeverity
  type: ErrorType
  actions: ErrorAction[]
  metadata?: Record<string, any>
  timestamp: Date
  canRetry: boolean
  isDismissible: boolean
}

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  sessionId?: string
  url?: string
  userAgent?: string
  timestamp?: Date
  type?: ErrorType
  source?: string
  additionalData?: Record<string, any>
}

// Error mapping configuration
const ERROR_MAPPING: Record<string, Partial<UserFriendlyError>> = {
  // Network errors
  'NetworkError': {
    title: 'Connection Problem',
    message: 'Unable to connect to our servers. Please check your internet connection.',
    type: 'network',
    severity: 'medium',
    canRetry: true
  },
  'TimeoutError': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    type: 'timeout',
    severity: 'medium',
    canRetry: true
  },
  'fetch failed': {
    title: 'Network Error',
    message: 'Unable to reach the server. Please check your connection and try again.',
    type: 'network',
    severity: 'medium',
    canRetry: true
  },

  // Authentication errors
  'UNAUTHORIZED': {
    title: 'Authentication Required',
    message: 'You need to sign in to access this feature.',
    type: 'authentication',
    severity: 'high',
    canRetry: false
  },
  'FORBIDDEN': {
    title: 'Access Denied',
    message: 'You don\'t have permission to perform this action.',
    type: 'authorization',
    severity: 'high',
    canRetry: false
  },
  'TOKEN_EXPIRED': {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again.',
    type: 'authentication',
    severity: 'high',
    canRetry: false
  },

  // Validation errors
  'VALIDATION_ERROR': {
    title: 'Invalid Input',
    message: 'Please check your input and try again.',
    type: 'validation',
    severity: 'low',
    canRetry: false
  },
  'REQUIRED_FIELD': {
    title: 'Missing Information',
    message: 'Please fill in all required fields.',
    type: 'validation',
    severity: 'low',
    canRetry: false
  },

  // Server errors
  'INTERNAL_SERVER_ERROR': {
    title: 'Server Error',
    message: 'Something went wrong on our end. Our team has been notified.',
    type: 'server_error',
    severity: 'high',
    canRetry: true
  },
  'SERVICE_UNAVAILABLE': {
    title: 'Service Temporarily Unavailable',
    message: 'The service is temporarily down for maintenance. Please try again later.',
    type: 'server_error',
    severity: 'high',
    canRetry: true
  },
  'BAD_GATEWAY': {
    title: 'Service Error',
    message: 'There was a problem connecting to our services. Please try again.',
    type: 'server_error',
    severity: 'medium',
    canRetry: true
  },

  // Client errors
  'NOT_FOUND': {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    type: 'not_found',
    severity: 'medium',
    canRetry: false
  },
  'BAD_REQUEST': {
    title: 'Invalid Request',
    message: 'The request could not be processed. Please check your input.',
    type: 'client_error',
    severity: 'medium',
    canRetry: false
  }
}

// HTTP status code mapping
const HTTP_STATUS_MAPPING: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'TimeoutError',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'TimeoutError'
}

class ErrorHandler {
  private errorListeners: Array<(error: UserFriendlyError) => void> = []

  /**
   * Handle any error and convert it to a user-friendly format
   */
  handleError(error: any, context?: ErrorContext): UserFriendlyError {
    const userError = this.convertToUserFriendlyError(error, context)
    
    // Log error for debugging
    console.error('Error handled:', {
      original: error,
      userFriendly: userError,
      context
    })

    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(userError)
      } catch (e) {
        console.error('Error in error listener:', e)
      }
    })

    return userError
  }

  /**
   * Convert various error types to UserFriendlyError
   */
  private convertToUserFriendlyError(error: any, context?: ErrorContext): UserFriendlyError {
    const id = this.generateErrorId()
    const timestamp = new Date()
    
    // Default error structure
    let userError: UserFriendlyError = {
      id,
      title: 'Unexpected Error',
      message: 'Something unexpected happened. Please try again.',
      severity: 'medium',
      type: 'unknown',
      actions: [],
      timestamp,
      canRetry: true,
      isDismissible: true,
      metadata: { context }
    }

    // Handle different error types
    if (error instanceof Response) {
      // HTTP Response error
      userError = this.handleHttpError(error, userError)
    } else if (error instanceof Error) {
      // JavaScript Error object
      userError = this.handleJavaScriptError(error, userError)
    } else if (typeof error === 'string') {
      // String error
      userError = this.handleStringError(error, userError)
    } else if (error && typeof error === 'object') {
      // Object with error properties
      userError = this.handleObjectError(error, userError)
    }

    // Add common actions
    userError.actions = this.generateActions(userError)

    return userError
  }

  /**
   * Handle HTTP Response errors
   */
  private handleHttpError(response: Response, baseError: UserFriendlyError): UserFriendlyError {
    const statusCode = response.status
    const statusKey = HTTP_STATUS_MAPPING[statusCode]
    
    if (statusKey && ERROR_MAPPING[statusKey]) {
      return {
        ...baseError,
        ...ERROR_MAPPING[statusKey],
        details: `HTTP ${statusCode}: ${response.statusText}`,
        metadata: {
          ...baseError.metadata,
          statusCode,
          statusText: response.statusText,
          url: response.url
        }
      }
    }

    // Generic HTTP error
    return {
      ...baseError,
      title: `HTTP ${statusCode} Error`,
      message: response.statusText || 'An HTTP error occurred',
      type: statusCode >= 500 ? 'server_error' : 'client_error',
      severity: statusCode >= 500 ? 'high' : 'medium',
      details: `HTTP ${statusCode}: ${response.statusText}`,
      metadata: {
        ...baseError.metadata,
        statusCode,
        statusText: response.statusText,
        url: response.url
      }
    }
  }

  /**
   * Handle JavaScript Error objects
   */
  private handleJavaScriptError(error: Error, baseError: UserFriendlyError): UserFriendlyError {
    const errorKey = this.findErrorMapping(error.message, error.name)
    
    if (errorKey && ERROR_MAPPING[errorKey]) {
      return {
        ...baseError,
        ...ERROR_MAPPING[errorKey],
        details: error.message,
        metadata: {
          ...baseError.metadata,
          originalMessage: error.message,
          name: error.name,
          stack: error.stack
        }
      }
    }

    // Generic JavaScript error
    return {
      ...baseError,
      title: error.name || 'Error',
      message: this.sanitizeErrorMessage(error.message) || 'An unexpected error occurred',
      details: error.message,
      metadata: {
        ...baseError.metadata,
        originalMessage: error.message,
        name: error.name,
        stack: error.stack
      }
    }
  }

  /**
   * Handle string errors
   */
  private handleStringError(error: string, baseError: UserFriendlyError): UserFriendlyError {
    const errorKey = this.findErrorMapping(error)
    
    if (errorKey && ERROR_MAPPING[errorKey]) {
      return {
        ...baseError,
        ...ERROR_MAPPING[errorKey],
        details: error
      }
    }

    return {
      ...baseError,
      message: this.sanitizeErrorMessage(error),
      details: error
    }
  }

  /**
   * Handle object errors (e.g., API error responses)
   */
  private handleObjectError(error: any, baseError: UserFriendlyError): UserFriendlyError {
    const message = error.message || error.error || error.description
    const code = error.code || error.errorCode || error.type
    
    if (code && ERROR_MAPPING[code]) {
      return {
        ...baseError,
        ...ERROR_MAPPING[code],
        details: message,
        metadata: {
          ...baseError.metadata,
          originalError: error
        }
      }
    }

    return {
      ...baseError,
      title: error.title || 'Error',
      message: this.sanitizeErrorMessage(message) || 'An error occurred',
      details: message,
      metadata: {
        ...baseError.metadata,
        originalError: error
      }
    }
  }

  /**
   * Find matching error mapping key
   */
  private findErrorMapping(message: string, name?: string): string | null {
    // Check exact matches first
    if (ERROR_MAPPING[message]) return message
    if (name && ERROR_MAPPING[name]) return name

    // Check partial matches
    for (const key of Object.keys(ERROR_MAPPING)) {
      if (message.toLowerCase().includes(key.toLowerCase()) ||
          (name && name.toLowerCase().includes(key.toLowerCase()))) {
        return key
      }
    }

    return null
  }

  /**
   * Sanitize error message for user display
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message) return ''
    
    // Remove technical details that users don't need to see
    return message
      .replace(/at Object\./g, '')
      .replace(/at [A-Za-z0-9_.]+/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Generate appropriate actions for an error
   */
  private generateActions(error: UserFriendlyError): ErrorAction[] {
    const actions: ErrorAction[] = []

    // Retry action for retryable errors
    if (error.canRetry) {
      actions.push({
        label: 'Try Again',
        handler: () => window.location.reload(),
        variant: 'primary',
        icon: 'refresh'
      })
    }

    // Authentication actions
    if (error.type === 'authentication') {
      actions.push({
        label: 'Sign In',
        handler: () => {
          // Redirect to login page
          window.location.href = '/login'
        },
        variant: 'primary',
        icon: 'login'
      })
    }

    // Contact support for critical errors
    if (error.severity === 'critical' || error.severity === 'high') {
      actions.push({
        label: 'Contact Support',
        handler: () => {
          // Open support page or modal
          window.open('/support', '_blank')
        },
        variant: 'secondary',
        icon: 'help'
      })
    }

    // Go back action for not found errors
    if (error.type === 'not_found') {
      actions.push({
        label: 'Go Back',
        handler: () => window.history.back(),
        variant: 'secondary',
        icon: 'arrow-left'
      })
    }

    return actions
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add error listener
   */
  addErrorListener(listener: (error: UserFriendlyError) => void): () => void {
    this.errorListeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.errorListeners.indexOf(listener)
      if (index > -1) {
        this.errorListeners.splice(index, 1)
      }
    }
  }

  /**
   * Report error to external service (optional)
   */
  async reportError(error: UserFriendlyError): Promise<void> {
    try {
      // This would integrate with your error reporting service
      // For example: Sentry, LogRocket, Bugsnag, etc.
      console.log('Reporting error:', error)
      
      // Example implementation:
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(error)
      // })
    } catch (e) {
      console.error('Failed to report error:', e)
    }
  }
}

// Global error handler instance
export const errorHandler = new ErrorHandler()

// Global error event listeners
if (typeof window !== 'undefined') {
  // Handle unhandled errors
  window.addEventListener('error', (event) => {
    errorHandler.handleError(event.error, {
      component: 'global',
      action: 'unhandled_error',
      url: window.location.href
    })
  })

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handleError(event.reason, {
      component: 'global',
      action: 'unhandled_promise_rejection',
      url: window.location.href
    })
  })
}

// Utility functions for common error scenarios
export const ErrorUtils = {
  /**
   * Handle fetch errors
   */
  async handleFetchError(response: Response): Promise<never> {
    let errorData: any = {}
    
    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json()
      } else {
        errorData = { message: await response.text() }
      }
    } catch (e) {
      errorData = { message: response.statusText }
    }

    const error = new Error(errorData.message || `HTTP ${response.status}`)
    error.name = 'FetchError'
    ;(error as any).response = response
    ;(error as any).data = errorData

    throw error
  },

  /**
   * Handle API errors with validation
   */
  handleApiError(error: any, context?: ErrorContext): UserFriendlyError {
    return errorHandler.handleError(error, {
      component: 'api',
      ...context
    })
  },

  /**
   * Handle form validation errors
   */
  handleValidationError(errors: Record<string, string[]>): UserFriendlyError {
    const firstField = Object.keys(errors)[0]
    const firstError = errors[firstField]?.[0]

    return errorHandler.handleError({
      type: 'VALIDATION_ERROR',
      message: firstError || 'Please check your input',
      fields: errors
    }, {
      component: 'form',
      action: 'validation'
    })
  }
}

export default errorHandler
