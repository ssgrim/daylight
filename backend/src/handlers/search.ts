/**
 * Search Handler - API endpoint for search operations
 * Issue #112: Search Infrastructure & Geospatial Indexing
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { searchService, SearchQuery } from '../lib/searchService.js';

export interface SearchRequest {
  action: 'search' | 'suggest' | 'index' | 'delete' | 'analytics' | 'health';
  query?: SearchQuery;
  locations?: any[];
  locationId?: string;
  prefix?: string;
  limit?: number;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  console.log('Search handler invoked:', JSON.stringify(event, null, 2));

  try {
    // Initialize search index on first use
    await searchService.initializeIndex();

    const method = event.requestContext.http.method;
    const path = event.rawPath;

    // Parse request body for POST requests
    let requestBody: SearchRequest | null = null;
    if (method === 'POST' && event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          },
          body: JSON.stringify({
            error: 'Invalid JSON in request body',
            details: (error as Error).message,
          }),
        };
      }
    }

    // Parse query parameters for GET requests
    const queryParams = event.queryStringParameters || {};

    let result: any;

    // Route based on action or HTTP method/path
    const action = requestBody?.action || queryParams.action || 'search';

    switch (action) {
      case 'search':
        result = await handleSearch(requestBody, queryParams);
        break;

      case 'suggest':
        result = await handleSuggest(requestBody, queryParams);
        break;

      case 'index':
        if (method !== 'POST') {
          throw new Error('Index operation requires POST method');
        }
        result = await handleIndex(requestBody!);
        break;

      case 'delete':
        if (method !== 'POST') {
          throw new Error('Delete operation requires POST method');
        }
        result = await handleDelete(requestBody!);
        break;

      case 'analytics':
        result = await handleAnalytics();
        break;

      case 'health':
        result = await handleHealth();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Search handler error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

/**
 * Handle search requests
 */
async function handleSearch(
  requestBody: SearchRequest | null,
  queryParams: Record<string, string>
): Promise<any> {
  // Build search query from request body or query parameters
  const searchQuery: SearchQuery = requestBody?.query || {};

  // Override with query parameters if provided
  if (queryParams.q) {
    searchQuery.query = queryParams.q;
  }

  if (queryParams.lat && queryParams.lon) {
    searchQuery.location = {
      lat: parseFloat(queryParams.lat),
      lon: parseFloat(queryParams.lon),
      radius: queryParams.radius || '10km',
    };
  }

  if (queryParams.category) {
    searchQuery.filters = searchQuery.filters || {};
    searchQuery.filters.category = queryParams.category.split(',');
  }

  if (queryParams.tags) {
    searchQuery.filters = searchQuery.filters || {};
    searchQuery.filters.tags = queryParams.tags.split(',');
  }

  if (queryParams.rating_min || queryParams.rating_max) {
    searchQuery.filters = searchQuery.filters || {};
    searchQuery.filters.rating = {};
    if (queryParams.rating_min) {
      searchQuery.filters.rating.min = parseFloat(queryParams.rating_min);
    }
    if (queryParams.rating_max) {
      searchQuery.filters.rating.max = parseFloat(queryParams.rating_max);
    }
  }

  if (queryParams.open_now === 'true') {
    searchQuery.filters = searchQuery.filters || {};
    searchQuery.filters.openNow = true;
  }

  if (queryParams.limit) {
    searchQuery.limit = parseInt(queryParams.limit, 10);
  }

  if (queryParams.offset) {
    searchQuery.offset = parseInt(queryParams.offset, 10);
  }

  if (queryParams.facets) {
    searchQuery.facets = queryParams.facets.split(',');
  }

  // Perform search
  const results = await searchService.search(searchQuery);

  return {
    success: true,
    query: searchQuery,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle search suggestions/autocomplete
 */
async function handleSuggest(
  requestBody: SearchRequest | null,
  queryParams: Record<string, string>
): Promise<any> {
  const prefix = requestBody?.prefix || queryParams.prefix || queryParams.q || '';
  const limit = requestBody?.limit || parseInt(queryParams.limit || '10', 10);

  if (!prefix) {
    throw new Error('Prefix parameter is required for suggestions');
  }

  const suggestions = await searchService.suggest(prefix, limit);

  return {
    success: true,
    prefix,
    suggestions,
    count: suggestions.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle location indexing
 */
async function handleIndex(requestBody: SearchRequest): Promise<any> {
  if (!requestBody.locations || !Array.isArray(requestBody.locations)) {
    throw new Error('Locations array is required for indexing');
  }

  if (requestBody.locations.length === 1) {
    // Single location indexing
    await searchService.indexLocation(requestBody.locations[0]);
    return {
      success: true,
      message: 'Location indexed successfully',
      count: 1,
      timestamp: new Date().toISOString(),
    };
  } else {
    // Bulk indexing
    await searchService.bulkIndexLocations(requestBody.locations);
    return {
      success: true,
      message: 'Locations indexed successfully',
      count: requestBody.locations.length,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Handle location deletion
 */
async function handleDelete(requestBody: SearchRequest): Promise<any> {
  if (!requestBody.locationId) {
    throw new Error('Location ID is required for deletion');
  }

  await searchService.deleteLocation(requestBody.locationId);

  return {
    success: true,
    message: 'Location deleted successfully',
    locationId: requestBody.locationId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle analytics requests
 */
async function handleAnalytics(): Promise<any> {
  const analytics = await searchService.getAnalytics();

  return {
    success: true,
    analytics,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle health check requests
 */
async function handleHealth(): Promise<any> {
  const health = await searchService.healthCheck();

  return {
    success: health.status === 'healthy',
    health,
    timestamp: new Date().toISOString(),
  };
}

// Handle CORS preflight
export async function corsHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: '',
  };
}
