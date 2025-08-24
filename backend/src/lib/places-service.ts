/**
 * Places Service
 * 
 * High-level service that provides place search functionality using
 * the pluggable provider system with caching and error handling.
 */

import {
  PlaceSearchParams,
  SearchResponse,
  ProviderError,
  HealthCheckResult
} from '../providers/interfaces.js';
import { providerFactory } from '../providers/factory.js';
import { PlacesResponse } from '../types/api-schemas.js';

// Import existing cache utilities
const { getCached, setCached, getCacheControlHeader } = require('./lib/cache-layer.cjs');

/**
 * Configuration for the places service
 */
interface PlacesServiceConfig {
  /** Default cache TTL in seconds */
  cacheTtl: number;
  /** Whether to use DynamoDB caching */
  useDynamoCache: boolean;
  /** DynamoDB cache table name */
  cacheTableName: string;
  /** Maximum results to return */
  maxResults: number;
  /** Preferred provider name */
  preferredProvider?: string;
}

/**
 * Service for searching places using pluggable providers
 */
export class PlacesService {
  private config: PlacesServiceConfig;

  constructor(config: PlacesServiceConfig) {
    this.config = config;
  }

  /**
   * Search for places with caching and provider failover
   */
  async searchPlaces(params: PlaceSearchParams): Promise<{
    data: PlacesResponse;
    cached: boolean;
    provider: string;
    headers: Record<string, string>;
  }> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(params);

    // Check cache first
    const cached = await getCached('places', cacheKey, {
      useDynamoDB: this.config.useDynamoCache,
      tableName: this.config.cacheTableName
    });

    if (cached) {
      console.log(`[PlacesService] Returning cached result for: ${params.query}`);
      return {
        data: cached,
        cached: true,
        provider: 'cache',
        headers: {
          'Cache-Control': getCacheControlHeader(this.config.cacheTtl, false),
          'X-Cache': 'HIT'
        }
      };
    }

    // Search using provider with failover
    let searchResponse: SearchResponse;
    try {
      const provider = await providerFactory.getProviderWithFailover(this.config.preferredProvider);
      
      // Apply service-level limits
      const searchParams = {
        ...params,
        limit: Math.min(params.limit || this.config.maxResults, this.config.maxResults)
      };

      searchResponse = await provider.searchPlaces(searchParams);
      console.log(`[PlacesService] Search completed using provider: ${searchResponse.metadata.provider}`);
      
    } catch (error) {
      console.error('[PlacesService] Search failed:', error);
      
      // Re-throw ProviderError with service context
      if (error instanceof ProviderError) {
        throw error;
      }
      
      // Wrap other errors
      throw new ProviderError(
        'service_unavailable',
        `Places service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'places-service',
        500,
        true,
        error as Error
      );
    }

    // Transform to API schema format
    const responseData: PlacesResponse = {
      query: params.query,
      count: searchResponse.results.length,
      results: searchResponse.results
    };

    // Cache the result
    try {
      await setCached('places', cacheKey, responseData, {
        ttlSeconds: this.config.cacheTtl,
        useDynamoDB: this.config.useDynamoCache,
        tableName: this.config.cacheTableName
      });
    } catch (cacheError) {
      // Log cache error but don't fail the request
      console.warn('[PlacesService] Failed to cache result:', cacheError);
    }

    return {
      data: responseData,
      cached: false,
      provider: searchResponse.metadata.provider,
      headers: {
        'Cache-Control': getCacheControlHeader(this.config.cacheTtl, false),
        'X-Cache': 'MISS',
        'X-Provider': searchResponse.metadata.provider,
        'X-Response-Time': searchResponse.metadata.duration.toString()
      }
    };
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus() {
    try {
      const healthResults = await providerFactory.checkHealth();
      const factoryStats = providerFactory.getStats();

      return {
        healthy: Object.values(healthResults).some((result: HealthCheckResult) => result.healthy),
        providers: healthResults,
        factory: factoryStats,
        service: {
          config: {
            cacheTtl: this.config.cacheTtl,
            useDynamoCache: this.config.useDynamoCache,
            maxResults: this.config.maxResults,
            preferredProvider: this.config.preferredProvider
          }
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        providers: {},
        factory: providerFactory.getStats(),
        service: {
          config: {
            cacheTtl: this.config.cacheTtl,
            useDynamoCache: this.config.useDynamoCache,
            maxResults: this.config.maxResults,
            preferredProvider: this.config.preferredProvider
          }
        }
      };
    }
  }

  /**
   * Clear cache for specific query or all entries
   */
  async clearCache(query?: string): Promise<void> {
    // This would require implementing cache deletion in cache-layer.cjs
    // For now, we'll just log the intent
    if (query) {
      const cacheKey = this.generateCacheKey({ query });
      console.log(`[PlacesService] Would clear cache for key: ${cacheKey}`);
    } else {
      console.log('[PlacesService] Would clear all places cache');
    }
  }

  /**
   * Generate cache key from search parameters
   */
  private generateCacheKey(params: PlaceSearchParams): string {
    const keyParts = [params.query.toLowerCase().trim()];
    
    if (params.location) {
      // Round to ~100m precision for cache efficiency
      const lat = Math.round(params.location.lat * 1000) / 1000;
      const lng = Math.round(params.location.lng * 1000) / 1000;
      keyParts.push(`loc:${lat},${lng}`);
    }
    
    if (params.radius) {
      keyParts.push(`r:${params.radius}`);
    }
    
    if (params.limit) {
      keyParts.push(`limit:${params.limit}`);
    }
    
    if (params.language) {
      keyParts.push(`lang:${params.language}`);
    }

    return keyParts.join('|');
  }
}

/**
 * Create places service from environment configuration
 */
export function createPlacesServiceFromEnv(): PlacesService {
  const config: PlacesServiceConfig = {
    cacheTtl: parseInt(process.env.PLACES_CACHE_TTL || '3600'), // 1 hour default
    useDynamoCache: process.env.ENABLE_CACHE_DDB === 'true',
    cacheTableName: process.env.CACHE_TABLE_NAME || 'daylight-cache',
    maxResults: parseInt(process.env.PLACES_MAX_RESULTS || '20'),
    preferredProvider: process.env.PLACES_PROVIDER
  };

  return new PlacesService(config);
}
