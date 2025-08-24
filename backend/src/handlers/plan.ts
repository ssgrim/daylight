import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { initSentry, withSentry, captureError, captureMessage } from '../lib/sentry.js'

// Import caching and validation utilities (ensure these are compiled to JS)
const { getCached, setCached, getCacheControlHeader } = require('../lib/cache-layer.cjs');
const { validateCoordinates, validateWith } = require('../lib/validation.cjs');

// Initialize Sentry
initSentry()

const planHandler: APIGatewayProxyHandlerV2 = async (event: any) => {
  const now = new Date().toISOString()
  
  try {
    // Extract and validate query parameters
    const q = event.queryStringParameters || {}
    const latParam = q.lat;
    const lngParam = q.lng;
    
    let coordinates: { lat: number; lng: number } | null = null;
    
    // Validate coordinates if provided
    if (latParam !== undefined || lngParam !== undefined) {
      const validation = validateWith(() => validateCoordinates(latParam, lngParam));
      
      if (!validation.success) {
        captureMessage('Invalid coordinates provided', 'warning', {
          lat: latParam,
          lng: lngParam,
          validation_error: validation.response
        })
        return validation.response;
      }
      
      coordinates = validation.data;
    }
    
    // Cache configuration
    const CACHE_TTL = 1800; // 30 minutes for plan results
    const USE_DYNAMODB = process.env.ENABLE_CACHE_DDB === 'true';
    
    // Generate cache key based on location
    let cacheKey = 'plan:default';
    if (coordinates) {
      // Round to ~100m precision for cache efficiency
      const roundedLat = Math.round(coordinates.lat * 1000) / 1000;
      const roundedLng = Math.round(coordinates.lng * 1000) / 1000;
      cacheKey = `plan:${roundedLat},${roundedLng}`;
    }

    // Check cache first
    const cached = await getCached('plan', cacheKey, {
      useDynamoDB: USE_DYNAMODB,
      tableName: process.env.CACHE_TABLE_NAME || 'daylight-cache'
    });

    if (cached) {
      console.log(`Returning cached plan result for: ${cacheKey}`);
      return {
        statusCode: 200,
        headers: { 
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Cache-Control': getCacheControlHeader(CACHE_TTL, false),
          'X-Cache': 'HIT'
        },
        body: JSON.stringify(cached)
      };
    }

    // Generate fresh result with proper schema shape
    const result = [{ 
      id: '1', 
      title: coordinates 
        ? `Demo Stop near ${coordinates.lat.toFixed(3)},${coordinates.lng.toFixed(3)}` 
        : 'Demo Stop',
      start: now, 
      end: now, 
      score: 95,
      location: coordinates || undefined
    }];

    // Cache the result
    await setCached('plan', cacheKey, result, {
      ttlSeconds: CACHE_TTL,
      useDynamoDB: USE_DYNAMODB,
      tableName: process.env.CACHE_TABLE_NAME || 'daylight-cache'
    });

    return {
      statusCode: 200,
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': getCacheControlHeader(CACHE_TTL, false),
        'X-Cache': 'MISS'
      },
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('Plan handler error:', err);
    
    // Capture detailed error information
    captureError(err as Error, {
      event_method: event.requestContext?.http?.method,
      event_path: event.requestContext?.http?.path,
      query_parameters: event.queryStringParameters,
      cache_enabled: process.env.ENABLE_CACHE_DDB,
      timestamp: now
    })
    
    return {
      statusCode: 500,
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        type: 'internal_error'
      })
    };
  }
}

export const handler = withSentry(planHandler)
