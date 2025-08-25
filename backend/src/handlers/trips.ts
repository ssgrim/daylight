/**
 * Trips Handler with JWT Authentication
 * 
 * Handles trip-related operations with user authentication and authorization
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda'
import { withAuth, AuthenticatedEvent, getCurrentUser, getUserId, createAuthenticatedResponse } from '../lib/auth.js'

/**
 * Main trips handler with authentication
 */
const tripsHandler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method
  const user = getCurrentUser(event)
  const userId = getUserId(event)

  console.log(`Trips ${method} request from user: ${userId}`)

  try {
    switch (method) {
      case 'GET':
        return await handleGetTrips(event)
      case 'POST':
        return await handleCreateTrip(event)
      case 'PUT':
        return await handleUpdateTrip(event)
      case 'DELETE':
        return await handleDeleteTrip(event)
      default:
        return createAuthenticatedResponse(405, {
          error: 'Method not allowed',
          message: `${method} method is not supported`
        })
    }
  } catch (error) {
    console.error('Trips handler error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Internal server error',
      message: 'Failed to process trip request'
    })
  }
}

/**
 * Get trips for the authenticated user
 */
async function handleGetTrips(event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event)!
  const queryParams = event.queryStringParameters || {}
  
  // Extract query parameters
  const limit = parseInt(queryParams.limit || '10')
  const offset = parseInt(queryParams.offset || '0')
  const status = queryParams.status // active, completed, cancelled
  const startDate = queryParams.startDate
  const endDate = queryParams.endDate

  try {
    // TODO: Implement actual DynamoDB query for user trips
    // This would query trips by user ID with optional filters
    const mockTrips = [
      {
        tripId: `trip-${userId}-1`,
        userId,
        title: 'Morning Commute',
        startLocation: { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
        endLocation: { lat: 37.7849, lng: -122.4094, name: 'Downtown SF' },
        status: 'completed',
        startTime: '2025-08-24T08:00:00Z',
        endTime: '2025-08-24T08:30:00Z',
        distance: 2.5,
        duration: 30,
        score: 85,
        createdAt: '2025-08-24T07:55:00Z',
        updatedAt: '2025-08-24T08:30:00Z'
      }
    ]

    const response = {
      trips: mockTrips,
      pagination: {
        limit,
        offset,
        total: mockTrips.length,
        hasMore: false
      },
      filters: {
        status,
        startDate,
        endDate
      }
    }

    return createAuthenticatedResponse(200, response)

  } catch (error) {
    console.error('Get trips error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to retrieve trips',
      message: 'Database query failed'
    })
  }
}

/**
 * Create a new trip for the authenticated user
 */
async function handleCreateTrip(event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event)!
  
  try {
    const body = JSON.parse(event.body || '{}')
    
    // Validate required fields
    const requiredFields = ['title', 'startLocation', 'endLocation']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: `Missing required fields: ${missingFields.join(', ')}`
      })
    }

    // Generate trip ID
    const tripId = `trip-${userId}-${Date.now()}`
    const now = new Date().toISOString()

    // Create trip object
    const trip = {
      tripId,
      userId,
      title: body.title,
      description: body.description || '',
      startLocation: body.startLocation,
      endLocation: body.endLocation,
      status: 'planned',
      plannedStartTime: body.plannedStartTime || now,
      preferences: body.preferences || {},
      createdAt: now,
      updatedAt: now
    }

    // TODO: Save to DynamoDB
    console.log('Creating trip:', trip)

    return createAuthenticatedResponse(201, {
      success: true,
      trip,
      message: 'Trip created successfully'
    })

  } catch (error) {
    console.error('Create trip error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to create trip',
      message: 'Database operation failed'
    })
  }
}

/**
 * Update an existing trip for the authenticated user
 */
async function handleUpdateTrip(event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event)!
  const tripId = event.pathParameters?.tripId

  if (!tripId) {
    return createAuthenticatedResponse(400, {
      error: 'Missing trip ID',
      message: 'Trip ID is required in the path'
    })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    
    // TODO: Verify trip ownership (trip belongs to authenticated user)
    // TODO: Update trip in DynamoDB
    
    const updatedTrip = {
      tripId,
      userId,
      ...body,
      updatedAt: new Date().toISOString()
    }

    console.log('Updating trip:', updatedTrip)

    return createAuthenticatedResponse(200, {
      success: true,
      trip: updatedTrip,
      message: 'Trip updated successfully'
    })

  } catch (error) {
    console.error('Update trip error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to update trip',
      message: 'Database operation failed'
    })
  }
}

/**
 * Delete a trip for the authenticated user
 */
async function handleDeleteTrip(event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event)!
  const tripId = event.pathParameters?.tripId

  if (!tripId) {
    return createAuthenticatedResponse(400, {
      error: 'Missing trip ID',
      message: 'Trip ID is required in the path'
    })
  }

  try {
    // TODO: Verify trip ownership (trip belongs to authenticated user)
    // TODO: Delete trip from DynamoDB
    
    console.log(`Deleting trip ${tripId} for user ${userId}`)

    return createAuthenticatedResponse(200, {
      success: true,
      tripId,
      message: 'Trip deleted successfully'
    })

  } catch (error) {
    console.error('Delete trip error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to delete trip',
      message: 'Database operation failed'
    })
  }
}

// Export the handler wrapped with authentication middleware
export const handler = withAuth(tripsHandler, {
  required: true, // Authentication is required
  requiredGroups: [], // No specific groups required
  requiredScopes: [] // No specific scopes required
})
