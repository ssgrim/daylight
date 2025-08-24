import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { initSentry, withSentry, captureMessage } from '../lib/sentry.js'

// Initialize Sentry
initSentry()

const rateLimitHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const timestamp = new Date().toISOString()
  const ip = event.requestContext.http.sourceIp
  const userAgent = event.headers['user-agent'] || 'unknown'
  
  // Log rate limit hit for monitoring
  captureMessage('Rate limit exceeded', 'warning', {
    ip,
    userAgent,
    path: event.requestContext.http.path,
    method: event.requestContext.http.method,
    timestamp
  })
  
  return {
    statusCode: 429,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Retry-After': '300', // Suggest retry after 5 minutes
      'X-RateLimit-Limit': '2000',
      'X-RateLimit-Window': '300'
    },
    body: JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: 300,
      timestamp,
      type: 'rate_limit_exceeded'
    })
  }
}

export const handler = withSentry(rateLimitHandler)
