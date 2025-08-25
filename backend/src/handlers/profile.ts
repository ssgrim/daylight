import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ddb, TABLE } from '../lib/userDb';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { UserProfile, UserPreferences, PrivacySettings, SavedLocation, TripHistory, UserStats, UpdateProfileRequest, SaveLocationRequest, ProfileResponse } from '../../../shared/src/types/user';
import { info, error } from '../lib/logger.mjs';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const { requestContext, pathParameters, body, headers } = event;
    const method = requestContext.http.method;
    const path = requestContext.http.path;

    // Extract user ID from headers or use demo user for development
    const authHeader = headers?.authorization || headers?.Authorization;
    let userId = 'demo-user';
    
    // In production, this would extract from JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // For now, use a demo user ID
      // TODO: Implement proper JWT token validation with Cognito
      userId = 'demo-user';
    }
    
    // For development, allow demo user
    if (userId === 'demo-user') {
      // Allow demo user for development/testing
    } else if (userId === 'anonymous') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Route handling
    if (method === 'GET' && path === '/profile') {
      return await getProfile(userId);
    }
    
    if (method === 'PUT' && path === '/profile') {
      const updateData: UpdateProfileRequest = JSON.parse(body || '{}');
      return await updateProfile(userId, updateData);
    }
    
    if (method === 'POST' && path === '/profile') {
      const profileData = JSON.parse(body || '{}');
      return await createProfile(userId, profileData);
    }
    
    if (method === 'GET' && path === '/profile/locations') {
      return await getLocations(userId);
    }
    
    if (method === 'POST' && path === '/profile/locations') {
      const locationData: SaveLocationRequest = JSON.parse(body || '{}');
      return await saveLocation(userId, locationData);
    }
    
    if (method === 'DELETE' && path.startsWith('/profile/locations/')) {
      const locationId = pathParameters?.locationId;
      if (!locationId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Location ID required' }) };
      }
      return await deleteLocation(userId, locationId);
    }
    
    if (method === 'GET' && path === '/profile/trips') {
      return await getTripHistory(userId);
    }
    
    if (method === 'POST' && path === '/profile/trips') {
      const tripData = JSON.parse(body || '{}');
      return await saveTripHistory(userId, tripData);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (err: any) {
    error('Profile handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function getProfile(userId: string) {
  try {
    const [profileResult, statsResult] = await Promise.all([
      ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: `USER#${userId}`, sk: 'PROFILE' }
      })),
      ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: `USER#${userId}`, sk: 'STATS' }
      }))
    ]);

    if (!profileResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Profile not found' })
      };
    }

    const profile = profileResult.Item as UserProfile;
    const stats = statsResult.Item as UserStats || getDefaultStats();

    const response: ProfileResponse = { profile, stats };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    error('Get profile error:', err);
    throw err;
  }
}

async function createProfile(userId: string, profileData: Partial<UserProfile>) {
  try {
    const now = new Date().toISOString();
    
    const profile: UserProfile = {
      userId,
      email: profileData.email || '',
      displayName: profileData.displayName,
      avatar: profileData.avatar,
      createdAt: now,
      updatedAt: now,
      preferences: profileData.preferences || getDefaultPreferences(),
      privacySettings: profileData.privacySettings || getDefaultPrivacySettings()
    };

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${userId}`,
        sk: 'PROFILE',
        ...profile
      }
    }));

    // Initialize stats
    const stats = getDefaultStats();
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${userId}`,
        sk: 'STATS',
        ...stats
      }
    }));

    const response: ProfileResponse = { profile, stats };

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    error('Create profile error:', err);
    throw err;
  }
}

async function updateProfile(userId: string, updateData: UpdateProfileRequest) {
  try {
    const now = new Date().toISOString();
    
    const updateExpression = [];
    const expressionAttributeNames: any = {};
    const expressionAttributeValues: any = {};

    if (updateData.displayName !== undefined) {
      updateExpression.push('#displayName = :displayName');
      expressionAttributeNames['#displayName'] = 'displayName';
      expressionAttributeValues[':displayName'] = updateData.displayName;
    }

    if (updateData.avatar !== undefined) {
      updateExpression.push('#avatar = :avatar');
      expressionAttributeNames['#avatar'] = 'avatar';
      expressionAttributeValues[':avatar'] = updateData.avatar;
    }

    if (updateData.preferences) {
      updateExpression.push('#preferences = :preferences');
      expressionAttributeNames['#preferences'] = 'preferences';
      expressionAttributeValues[':preferences'] = updateData.preferences;
    }

    if (updateData.privacySettings) {
      updateExpression.push('#privacySettings = :privacySettings');
      expressionAttributeNames['#privacySettings'] = 'privacySettings';
      expressionAttributeValues[':privacySettings'] = updateData.privacySettings;
    }

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));

    return await getProfile(userId);
  } catch (err) {
    error('Update profile error:', err);
    throw err;
  }
}

