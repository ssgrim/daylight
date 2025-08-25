import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { 
  TripCreateSchema, 
  TripUpdateSchema, 
  TripIdParamSchema,
  TripSchema 
} from '../lib/validation'
import { 
  withValidation, 
  createSuccessResponse, 
  createErrorResponse,
  ValidationError 
} from '../lib/middleware'

// In-memory storage for demo purposes
// In production, this would be replaced with DynamoDB operations
const tripsStore = new Map<string, any>()

// GET /trips/{tripId} - Get a specific trip
const getTripHandler = withValidation(
  async (event, body, query, params) => {
    const { tripId } = params as { tripId: string }
    
    const trip = tripsStore.get(tripId)
    if (!trip) {
      return createErrorResponse(
        'NOT_FOUND',
        `Trip with ID '${tripId}' not found`,
        404,
        event.requestContext.http.path
      )
    }

    // Validate response data
    const validatedTrip = TripSchema.parse(trip)
    return createSuccessResponse(validatedTrip)
  },
  {
    paramsSchema: TripIdParamSchema,
    requireAuth: true
  }
)

// POST /trips - Create a new trip
const createTripHandler = withValidation(
  async (event, body, query, params) => {
    const tripData = body as any
    
    // Check if trip already exists
    if (tripsStore.has(tripData.tripId)) {
      return createErrorResponse(
        'CONFLICT',
        `Trip with ID '${tripData.tripId}' already exists`,
        409,
        event.requestContext.http.path
      )
    }

    // Create trip with timestamp
    const newTrip = {
      ...tripData,
      createdAt: new Date().toISOString()
    }

    // Validate the complete trip object
    const validatedTrip = TripSchema.parse(newTrip)
    
    // Store the trip
    tripsStore.set(tripData.tripId, validatedTrip)

    return createSuccessResponse(validatedTrip, 201)
  },
  {
    bodySchema: TripCreateSchema,
    requireAuth: true
  }
)

// PUT /trips/{tripId} - Update an existing trip
const updateTripHandler = withValidation(
  async (event, body, query, params) => {
    const { tripId } = params as { tripId: string }
    const updateData = body as any

    const existingTrip = tripsStore.get(tripId)
    if (!existingTrip) {
      return createErrorResponse(
        'NOT_FOUND',
        `Trip with ID '${tripId}' not found`,
        404,
        event.requestContext.http.path
      )
    }

    // Merge existing trip with updates
    const updatedTrip = {
      ...existingTrip,
      ...updateData,
      tripId, // Ensure tripId cannot be changed
      createdAt: existingTrip.createdAt // Preserve creation timestamp
    }

    // Validate the updated trip
    const validatedTrip = TripSchema.parse(updatedTrip)
    
    // Store the updated trip
    tripsStore.set(tripId, validatedTrip)

    return createSuccessResponse(validatedTrip)
  },
  {
    bodySchema: TripUpdateSchema,
    paramsSchema: TripIdParamSchema,
    requireAuth: true
  }
)

// DELETE /trips/{tripId} - Delete a trip
const deleteTripHandler = withValidation(
  async (event, body, query, params) => {
    const { tripId } = params as { tripId: string }
    
    if (!tripsStore.has(tripId)) {
      return createErrorResponse(
        'NOT_FOUND',
        `Trip with ID '${tripId}' not found`,
        404,
        event.requestContext.http.path
      )
    }

    tripsStore.delete(tripId)

    return createSuccessResponse({ 
      message: `Trip '${tripId}' deleted successfully`,
      tripId 
    })
  },
  {
    paramsSchema: TripIdParamSchema,
    requireAuth: true
  }
)

// Main handler that routes to appropriate sub-handlers
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method
  const path = event.requestContext.http.path
  
  try {
    switch (method) {
      case 'GET':
        if (path.includes('/trips/')) {
          return await getTripHandler(event)
        }
        break
        
      case 'POST':
        if (path === '/trips' || path.endsWith('/trips')) {
          return await createTripHandler(event)
        }
        break
        
      case 'PUT':
        if (path.includes('/trips/')) {
          return await updateTripHandler(event)
        }
        break
        
      case 'DELETE':
        if (path.includes('/trips/')) {
          return await deleteTripHandler(event)
        }
        break
        
      case 'OPTIONS':
        return {
          statusCode: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Max-Age': '86400'
          }
        }
        
      default:
        return createErrorResponse(
          'METHOD_NOT_ALLOWED',
          `Method ${method} not allowed`,
          405,
          path
        )
    }
    
    return createErrorResponse(
      'NOT_FOUND',
      `Endpoint not found: ${method} ${path}`,
      404,
      path
    )
    
  } catch (error) {
    console.error('Trips handler error:', error)
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error',
      500,
      path
    )
  }
}
