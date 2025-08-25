/**
 * Error Notification Components
 * 
 * UI components for displaying error notifications and messages to users
 */

import * as React from 'react'
import { useState, useEffect } from 'react'
import { ErrorSeverity } from './GlobalErrorHandler'

// Notification interface
interface ErrorNotification {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  errorId?: string
  severity?: ErrorSeverity
  autoClose?: boolean
  duration?: number
}

// Toast notification component
export const ErrorToast: React.FC<{
  notification: ErrorNotification
  onClose: (id: string) => void
}> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (notification.autoClose !== false) {
      const duration = notification.duration || 5000
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsVisible(false)
      onClose(notification.id)
    }, 300)
  }

  if (!isVisible) return null

  const getToastStyles = () => {
    const baseStyles = `fixed top-4 right-4 max-w-sm w-full bg-white rounded-lg shadow-lg border z-50 transform transition-all duration-300 ${
      isClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
    }`

    switch (notification.type) {
      case 'error':
        return `${baseStyles} border-red-200`
      case 'warning':
        return `${baseStyles} border-yellow-200`
      default:
        return `${baseStyles} border-blue-200`
    }
  }

  const getIconColor = () => {
    switch (notification.type) {
      case 'error':
        return 'text-red-500'
      case 'warning':
        return 'text-yellow-500'
      default:
        return 'text-blue-500'
    }
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div className={getToastStyles()}>
      <div className="p-4">
        <div className="flex items-start">
          <div className={`flex-shrink-0 ${getIconColor()}`}>
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">
              {notification.message}
            </p>
            {notification.errorId && (
              <p className="mt-1 text-xs text-gray-500 font-mono">
                ID: {notification.errorId}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleClose}
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Error notification manager component
export const ErrorNotificationManager: React.FC = () => {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([])

  useEffect(() => {
    const handleUserNotification = (event: Event) => {
      const customEvent = event as CustomEvent
      const { type, message, errorId, severity } = customEvent.detail

      const notification: ErrorNotification = {
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        errorId,
        severity,
        autoClose: type !== 'error' || severity !== ErrorSeverity.CRITICAL
      }

      setNotifications(prev => [...prev, notification])
    }

    window.addEventListener('user-notification', handleUserNotification)
    return () => window.removeEventListener('user-notification', handleUserNotification)
  }, [])

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2">
      {notifications.map(notification => (
        <ErrorToast
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  )
}

// Inline error message component
export const InlineError: React.FC<{
  message: string
  errorId?: string
  onRetry?: () => void
  onDismiss?: () => void
  size?: 'sm' | 'md' | 'lg'
}> = ({ message, errorId, onRetry, onDismiss, size = 'md' }) => {
  const sizeStyles = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base'
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md ${sizeStyles[size]}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-2 flex-1">
          <p className="text-red-800">{message}</p>
          {errorId && (
            <p className="mt-1 text-xs text-red-600 font-mono">Error ID: {errorId}</p>
          )}
          {(onRetry || onDismiss) && (
            <div className="mt-2 space-x-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Loading error state component
export const LoadingError: React.FC<{
  message?: string
  onRetry?: () => void
  loading?: boolean
}> = ({ 
  message = 'Failed to load data', 
  onRetry,
  loading = false
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load</h3>
      <p className="text-gray-600 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </>
          ) : (
            'Try Again'
          )}
        </button>
      )}
    </div>
  )
}
