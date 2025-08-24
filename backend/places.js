'use strict';

// AWS SDK v2 ships in Lambda Node 18
const AWS = require('aws-sdk');
const sm = new AWS.SecretsManager();

// Import hardened HTTP utilities, caching, and validation
const { timeoutFetch, retryWithBackoff, mapToApiError } = require('./src/lib/http-utils.cjs');
const { getCached, setCached, getCacheControlHeader } = require('./src/lib/cache-layer.cjs');
const { validateQuery, validateWith } = require('./src/lib/validation.cjs');

let CACHED_KEY = null;
async function getPlacesKey() {
  if (CACHED_KEY) return CACHED_KEY;
  const r = await sm.getSecretValue({ SecretId: 'daylight/dev/google-places-api-key' }).promise();
  CACHED_KEY = r.SecretString || '';
  return CACHED_KEY;
}

exports.handler = async (event) => {
  try {
    // Validate query parameter
    const queryParam = event?.queryStringParameters?.query || '';
    const validation = validateWith(() => validateQuery(queryParam));
    
    if (!validation.success) {
      return validation.response;
    }
    
    const q = validation.data;

    // Cache configuration
    const CACHE_TTL = 3600; // 1 hour for place searches
    const USE_DYNAMODB = process.env.ENABLE_CACHE_DDB === 'true';
    const cacheKey = `places:${q.toLowerCase().trim()}`;

    // Check cache first
    const cached = await getCached('places', cacheKey, {
      useDynamoDB: USE_DYNAMODB,
      tableName: process.env.CACHE_TABLE_NAME || 'daylight-cache'
    });

    if (cached) {
      console.log(`Returning cached result for query: ${q}`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Cache-Control': getCacheControlHeader(CACHE_TTL, false),
          'X-Cache': 'HIT'
        },
        body: JSON.stringify(cached)
      };
    }

    // Fetch from Google Places API
    const key = await getPlacesKey();
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', q);
    url.searchParams.set('key', key);

    console.log(`Fetching from Google Places API for query: ${q}`);

    // Hardened fetch: timeout <= 8s, 3x retry w/ jitter on 5xx/ENET, fast-fail on 4xx
    const res = await retryWithBackoff(
      () => timeoutFetch(url.toString(), { method: 'GET' }, 8000),
      3, // max attempts
      200 // base delay ms
    );

    // Check for non-ok responses after retry logic
    if (!res.ok) {
      const errorInfo = mapToApiError(res);
      console.error(`Google Places API error: ${res.status} ${res.statusText}`);
      return { 
        statusCode: errorInfo.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ 
          error: errorInfo.error,
          type: 'external_service_error'
        }) 
      };
    }

    const data = await res.json();

    // Shape the output according to schema
    const results = (data.results || []).slice(0, 20).map(r => ({
      name: r.name || 'Unknown',
      address: r.formatted_address || '',
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      place_id: r.place_id || '',
      location: r.geometry?.location ? {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng
      } : undefined
    }));

    const responseData = { 
      query: q, 
      count: results.length, 
      results 
    };

    // Cache the result
    await setCached('places', cacheKey, responseData, {
      ttlSeconds: CACHE_TTL,
      useDynamoDB: USE_DYNAMODB,
      tableName: process.env.CACHE_TABLE_NAME || 'daylight-cache'
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': getCacheControlHeader(CACHE_TTL, false),
        'X-Cache': 'MISS'
      },
      body: JSON.stringify(responseData)
    };
  } catch (err) {
    console.error('Google Places handler error:', err);
    
    // Map error to appropriate API response
    const errorInfo = mapToApiError(err);
    return { 
      statusCode: errorInfo.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ 
        error: errorInfo.error,
        type: 'internal_error'
      }) 
    };
  }
};
