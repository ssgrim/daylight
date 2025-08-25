/**
 * CORS (Cross-Origin Resource Sharing) Utility
 * 
 * Provides centralized CORS configuration with environment-aware domain validation.
 * Replaces wildcard CORS with secure, allowlist-based origin checking.
 */

import type { APIGatewayProxyResult, APIGatewayProxyEventV2 } from 'aws-lambda'

// Environment-specific allowed origins
const getAllowedOrigins = (): string[] => {
  const env = process.env.NODE_ENV || 'development'
  
  if (env === 'production') {
    return [
      'https://daylight.app',
      'https://www.daylight.app'
    ]
  }
  
  // Development/staging origins
  return [
    'http://localhost:3000',
    'http://localhost:5173', 
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ]
}

/**
 * Checks if the provided origin is allowed based on environment configuration
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return false
  
  const allowedOrigins = getAllowedOrigins()
  return allowedOrigins.includes(origin)
}

/**
 * Generates appropriate CORS headers based on the request origin
 */
export const getCorsHeaders = (origin: string | undefined) => {
  const baseHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Max-Age': '86400' // 24 hours preflight cache
  }

  if (isOriginAllowed(origin)) {
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin as string
    }
  }

  // For disallowed origins, don't include Access-Control-Allow-Origin header
  // This will cause the browser to block the request
  return baseHeaders
}

/**
 * Adds CORS headers to a Lambda response based on the request origin
 */
export const addCorsHeaders = (
  response: APIGatewayProxyResult,
  event: APIGatewayProxyEventV2
): APIGatewayProxyResult => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  return {
    ...response,
    headers: {
      ...response.headers,
      ...corsHeaders
    }
  }
}

/**
 * Creates a preflight OPTIONS response with appropriate CORS headers
 */
export const createOptionsResponse = (event: APIGatewayProxyEventV2): APIGatewayProxyResult => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  return {
    statusCode: 204,
    headers: corsHeaders,
    body: ''
  }
}
