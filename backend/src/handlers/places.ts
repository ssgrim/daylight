/**
 * Updated Places Lambda Handler using Pluggable Provider System
 * 
 * This handler replaces the original places.js with a provider-based approach
 * that supports multiple place search providers with runtime switching.
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { initializeProvidersFromEnv } from '../providers/factory.js';
import { createPlacesServiceFromEnv } from '../lib/places-service.js';
import { ProviderError } from '../providers/interfaces.js';

// Import validation utilities
const { validateQuery, validateWith } = require('../lib/validation.cjs');

// Global service instance
let placesService: ReturnType<typeof createPlacesServiceFromEnv> | null = null;
let initialized = false;

/**
 * Initialize providers and service on first request
 */
async function ensureInitialized(): Promise<void> {
  if (initialized && placesService) {
    return;
  }

  try {
    console.log('[PlacesHandler] Initializing providers...');
    await initializeProvidersFromEnv();
    
    console.log('[PlacesHandler] Creating places service...');
    placesService = createPlacesServiceFromEnv();
    
    initialized = true;
    console.log('[PlacesHandler] Initialization complete');
  } catch (error) {
    console.error('[PlacesHandler] Initialization failed:', error);
    throw error;
  }
}

/**
 * Main Lambda handler for place search requests
 */
const placesHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Initialize on first request (cold start)
    await ensureInitialized();

    // Handle OPTIONS request for CORS
    if (event.requestContext.http.method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Max-Age': '86400'
        }
      };
    }

    // Validate query parameter
    const queryParam = event.queryStringParameters?.query || '';
    const validation = validateWith(() => validateQuery(queryParam));
    
    if (!validation.success) {
      return validation.response;
    }

    const query = validation.data;

    // Extract additional search parameters
    const searchParams = {
      query,
      location: extractLocationFromParams(event.queryStringParameters),
      radius: extractRadiusFromParams(event.queryStringParameters),
      limit: extractLimitFromParams(event.queryStringParameters),
      offset: extractOffsetFromParams(event.queryStringParameters),
      sort: extractSortFromParams(event.queryStringParameters),
      category: extractCategoryFromParams(event.queryStringParameters),
      language: event.queryStringParameters?.language,
      extra: extractExtraParams(event.queryStringParameters)
    };

    // Perform search using the places service
    console.log(`[PlacesHandler] Searching for: ${query}`);
    const result = await placesService!.searchPlaces(searchParams);

    // Return response with appropriate headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        ...result.headers
      },
      body: JSON.stringify(result.data)
    };

  } catch (error) {
    console.error('[PlacesHandler] Error:', error);

    // Handle ProviderError with appropriate status codes
    if (error instanceof ProviderError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'X-Provider-Error': error.provider,
          'X-Error-Type': error.type
        },
        body: JSON.stringify({
          error: error.message,
          type: error.type,
          provider: error.provider,
          retryable: error.retryable
        })
      };
    }

    // Handle other errors
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        type: 'internal_error'
      })
    };
  }
};

/**
 * Health check handler for provider monitoring
 */
export const healthHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    await ensureInitialized();
    
    const healthStatus = await placesService!.getHealthStatus();
    
    return {
      statusCode: healthStatus.healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(healthStatus)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Extract location from query parameters
 */
function extractLocationFromParams(params: Record<string, string | undefined> | undefined) {
  if (!params?.lat || !params?.lng) {
    return undefined;
  }

  const lat = parseFloat(params.lat);
  const lng = parseFloat(params.lng);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }

  return { lat, lng };
}

/**
 * Extract radius from query parameters
 */
function extractRadiusFromParams(params: Record<string, string | undefined> | undefined): number | undefined {
  if (!params?.radius) {
    return undefined;
  }

  const radius = parseInt(params.radius);
  return isNaN(radius) || radius <= 0 ? undefined : radius;
}

/**
 * Extract limit from query parameters
 */
function extractLimitFromParams(params: Record<string, string | undefined> | undefined): number | undefined {
  if (!params?.limit && !params?.pageSize) {
    return undefined;
  }

  const limit = parseInt(params.limit || params.pageSize || '20');
  return isNaN(limit) || limit <= 0 ? 20 : Math.min(limit, 50); // Cap at 50, default 20
}

/**
 * Extract offset from query parameters (for pagination)
 */
function extractOffsetFromParams(params: Record<string, string | undefined> | undefined): number | undefined {
  if (!params?.page && !params?.offset) {
    return undefined;
  }

  // Support both page-based and offset-based pagination
  if (params.page) {
    const page = parseInt(params.page);
    if (isNaN(page) || page <= 0) return 0;
    const pageSize = extractLimitFromParams(params) || 20;
    return (page - 1) * pageSize;
  }

  const offset = parseInt(params.offset || '0');
  return isNaN(offset) || offset < 0 ? 0 : offset;
}

/**
 * Extract sort option from query parameters
 */
function extractSortFromParams(params: Record<string, string | undefined> | undefined): 'relevance' | 'rating' | 'distance' | 'name' | undefined {
  if (!params?.sort) {
    return undefined;
  }

  const validSorts = ['relevance', 'rating', 'distance', 'name'] as const;
  const sort = params.sort.toLowerCase();
  
  return validSorts.includes(sort as any) ? sort as any : undefined;
}

/**
 * Extract category filter from query parameters
 */
function extractCategoryFromParams(params: Record<string, string | undefined> | undefined): string | undefined {
  if (!params?.category) {
    return undefined;
  }

  const validCategories = [
    'restaurant', 'cafe', 'bar', 'hotel', 'attraction', 
    'shopping', 'entertainment', 'transportation', 'health', 'services', 'other'
  ];
  
  const category = params.category.toLowerCase();
  return validCategories.includes(category) ? category : undefined;
}

/**
 * Extract provider-specific extra parameters
 */
function extractExtraParams(params: Record<string, string | undefined> | undefined): Record<string, any> | undefined {
  if (!params) {
    return undefined;
  }

  const extra: Record<string, any> = {};
  
  // Google Places specific parameters
  if (params.type) extra.type = params.type;
  if (params.opennow) extra.opennow = params.opennow === 'true';
  if (params.minprice) extra.minprice = parseInt(params.minprice);
  if (params.maxprice) extra.maxprice = parseInt(params.maxprice);

  return Object.keys(extra).length > 0 ? extra : undefined;
}

// Export the main handler
export const handler = placesHandler;