async function getLocations(userId: string) {
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'LOCATION#'
      }
    }));

    const locations = result.Items?.map(item => ({
      id: item.sk.replace('LOCATION#', ''),
      userId: item.userId,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      address: item.address,
      type: item.type,
      notes: item.notes,
      tags: item.tags,
      createdAt: item.createdAt,
      visitedAt: item.visitedAt
    })) || [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations })
    };
  } catch (err) {
    error('Get locations error:', err);
    throw err;
  }
}

async function saveLocation(userId: string, locationData: SaveLocationRequest) {
  try {
    const locationId = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const location: SavedLocation = {
      id: locationId,
      userId,
      name: locationData.name,
      lat: locationData.lat,
      lng: locationData.lng,
      address: locationData.address,
      type: locationData.type,
      notes: locationData.notes,
      tags: locationData.tags || [],
      createdAt: now
    };

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${userId}`,
        sk: `LOCATION#${locationId}`,
        ...location
      }
    }));

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location })
    };
  } catch (err) {
    error('Save location error:', err);
    throw err;
  }
}

async function deleteLocation(userId: string, locationId: string) {
  try {
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `LOCATION#${locationId}`
      }
    }));

    return {
      statusCode: 204,
      headers: { 'Content-Type': 'application/json' },
      body: ''
    };
  } catch (err) {
    error('Delete location error:', err);
    throw err;
  }
}

async function getTripHistory(userId: string) {
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TRIP#'
      }
    }));

    const trips = result.Items?.map(item => ({
      id: item.sk.replace('TRIP#', ''),
      userId: item.userId,
      tripId: item.tripId,
      tripName: item.tripName,
      startDate: item.startDate,
      endDate: item.endDate,
      locations: item.locations,
      rating: item.rating,
      notes: item.notes,
      photos: item.photos,
      shared: item.shared,
      createdAt: item.createdAt
    })) || [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trips })
    };
  } catch (err) {
    error('Get trip history error:', err);
    throw err;
  }
}

async function saveTripHistory(userId: string, tripData: any) {
  try {
    const tripHistoryId = `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const trip: TripHistory = {
      id: tripHistoryId,
      userId,
      tripId: tripData.tripId,
      tripName: tripData.tripName,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      locations: tripData.locations || [],
      rating: tripData.rating,
      notes: tripData.notes,
      photos: tripData.photos || [],
      shared: tripData.shared || false,
      createdAt: now
    };

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${userId}`,
        sk: `TRIP#${tripHistoryId}`,
        ...trip
      }
    }));

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip })
    };
  } catch (err) {
    error('Save trip history error:', err);
    throw err;
  }
}

function getDefaultPreferences(): UserPreferences {
  return {
    travelStyle: 'mid-range',
    pace: 'moderate',
    groupSize: 'solo',
    accessibility: {},
    dietary: {},
    interests: {},
    timePreferences: {
      earliestStart: '09:00',
      latestEnd: '22:00',
      maxWalkingDistance: 1000, // 1km
      maxDrivingTime: 60 // 1 hour
    },
    weather: {
      minTemperature: 10,
      maxTemperature: 35,
      rainTolerance: 'light',
      windTolerance: 'moderate'
    },
    budget: {
      currency: 'USD',
      includeTransport: true,
      includeMeals: true,
      includeActivities: true
    }
  };
}

function getDefaultPrivacySettings(): PrivacySettings {
  return {
    shareProfile: false,
    shareTrips: false,
    shareLocation: false,
    sharePreferences: false,
    allowRecommendations: true,
    marketingEmails: false,
    analyticsTracking: true
  };
}

function getDefaultStats(): UserStats {
  return {
    totalTrips: 0,
    totalLocations: 0,
    favoriteCategories: [],
    averageRating: 0,
    milesExplored: 0,
    countriesVisited: 0,
    citiesVisited: 0
  };
}
