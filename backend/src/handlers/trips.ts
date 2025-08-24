import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { initSentry, withSentry, captureError } from '../lib/sentry.js'
import { addCorsHeaders, handlePreflightRequest } from '../lib/cors.js'

// Initialize Sentry
initSentry()

const tripsHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  
  try {
    // Handle OPTIONS request for CORS
    if (event.requestContext.http.method === 'OPTIONS') {
      return handlePreflightRequest(event);
    }
    
    if (event.requestContext.http.method === 'POST') {
      const body = JSON.parse(event.body || '{}')
      return { 
        statusCode: 200, 
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        }, origin),
        body: JSON.stringify({ ok: true, tripId: body.tripId || 'demo' }) 
      }
    }
    
    if (event.requestContext.http.method === 'GET') {
      return {
        statusCode: 200,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        }, origin),
        body: JSON.stringify({ trips: [] }) // Placeholder - implement actual trip retrieval
      }
    }
    
    return { 
      statusCode: 405, 
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      }, origin),
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  } catch (error) {
    // Capture parsing errors or other issues
    captureError(error as Error, {
      event_method: event.requestContext.http.method,
      event_path: event.requestContext.http.path,
      request_body: event.body
    })
    
    return {
      statusCode: 500,
      headers: addCorsHeaders({ 
        'content-type': 'application/json' 
      }, origin),
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

export const handler = withSentry(tripsHandler)
