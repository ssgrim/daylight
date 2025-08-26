/**
 * Search Admin Handler - Administrative operations for search infrastructure
 * Issue #112: Search Infrastructure & Geospatial Indexing
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { searchIndexingService } from '../lib/searchIndexingService.js';
import { searchService } from '../lib/searchService.js';

export interface SearchAdminRequest {
  action: 'initialize' | 'reindex' | 'status' | 'analytics' | 'health';
  provider?: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  console.log('Search admin handler invoked:', JSON.stringify(event, null, 2));

  try {
    // Simple authentication check (in production, use proper auth)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Bearer token required for admin operations',
        }),
      };
    }

    // In production, validate the JWT token here
    const token = authHeader.substring(7);
    if (token !== process.env.SEARCH_ADMIN_TOKEN && token !== 'dev-admin-token') {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid admin token',
        }),
      };
    }

    const method = event.requestContext.http.method;

    // Parse request body
    let requestBody: SearchAdminRequest | null = null;
    if (method === 'POST' && event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid JSON in request body',
            details: (error as Error).message,
          }),
        };
      }
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const action = requestBody?.action || queryParams.action || 'status';

    let result: any;

    switch (action) {
      case 'initialize':
        result = await handleInitialize();
        break;

      case 'reindex':
        result = await handleReindex(requestBody);
        break;

      case 'status':
        result = await handleStatus();
        break;

      case 'analytics':
        result = await handleAnalytics();
        break;

      case 'health':
        result = await handleHealth();
        break;

      default:
        throw new Error(`Unknown admin action: ${action}`);
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
    console.error('Search admin handler error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
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
 * Initialize search infrastructure
 */
async function handleInitialize(): Promise<any> {
  const startTime = Date.now();
  
  await searchIndexingService.initialize();
  
  const duration = Date.now() - startTime;

  return {
    success: true,
    message: 'Search infrastructure initialized successfully',
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reindex locations
 */
async function handleReindex(requestBody: SearchAdminRequest | null): Promise<any> {
  const startTime = Date.now();
  
  if (requestBody?.provider) {
    // Reindex specific provider
    await searchIndexingService.reindexProvider(
      requestBody.provider,
      requestBody.bounds
    );
  } else {
    // Reindex all providers
    await searchIndexingService.indexAllLocations(requestBody?.bounds);
  }
  
  const duration = Date.now() - startTime;

  return {
    success: true,
    message: requestBody?.provider 
      ? `Provider ${requestBody.provider} reindexed successfully`
      : 'All providers reindexed successfully',
    provider: requestBody?.provider,
    bounds: requestBody?.bounds,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get search infrastructure status
 */
async function handleStatus(): Promise<any> {
  const status = await searchIndexingService.getStatus();

  return {
    success: true,
    status,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get search analytics
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
 * Get search health status
 */
async function handleHealth(): Promise<any> {
  const health = await searchService.healthCheck();

  return {
    success: health.status === 'healthy',
    health,
    timestamp: new Date().toISOString(),
  };
}
