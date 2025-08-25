/**
 * Global Error Handler
 * 
 * Centralized error handling for the entire application including
 * unhandled promise rejections, JavaScript errors, and API errors
 */

// Error types
export enum ErrorType {
  COMPONENT_ERROR = 'component-error',
  API_ERROR = 'api-error',
  NETWORK_ERROR = 'network-error',
  AUTHENTICATION_ERROR = 'auth-error',
  VALIDATION_ERROR = 'validation-error',
  PERMISSION_ERROR = 'permission-error',
  UNKNOWN_ERROR = 'unknown-error'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error information interface
export interface ErrorInfo {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  error?: Error
  context?: Record<string, any>
  timestamp: string
  errorId: string
  userId?: string
  sessionId?: string
  userAgent: string
  url: string
  stack?: string
}

// Error handler configuration
interface ErrorHandlerConfig {
  enableConsoleLogging: boolean
  enableRemoteLogging: boolean
  enableUserNotification: boolean
  remoteEndpoint?: string
  userId?: string
  sessionId?: string
}

// Global error handler class
class GlobalErrorHandler {
  private config: ErrorHandlerConfig
  private errorQueue: ErrorInfo[] = []
  private maxQueueSize = 100
  private isOnline = navigator.onLine

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      enableUserNotification: true,
      ...config
    }

