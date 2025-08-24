import * as Sentry from '@sentry/node'

// Initialize Sentry for Lambda functions
export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  const environment = process.env.NODE_ENV || 'development'
  const release = process.env.SENTRY_RELEASE || process.env.GIT_SHA || 'unknown'
  
  if (!dsn) {
    console.warn('SENTRY_DSN not configured - error tracking disabled')
    return false
  }

  Sentry.init({
    dsn,
    environment,
    release,
    
    // Serverless configuration
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    debug: environment === 'development',
    
    // Capture additional context
    beforeSend(event) {
      // Add Lambda context if available
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        event.tags = {
          ...event.tags,
          lambda_function: process.env.AWS_LAMBDA_FUNCTION_NAME,
          lambda_version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
          lambda_region: process.env.AWS_REGION,
        }
      }
      
      // Filter out health check errors (they should be rare and not noise)
      if (event.request?.url?.includes('/health')) {
        return null
      }
      
      return event
    },
    
    // Integration configuration
    integrations: [
      // Add performance monitoring
      Sentry.httpIntegration(),
    ],
  })

  console.log(`Sentry initialized for environment: ${environment}, release: ${release}`)
  return true
}

// Wrapper for Lambda handlers with error tracking
export function withSentry<T extends (...args: any[]) => any>(handler: T): T {
  return (async (...args: any[]) => {
    try {
      const result = await handler(...args)
      return result
    } catch (error) {
      // Capture the error with Sentry
      Sentry.captureException(error, {
        contexts: {
          lambda: {
            event: args[0], // Lambda event
            context: args[1], // Lambda context
          }
        }
      })
      
      // Re-throw the error to maintain normal Lambda error handling
      throw error
    }
  }) as T
}

// Utility to capture custom events
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      custom: context
    }
  })
}

// Utility to capture custom messages
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  Sentry.captureMessage(message, level, {
    contexts: {
      custom: context
    }
  })
}
