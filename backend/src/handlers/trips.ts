import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { authenticateUser, hasPermission, AuthResponses } from '../lib/auth.js'
import { ddb, TABLE } from '../lib/dynamo.js'
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { info, error } from '../lib/logger.mjs'
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import { Filter } from 'bad-words';

const cache = new NodeCache({ stdTTL: 3600 }); // Cache TTL: 1 hour
const filter = new Filter();

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
        if (tripId && event.queryStringParameters?.shareable) {
          return await generateShareableLink(tripId, user, requestId);
        }
        return await createTrip(event, user, requestId)
      case 'GET':
        if (tripId && event.queryStringParameters?.printable) {
          return await generatePrintableTrip(tripId, user, requestId);
        }
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

async function generatePrintableTrip(tripId: string, user: any, requestId: string) {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `TRIP#${tripId}`, sk: 'META' }
    }));

    if (!result.Item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Trip not found' }) };
    }

    const trip = result.Item as any;

    // Check if user has access to this trip
    const hasAccess = trip.userId === user.userId ||
                     trip.sharedWith?.includes(user.userId) ||
                     user.role === 'owner';

    if (!hasAccess) {
      return AuthResponses.forbidden('Access denied to this trip');
    }

    // Generate printable summary
    const printableSummary = `Trip: ${trip.name}\nStarts: ${trip.startsAt}\nEnds: ${trip.endsAt}\nAnchors: ${trip.anchors?.map((a: any) => a.name).join(', ')}`;

    info({ requestId, userId: user.userId }, 'Printable trip generated', { tripId });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: printableSummary
    };
  } catch (err: any) {
    error({ requestId }, 'Failed to generate printable trip:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate printable trip' })
    };
  }
}

async function generateShareableLink(tripId: string, user: any, requestId: string) {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `TRIP#${tripId}`, sk: 'META' }
    }));

    if (!result.Item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Trip not found' }) };
    }

    const trip = result.Item as any;

    // Check if user has access to this trip
    const hasAccess = trip.userId === user.userId ||
                     trip.sharedWith?.includes(user.userId) ||
                     user.role === 'owner';

    if (!hasAccess) {
      return AuthResponses.forbidden('Access denied to this trip');
    }

    // Generate a shareable link (mock implementation)
    const shareableLink = `https://daylight.example.com/trips/${tripId}/share`;

    info({ requestId, userId: user.userId }, 'Shareable link generated', { tripId });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareableLink })
    };
  } catch (err: any) {
    error({ requestId }, 'Failed to generate shareable link:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate shareable link' })
    };
  }
}

// Handler for POI discovery
export async function getPOIDiscovery(req, res) {
  const { lat, lon, radius } = req.query;
  const cacheKey = `poi_${lat}_${lon}_${radius}`;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'Missing required query parameters: lat, lon, radius' });
  }

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  const apiKey = process.env.POI_API_KEY;
  const apiUrl = `https://api.open-meteo.com/v1/poi?latitude=${lat}&longitude=${lon}&radius=${radius}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    cache.set(cacheKey, data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching POI data:', error);
    return res.status(500).json({ error: 'Failed to fetch POI data' });
  }
}

// Handler for Air Quality Data
export async function getAirQuality(req, res) {
  const { lat, lon } = req.query;
  const cacheKey = `air_quality_${lat}_${lon}`;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing required query parameters: lat, lon' });
  }

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  const apiKey = process.env.AIR_QUALITY_API_KEY;
  const apiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    cache.set(cacheKey, data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching air quality data:', error);
    return res.status(500).json({ error: 'Failed to fetch air quality data' });
  }
}

// Handler for Wildfire Alerts
export async function getWildfireAlerts(req, res) {
  const { lat, lon } = req.query;
  const cacheKey = `wildfire_alerts_${lat}_${lon}`;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing required query parameters: lat, lon' });
  }

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  const apiKey = process.env.WILDFIRE_API_KEY;
  const apiUrl = `https://api.nasa.gov/firms/wildfire?latitude=${lat}&longitude=${lon}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    cache.set(cacheKey, data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching wildfire alerts:', error);
    return res.status(500).json({ error: 'Failed to fetch wildfire alerts' });
  }
}

// Handler for content filtering
export async function filterContent(req, res) {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Missing required field: content' });
  }

  const isClean = !filter.isProfane(content);

  return res.status(200).json({
    content,
    isClean,
    message: isClean ? 'Content is clean' : 'Content contains inappropriate language',
  });
}

// Handler for reporting inappropriate content
export async function reportContent(req, res) {
  const { contentId, reason } = req.body;

  if (!contentId || !reason) {
    return res.status(400).json({ error: 'Missing required fields: contentId, reason' });
  }

  try {
    // Simulate storing the report (replace with actual database logic)
    console.log(`Content reported: ID=${contentId}, Reason=${reason}`);

    return res.status(200).json({
      message: 'Content report submitted successfully',
      contentId,
      reason,
    });
  } catch (error) {
    console.error('Error reporting content:', error);
    return res.status(500).json({ error: 'Failed to submit content report' });
  }
}
