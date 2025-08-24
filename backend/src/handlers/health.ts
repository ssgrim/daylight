import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { initSentry, withSentry } from '../lib/sentry.js'

// Initialize Sentry (will only initialize if DSN is configured)
initSentry()

/**
 * Health check endpoint for monitoring and load balancer health checks.
 * This endpoint is intentionally exempt from Places API calls and external dependencies
 * to provide a reliable liveness check.
 */
const healthHandler: APIGatewayProxyHandlerV2 = async () => {
  const timestamp = new Date().toISOString()
  
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({
      ok: true,
      ts: timestamp
    })
  }
}

// Export the handler wrapped with Sentry error tracking
export const handler = withSentry(healthHandler)
