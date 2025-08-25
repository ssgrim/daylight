import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

// Input validation for trip data
function validateTripData(body: any): { tripId: string } {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a valid JSON object')
  }
  
  const { tripId } = body
  
  if (!tripId || typeof tripId !== 'string') {
    throw new Error('tripId is required and must be a string')
  }
  
  if (tripId.length < 1 || tripId.length > 100) {
    throw new Error('tripId must be between 1 and 100 characters')
  }
  
  // Basic sanitization - remove non-alphanumeric characters except dashes and underscores
  const sanitizedTripId = tripId.replace(/[^a-zA-Z0-9\-_]/g, '')
  if (sanitizedTripId.length === 0) {
    throw new Error('tripId contains invalid characters')
  }
  
  return { tripId: sanitizedTripId }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId
  
  try {
    if (event.requestContext.http.method === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Request body is required' })
        }
      }
      
      let body: any
      try {
        body = JSON.parse(event.body)
      } catch (e) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        }
      }
      
      const { tripId } = validateTripData(body)
      
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, tripId, requestId })
      }
    }
    
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: error.message || 'Invalid request',
        requestId 
      })
    }
  }
}
