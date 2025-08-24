import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { initSentry, withSentry } from '../lib/sentry.js'
import { addCorsHeaders } from '../lib/cors.js'

// Initialize Sentry (will only initialize if DSN is configured)
initSentry()

/**
 * Health check endpoint for monitoring and load balancer health checks.
 * This endpoint is intentionally exempt from Places API calls and external dependencies
 * to provide a reliable liveness check.
 */
const healthHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const timestamp = new Date().toISOString()
  const origin = event.headers?.origin || event.headers?.Origin
  
  return {
    statusCode: 200,
    headers: addCorsHeaders({
      'content-type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }, origin),
    body: JSON.stringify({
      ok: true,
      ts: timestamp
    })
  }
}

// Export the handler wrapped with Sentry error tracking
export const handler = withSentry(healthHandler)
