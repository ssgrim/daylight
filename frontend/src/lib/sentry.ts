import * as Sentry from '@sentry/react'

// Initialize Sentry for React frontend
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  const environment = import.meta.env.VITE_NODE_ENV || import.meta.env.MODE || 'development'
  const release = import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_GIT_SHA || 'unknown'
  
  if (!dsn) {
    console.warn('VITE_SENTRY_DSN not configured - error tracking disabled')
    return false
  }

  Sentry.init({
    dsn,
    environment,
    release,
    
    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    debug: environment === 'development',
    
    // Capture additional context
    beforeSend(event) {
      // Filter out development noise
      if (environment === 'development') {
        // Don't send HMR related errors in development
        if (event.exception?.values?.[0]?.value?.includes('HMR')) {
          return null
        }
      }
      
      // Add browser context
      event.tags = {
        ...event.tags,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href,
      }
      
      return event
    },
    
    // Integration configuration
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: environment === 'production', // Mask text in production
        blockAllMedia: environment === 'production', // Block media in production
      }),
    ],
    
    // Session replay configuration
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
  })

  console.log(`Sentry initialized for environment: ${environment}, release: ${release}`)
  return true
}

// React Error Boundary component
export const SentryErrorBoundary = Sentry.ErrorBoundary

// Utility functions for manual error tracking
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      custom: context
    }
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  Sentry.captureMessage(message, level, {
    contexts: {
      custom: context
    }
  })
}

// Track user interactions
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user)
}

// Track custom events
export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'custom',
    data,
    level: 'info'
  })
}

// Performance monitoring
export function startSpan(name: string, op: string) {
  return Sentry.startSpan({ name, op }, (span) => {
    return span;
  });
}
