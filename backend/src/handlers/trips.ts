import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { authenticateUser, hasPermission, AuthResponses } from '../lib/auth.js'
import { ddb, TABLE } from '../lib/dynamo.js'
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { info, error } from '../lib/logger.mjs'

interface Trip {
  tripId: string
  userId: string  // Owner of the trip
  name: string
  startsAt: string
  endsAt: string
  anchors?: any[]
  createdAt: string
  updatedAt: string
  sharedWith?: string[] // Array of user IDs who have access
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext?.requestId || 'unknown'
  
  try {
    // Authenticate user for all operations
    const user = await authenticateUser(event)
    info({ requestId, userId: user.userId }, `${event.requestContext.http.method} /trips`, { role: user.role })

    const method = event.requestContext.http.method
    const tripId = event.pathParameters?.tripId

    switch (method) {
      case 'POST':
        return await createTrip(event, user, requestId)
      case 'GET':
        if (tripId) {
          return await getTrip(tripId, user, requestId)
        } else {
          return await listUserTrips(user, requestId)
        }
      case 'PUT':
        if (!tripId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Trip ID required' }) }
        }
        return await updateTrip(tripId, event, user, requestId)
      case 'DELETE':
        if (!tripId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Trip ID required' }) }
        }
        return await deleteTrip(tripId, user, requestId)
      default:
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }
  } catch (err: any) {
    error({ requestId }, 'Trip handler error:', err.message)
    
    // Return appropriate auth error
    if (err.message.includes('Authentication failed') || err.message.includes('No authorization token')) {
      return AuthResponses.unauthorized(err.message)
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

async function createTrip(event: any, user: any, requestId: string) {
  // Any authenticated user can create trips (viewer+ permission)
  if (!hasPermission(user.role, 'viewer')) {
    return AuthResponses.forbidden()
  }

  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Request body required' }) }
  }

  let tripData: any
  try {
    tripData = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const tripId = tripData.tripId || `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  const trip: Trip = {
    tripId,
    userId: user.userId, // Set the creator as owner
    name: tripData.name || 'Untitled Trip',
    startsAt: tripData.startsAt || now,
    endsAt: tripData.endsAt || now,
    anchors: tripData.anchors || [],
    createdAt: now,
    updatedAt: now
  }

  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `TRIP#${tripId}`,
        sk: 'META',
        ...trip
      }
    }))

    info({ requestId, userId: user.userId }, 'Trip created', { tripId })
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, message: 'Trip created successfully' })
    }
  } catch (err: any) {
    error({ requestId }, 'Failed to create trip:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create trip' })
    }
  }
}

async function getTrip(tripId: string, user: any, requestId: string) {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `TRIP#${tripId}`, sk: 'META' }
    }))

    if (!result.Item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Trip not found' }) }
    }

    const trip = result.Item as any
    
    // Check if user has access to this trip
    const hasAccess = trip.userId === user.userId || // Owner
                     trip.sharedWith?.includes(user.userId) || // Shared with user
                     user.role === 'owner' // Admin access

    if (!hasAccess) {
      return AuthResponses.forbidden('Access denied to this trip')
    }

    // Remove internal fields
    const { pk, sk, ...cleanTrip } = trip
    
    info({ requestId, userId: user.userId }, 'Trip retrieved', { tripId })
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanTrip)
    }
  } catch (err: any) {
    error({ requestId }, 'Failed to get trip:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to retrieve trip' })
    }
  }
}

async function listUserTrips(user: any, requestId: string) {
  // For now, return a placeholder. In a full implementation, you'd query by GSI on userId
  info({ requestId, userId: user.userId }, 'List user trips requested')
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      trips: [],
      message: 'Trip listing requires GSI implementation',
      userId: user.userId,
      role: user.role
    })
  }
}

async function updateTrip(tripId: string, event: any, user: any, requestId: string) {
  // Need editor+ permission
  if (!hasPermission(user.role, 'editor')) {
    return AuthResponses.forbidden('Editor permission required')
  }

  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Request body required' }) }
  }

  let updateData: any
  try {
    updateData = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  try {
    // First check if trip exists and user has access
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `TRIP#${tripId}`, sk: 'META' }
    }))

    if (!existing.Item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Trip not found' }) }
    }

    const trip = existing.Item as any
    const hasAccess = trip.userId === user.userId || // Owner
                     trip.sharedWith?.includes(user.userId) || // Shared with user  
                     user.role === 'owner' // Admin access

    if (!hasAccess) {
      return AuthResponses.forbidden('Access denied to this trip')
    }

    // Update the trip
    const updatedTrip = {
      ...trip,
      ...updateData,
      updatedAt: new Date().toISOString(),
      tripId, // Ensure tripId cannot be changed
      userId: trip.userId // Ensure owner cannot be changed
    }

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: updatedTrip
    }))

    const { pk, sk, ...cleanTrip } = updatedTrip
    
    info({ requestId, userId: user.userId }, 'Trip updated', { tripId })
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanTrip)
    }
  } catch (err: any) {
    error({ requestId }, 'Failed to update trip:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update trip' })
    }
  }
}

async function deleteTrip(tripId: string, user: any, requestId: string) {
  // Need owner permission to delete
  if (!hasPermission(user.role, 'owner')) {
    return AuthResponses.forbidden('Owner permission required')
  }

  try {
    // Check if trip exists and user has access
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `TRIP#${tripId}`, sk: 'META' }
    }))

    if (!existing.Item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Trip not found' }) }
    }

    const trip = existing.Item as any
    const hasAccess = trip.userId === user.userId || user.role === 'owner' // Only owner or admin

    if (!hasAccess) {
      return AuthResponses.forbidden('Only trip owner can delete')
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pk: `TRIP#${tripId}`, sk: 'META' }
    }))

    info({ requestId, userId: user.userId }, 'Trip deleted', { tripId })
    
    return {
      statusCode: 204,
      headers: { 'Content-Type': 'application/json' },
      body: ''
    }
  } catch (err: any) {
    error({ requestId }, 'Failed to delete trip:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete trip' })
    }
  }
}
