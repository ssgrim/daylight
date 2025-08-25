/**
 * Centralized Error Handling System
 * Provides comprehensive error management with user-friendly messages
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface UserFriendlyError {
  type: ErrorType
  severity: ErrorSeverity
  title: string
  message: string
  details?: string
  actionable: boolean
  actions?: ErrorAction[]
  originalError?: Error
  timestamp: Date
  context?: Record<string, any>
}

export interface ErrorAction {
  label: string
  action: () => void | Promise<void>
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: string
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorListeners: ((error: UserFriendlyError) => void)[] = []

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * Convert various error types to user-friendly format
   */
  handleError(error: Error | any, context?: Record<string, any>): UserFriendlyError {
    const userError = this.transformError(error, context)
    
    // Notify all listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(userError)
      } catch (e) {
        console.error('Error in error listener:', e)
      }
    })

    // Log for debugging
    this.logError(userError)

    return userError
  }

  /**
   * Transform raw errors into user-friendly messages
   */
  private transformError(error: Error | any, context?: Record<string, any>): UserFriendlyError {
    const timestamp = new Date()

    // Network errors
    if (this.isNetworkError(error)) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        title: 'Connection Problem',
        message: 'We\'re having trouble connecting to our servers. Please check your internet connection.',
        details: 'This usually resolves itself in a few moments. If the problem persists, try refreshing the page.',
        actionable: true,
        actions: [
          {
            label: 'Try Again',
            action: () => window.location.reload(),
            variant: 'primary',
            icon: '🔄'
          },
          {
            label: 'Check Connection',
            action: () => { window.open('https://www.google.com', '_blank') },
            variant: 'secondary',
            icon: '🌐'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Authentication errors
    if (this.isAuthError(error)) {
      return {
        type: ErrorType.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        title: 'Authentication Required',
        message: 'Your session has expired. Please sign in again to continue.',
        details: 'For your security, we regularly refresh authentication tokens.',
        actionable: true,
        actions: [
          {
            label: 'Sign In',
            action: () => this.redirectToLogin(),
            variant: 'primary',
            icon: '🔑'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Authorization errors
    if (this.isAuthorizationError(error)) {
      return {
        type: ErrorType.AUTHORIZATION,
        severity: ErrorSeverity.MEDIUM,
        title: 'Access Denied',
        message: 'You don\'t have permission to access this resource.',
        details: 'If you believe this is an error, please contact support.',
        actionable: true,
        actions: [
          {
            label: 'Go Back',
            action: () => window.history.back(),
            variant: 'secondary',
            icon: '←'
          },
          {
            label: 'Contact Support',
            action: () => this.contactSupport(),
            variant: 'primary',
            icon: '💬'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        details: this.extractValidationDetails(error),
        actionable: true,
        actions: [
          {
            label: 'Fix Input',
            action: () => {}, // Will be handled by form components
            variant: 'primary',
            icon: '✏️'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // 404 Not Found
    if (this.isNotFoundError(error)) {
      return {
        type: ErrorType.NOT_FOUND,
        severity: ErrorSeverity.MEDIUM,
        title: 'Page Not Found',
        message: 'The page you\'re looking for doesn\'t exist or has been moved.',
        details: 'This might be due to a broken link or outdated bookmark.',
        actionable: true,
        actions: [
          {
            label: 'Go Home',
            action: () => { window.location.href = '/' },
            variant: 'primary',
            icon: '🏠'
          },
          {
            label: 'Go Back',
            action: () => window.history.back(),
            variant: 'secondary',
            icon: '←'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Server errors
    if (this.isServerError(error)) {
      return {
        type: ErrorType.SERVER_ERROR,
        severity: ErrorSeverity.HIGH,
        title: 'Server Error',
        message: 'Something went wrong on our end. We\'re working to fix this.',
        details: 'Our team has been notified and is investigating the issue.',
        actionable: true,
        actions: [
          {
            label: 'Try Again',
            action: () => window.location.reload(),
            variant: 'primary',
            icon: '🔄'
          },
          {
            label: 'Report Issue',
            action: () => this.reportIssue(error, context),
            variant: 'secondary',
            icon: '📝'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return {
        type: ErrorType.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        title: 'Request Timeout',
        message: 'The request is taking longer than expected.',
        details: 'This might be due to slow network conditions or high server load.',
        actionable: true,
        actions: [
          {
            label: 'Try Again',
            action: () => window.location.reload(),
            variant: 'primary',
            icon: '🔄'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Offline errors
    if (!navigator.onLine) {
      return {
        type: ErrorType.OFFLINE,
        severity: ErrorSeverity.HIGH,
        title: 'You\'re Offline',
        message: 'Please check your internet connection and try again.',
        details: 'Some features may not work while offline.',
        actionable: true,
        actions: [
          {
            label: 'Try Again',
            action: () => window.location.reload(),
            variant: 'primary',
            icon: '📡'
          }
        ],
        originalError: error,
        timestamp,
        context
      }
    }

    // Default unknown error
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again.',
      details: 'If this continues to happen, please contact support.',
      actionable: true,
      actions: [
        {
          label: 'Try Again',
          action: () => window.location.reload(),
          variant: 'primary',
          icon: '🔄'
        },
        {
          label: 'Contact Support',
          action: () => this.contactSupport(),
          variant: 'secondary',
          icon: '💬'
        }
      ],
      originalError: error,
      timestamp,
      context
    }
  }

  /**
   * Error type detection methods
   */
  private isNetworkError(error: any): boolean {
    return (
      error?.code === 'NETWORK_ERROR' ||
      error?.message?.includes('fetch') ||
      error?.message?.includes('Network') ||
      error?.name === 'NetworkError' ||
      (error?.response === undefined && error?.request)
    )
  }

  private isAuthError(error: any): boolean {
    return (
      error?.status === 401 ||
      error?.response?.status === 401 ||
      error?.code === 'UNAUTHORIZED' ||
      error?.message?.includes('unauthorized')
    )
  }

  private isAuthorizationError(error: any): boolean {
    return (
      error?.status === 403 ||
      error?.response?.status === 403 ||
      error?.code === 'FORBIDDEN'
    )
  }

  private isValidationError(error: any): boolean {
    return (
      error?.status === 400 ||
      error?.response?.status === 400 ||
      error?.code === 'VALIDATION_ERROR' ||
      (error?.details && Array.isArray(error.details))
    )
  }

  private isNotFoundError(error: any): boolean {
    return (
      error?.status === 404 ||
      error?.response?.status === 404 ||
      error?.code === 'NOT_FOUND'
    )
  }

  private isServerError(error: any): boolean {
    const status = error?.status || error?.response?.status
    return status >= 500 && status < 600
  }

  private isTimeoutError(error: any): boolean {
    return (
      error?.code === 'TIMEOUT' ||
      error?.name === 'TimeoutError' ||
      error?.message?.includes('timeout')
    )
  }

  /**
   * Utility methods
   */
  private extractValidationDetails(error: any): string {
    if (error?.details && Array.isArray(error.details)) {
      return error.details.map((detail: any) => detail.message || detail).join(', ')
    }
    if (error?.message) {
      return error.message
    }
    return 'Please check your input fields for errors.'
  }

  private redirectToLogin(): void {
    // Implement login redirect logic
    window.location.href = '/login'
  }

  private contactSupport(): void {
    // Implement support contact logic
    window.open('mailto:support@daylight.com?subject=Support Request', '_blank')
  }

  private reportIssue(error: any, context?: Record<string, any>): void {
    // Implement issue reporting
    console.log('Reporting issue:', { error, context })
    // Could send to error tracking service like Sentry
  }

  private logError(userError: UserFriendlyError): void {
    const logLevel = this.getLogLevel(userError.severity)
    console[logLevel]('Error handled:', {
      type: userError.type,
      severity: userError.severity,
      title: userError.title,
      message: userError.message,
      originalError: userError.originalError,
      context: userError.context,
      timestamp: userError.timestamp
    })
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.LOW:
        return 'info'
      default:
        return 'error'
    }
  }

  /**
   * Subscribe to error events
   */
  onError(listener: (error: UserFriendlyError) => void): () => void {
    this.errorListeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.errorListeners.indexOf(listener)
      if (index > -1) {
        this.errorListeners.splice(index, 1)
      }
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance()