    this.setupEventListeners()
    this.setupNetworkStatusListener()
  }

  /**
   * Setup global error event listeners
   */
  private setupEventListeners() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        message: event.message || 'Uncaught JavaScript error',
        error: event.error,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        message: 'Unhandled promise rejection',
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        context: {
          reason: event.reason
        }
      })
    })

    // Handle custom app errors
    window.addEventListener('app-error', (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail
      this.handleError({
        type: detail.type || ErrorType.UNKNOWN_ERROR,
        severity: detail.severity || ErrorSeverity.MEDIUM,
        message: detail.error?.message || detail.message || 'Application error',
        error: detail.error ? new Error(detail.error.message) : undefined,
        context: detail
      })
    })
  }

  /**
   * Setup network status monitoring
   */
  private setupNetworkStatusListener() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushErrorQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorHandlerConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Handle error with full context
   */
  public handleError(errorData: Partial<ErrorInfo>) {
    const errorInfo: ErrorInfo = {
      type: ErrorType.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      errorId: this.generateErrorId(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      ...errorData,
      stack: errorData.error?.stack
    }

    // Log to console if enabled
    if (this.config.enableConsoleLogging) {
      this.logToConsole(errorInfo)
    }

    // Add to queue for remote logging
    if (this.config.enableRemoteLogging) {
      this.queueError(errorInfo)
    }

    // Show user notification if enabled and appropriate
    if (this.config.enableUserNotification && this.shouldNotifyUser(errorInfo)) {
      this.notifyUser(errorInfo)
    }

    return errorInfo.errorId
  }

  /**
   * Handle API errors specifically
   */
  public handleApiError(error: any, context?: Record<string, any>) {
    let errorType = ErrorType.API_ERROR
    let severity = ErrorSeverity.MEDIUM
    let message = 'API request failed'

    // Determine specific error type and severity
    if (error.status === 401 || error.status === 403) {
      errorType = ErrorType.AUTHENTICATION_ERROR
      severity = ErrorSeverity.HIGH
      message = 'Authentication failed'
    } else if (error.status === 400) {
      errorType = ErrorType.VALIDATION_ERROR
      severity = ErrorSeverity.LOW
      message = 'Invalid request data'
    } else if (error.status >= 500) {
      severity = ErrorSeverity.HIGH
      message = 'Server error'
    } else if (!navigator.onLine) {
      errorType = ErrorType.NETWORK_ERROR
      message = 'Network connection unavailable'
    }

    return this.handleError({
      type: errorType,
      severity,
      message,
      error: error instanceof Error ? error : new Error(message),
      context: {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        ...context
      }
    })
  }

  /**
   * Handle network errors
   */
  public handleNetworkError(error: any, context?: Record<string, any>) {
    return this.handleError({
      type: ErrorType.NETWORK_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: 'Network request failed',
      error: error instanceof Error ? error : new Error('Network error'),
      context
    })
  }

  /**
   * Log error to console
   */
  private logToConsole(errorInfo: ErrorInfo) {
    const logMethod = errorInfo.severity === ErrorSeverity.CRITICAL || errorInfo.severity === ErrorSeverity.HIGH 
      ? console.error 
      : console.warn

    logMethod(`[${errorInfo.severity.toUpperCase()}] ${errorInfo.type}: ${errorInfo.message}`, {
      errorId: errorInfo.errorId,
      timestamp: errorInfo.timestamp,
      context: errorInfo.context,
      stack: errorInfo.stack
    })
  }

  /**
   * Queue error for remote logging
   */
  private queueError(errorInfo: ErrorInfo) {
    // Add to queue
    this.errorQueue.push(errorInfo)

    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift()
    }

    // Attempt to flush if online
    if (this.isOnline) {
      this.flushErrorQueue()
    }
  }

  /**
   * Flush error queue to remote endpoint
   */
  private async flushErrorQueue() {
    if (!this.config.remoteEndpoint || this.errorQueue.length === 0) {
      return
    }

    const errors = [...this.errorQueue]
    this.errorQueue = []

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ errors })
      })
    } catch (error) {
      // If remote logging fails, put errors back in queue
      this.errorQueue.unshift(...errors)
      console.warn('Failed to send errors to remote endpoint:', error)
    }
  }

  /**
   * Determine if user should be notified
   */
  private shouldNotifyUser(errorInfo: ErrorInfo): boolean {
    // Don't notify for low severity errors
    if (errorInfo.severity === ErrorSeverity.LOW) {
      return false
    }

    // Don't notify for certain error types
    if (errorInfo.type === ErrorType.VALIDATION_ERROR) {
      return false
    }

    // Only notify for errors that affect user experience
    return [
      ErrorType.AUTHENTICATION_ERROR,
      ErrorType.NETWORK_ERROR,
      ErrorType.API_ERROR
    ].includes(errorInfo.type)
  }

  /**
   * Show user notification
   */
  private notifyUser(errorInfo: ErrorInfo) {
    // Dispatch custom event for UI components to handle
    window.dispatchEvent(new CustomEvent('user-notification', {
      detail: {
        type: 'error',
        message: this.getUserFriendlyMessage(errorInfo),
        errorId: errorInfo.errorId,
        severity: errorInfo.severity
      }
    }))
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    switch (errorInfo.type) {
      case ErrorType.NETWORK_ERROR:
        return 'Network connection issue. Please check your internet connection and try again.'
      case ErrorType.AUTHENTICATION_ERROR:
        return 'Your session has expired. Please sign in again.'
      case ErrorType.API_ERROR:
        return 'We\'re experiencing technical difficulties. Please try again in a moment.'
      case ErrorType.PERMISSION_ERROR:
        return 'You don\'t have permission to perform this action.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get error statistics
   */
  public getErrorStats() {
    return {
      queueSize: this.errorQueue.length,
      isOnline: this.isOnline,
      config: this.config
    }
  }

  /**
   * Clear error queue
   */
  public clearErrorQueue() {
    this.errorQueue = []
  }
}

// Global error handler instance
export const globalErrorHandler = new GlobalErrorHandler()

// Enhanced fetch function with error handling
export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, options)
    
    if (!response.ok) {
      globalErrorHandler.handleApiError(
        {
          status: response.status,
          statusText: response.statusText,
          url
        },
        { method: options?.method || 'GET' }
      )
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return response
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      globalErrorHandler.handleNetworkError(error, { url, method: options?.method || 'GET' })
    }
    throw error
  }
}

// Async error handler wrapper
export function handleAsyncError<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      globalErrorHandler.handleError({
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: 'Async operation failed',
        error: error instanceof Error ? error : new Error(String(error)),
        context
      })
      throw error
    }
  }) as T
}
