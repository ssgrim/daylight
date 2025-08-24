import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { initSentry, withSentry, captureError } from '../lib/sentry.js'

// Initialize Sentry
initSentry()

const tripsHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (event.requestContext.http.method === 'POST') {
      const body = JSON.parse(event.body || '{}')
      return { statusCode: 200, body: JSON.stringify({ ok: true, tripId: body.tripId || 'demo' }) }
    }
    return { statusCode: 405, body: 'Method Not Allowed' }
  } catch (error) {
    // Capture parsing errors or other issues
    captureError(error as Error, {
      event_method: event.requestContext.http.method,
      event_path: event.requestContext.http.path,
      request_body: event.body
    })
    
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

export const handler = withSentry(tripsHandler)
