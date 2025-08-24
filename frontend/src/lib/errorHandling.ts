// Utility functions for error handling and correlation tracking
import * as Sentry from '@sentry/react';

/**
 * Generate a unique correlation ID for tracking errors and requests
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

/**
 * Store correlation ID in session storage for the current user session
 */
export function setSessionCorrelationId(correlationId: string): void {
  try {
    sessionStorage.setItem('daylight_correlation_id', correlationId);
  } catch (error) {
    console.warn('Failed to store correlation ID in session storage:', error);
  }
}

/**
 * Get the current session correlation ID, generate one if it doesn't exist
 */
export function getSessionCorrelationId(): string {
  try {
    let correlationId = sessionStorage.getItem('daylight_correlation_id');
    if (!correlationId) {
      correlationId = generateCorrelationId();
      setSessionCorrelationId(correlationId);
    }
    return correlationId;
  } catch (error) {
    console.warn('Failed to get correlation ID from session storage:', error);
    return generateCorrelationId();
  }
}

/**
 * Enhanced error logging with correlation ID and context
 */
export function logError(
  error: Error | unknown, 
  context: {
    component?: string;
    action?: string;
    userId?: string;
    additionalData?: Record<string, any>;
  } = {}
): string {
  const correlationId = getSessionCorrelationId();
  const timestamp = new Date().toISOString();
  
  const errorInfo = {
    correlationId,
    timestamp,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
    },
    context: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ...context,
    },
    sessionData: {
      referrer: document.referrer,
      language: navigator.language,
      online: navigator.onLine,
    }
  };

  // Log to console with structured data
  console.error(`[${correlationId}] Error in ${context.component || 'Unknown'}:`, errorInfo);
  
  // Send to external logging service (Sentry) if available
  try {
    Sentry.withScope((scope) => {
      scope.setTag('correlationId', correlationId);
      scope.setContext('errorDetails', errorInfo);
      
      if (context.component) {
        scope.setTag('component', context.component);
      }
      
      if (context.action) {
        scope.setTag('action', context.action);
      }
      
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  } catch (sentryError) {
    console.warn('Failed to send error to Sentry:', sentryError);
  }
  
  return correlationId;
}

/**
 * Log non-error events with correlation ID for debugging
 */
export function logInfo(
  message: string, 
  context: Record<string, any> = {}
): void {
  const correlationId = getSessionCorrelationId();
  
  console.info(`[${correlationId}] ${message}`, {
    correlationId,
    timestamp: new Date().toISOString(),
    ...context
  });
}

/**
 * Enhanced fetch wrapper that includes correlation ID in headers
 */
export async function fetchWithCorrelation(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const correlationId = getSessionCorrelationId();
  
  const enhancedOptions: RequestInit = {
    ...options,
    headers: {
      'X-Correlation-ID': correlationId,
      'X-User-Agent': navigator.userAgent,
      ...options.headers,
    },
  };

  try {
    logInfo(`Making request to ${url}`, { method: options.method || 'GET' });
    const response = await fetch(url, enhancedOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    logError(error, {
      component: 'fetchWithCorrelation',
      action: 'http_request',
      additionalData: { url, method: options.method || 'GET' }
    });
    throw error;
  }
}
