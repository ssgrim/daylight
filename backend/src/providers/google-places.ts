/**
 * Google Places API Provider Implementation
 * 
 * Implements the PlaceSearchProvider interface for Google Places API,
 * providing normalized access to Google's place search functionality.
 */

import {
  PlaceSearchProvider,
  ProviderConfig,
  PlaceSearchParams,
  SearchResponse,
  HealthCheckResult,
  ProviderError,
  SearchMetadata
} from './interfaces.js';
import { PlaceResult, Location } from '../types/api-schemas.js';

// Import existing utilities
const { timeoutFetch, retryWithBackoff, mapToApiError } = require('../lib/http-utils.cjs');

/**
 * Google Places API specific configuration
 */
interface GooglePlacesConfig extends ProviderConfig {
  /** Google Places API key */
  apiKey: string;
  /** API endpoint (for testing) */
  endpoint?: string;
  /** Supported place types for filtering */
  placeTypes?: string[];
  /** Default language for results */
  language?: string;
  /** Region bias (country code) */
  region?: string;
}

/**
 * Google Places API response structure
 */
interface GooglePlacesResponse {
  results: Array<{
    name: string;
    formatted_address: string;
    rating?: number;
    place_id: string;
    geometry?: {
      location: {
        lat: number;
        lng: number;
      };
    };
    price_level?: number;
    opening_hours?: {
      open_now: boolean;
    };
    types: string[];
  }>;
  status: string;
  error_message?: string;
  next_page_token?: string;
}

/**
 * Google Places API Provider
 */
export class GooglePlacesProvider implements PlaceSearchProvider {
  public readonly name = 'google-places';
  public readonly version = '1.0.0';
  
  private config?: GooglePlacesConfig;
  private initialized = false;

  public get isConfigured(): boolean {
    return this.initialized && !!this.config?.apiKey;
  }

  /**
   * Initialize the provider with Google Places API configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new ProviderError(
        'authentication_failed',
        'Google Places API key is required',
        this.name,
        401
      );
    }

    this.config = {
      timeout: 8000,
      maxRetries: 3,
      baseDelay: 200,
      endpoint: 'https://maps.googleapis.com/maps/api/place',
      language: 'en',
      ...config
    } as GooglePlacesConfig;

    this.initialized = true;

    // Verify API key works with a test request
    try {
      await this.healthCheck();
    } catch (error) {
      this.initialized = false;
      throw new ProviderError(
        'authentication_failed',
        'Failed to verify Google Places API key',
        this.name,
        401,
        false,
        error as Error
      );
    }
  }

  /**
   * Search for places using Google Places Text Search API
   */
  async searchPlaces(params: PlaceSearchParams): Promise<SearchResponse> {
    if (!this.isConfigured) {
      throw new ProviderError(
        'invalid_request',
        'Provider not properly configured',
        this.name,
        500
      );
    }

    const startTime = Date.now();

    try {
      // Build API request URL
      const url = new URL(`${this.config!.endpoint}/textsearch/json`);
      url.searchParams.set('query', params.query);
      url.searchParams.set('key', this.config!.apiKey);

      // Add optional parameters
      if (params.location) {
        url.searchParams.set(
          'location',
          `${params.location.lat},${params.location.lng}`
        );
      }

      if (params.radius) {
        url.searchParams.set('radius', params.radius.toString());
      }

      if (params.language || this.config!.language) {
        url.searchParams.set('language', params.language || this.config!.language!);
      }

      if (this.config!.region) {
        url.searchParams.set('region', this.config!.region);
      }

      // Handle category filtering by mapping to Google Place types
      if (params.category) {
        const placeType = this.mapCategoryToGoogleType(params.category);
        if (placeType) {
          url.searchParams.set('type', placeType);
        }
      }

      // Handle sorting - Google doesn't support all sort options directly
      // We'll need to fetch more results and sort them ourselves for some options
      const needsClientSorting = params.sort && ['rating', 'name'].includes(params.sort);
      const fetchLimit = needsClientSorting ? Math.max((params.limit || 20) * 2, 40) : (params.limit || 20);

      // Add provider-specific parameters
      if (params.extra) {
        Object.entries(params.extra).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.set(key, value.toString());
          }
        });
      }

      console.log(`[GooglePlaces] Searching for: ${params.query}`);

      // Make API request with retry logic
      const response = await retryWithBackoff(
        () => timeoutFetch(url.toString(), { method: 'GET' }, this.config!.timeout!),
        this.config!.maxRetries!,
        this.config!.baseDelay!
      );

      if (!response.ok) {
        const errorInfo = mapToApiError(response);
        throw new ProviderError(
          this.mapHttpStatusToErrorType(response.status),
          `Google Places API error: ${response.status} ${response.statusText}`,
          this.name,
          response.status,
          response.status >= 500 // Retry on server errors
        );
      }

      const data: GooglePlacesResponse = await response.json();

      // Check API-specific error status
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new ProviderError(
          this.mapGoogleStatusToErrorType(data.status),
          data.error_message || `Google Places API error: ${data.status}`,
          this.name,
          400
        );
      }

      // Transform results to standardized format
      let results = this.transformResults(data.results || [], undefined, params.location);
      const totalResults = results.length;

      // Apply client-side sorting if needed
      if (params.sort) {
        results = this.sortResults(results, params.sort);
      }

      // Apply pagination
      const offset = params.offset || 0;
      const limit = params.limit || 20;
      const paginatedResults = results.slice(offset, offset + limit);

      const duration = Date.now() - startTime;

      const metadata: SearchMetadata = {
        provider: this.name,
        duration,
        cached: false,
        totalResults,
        page: params.offset ? Math.floor(offset / limit) + 1 : 1,
        pageSize: limit,
        totalPages: Math.ceil(totalResults / limit),
        sort: params.sort,
        category: params.category
      };

      return {
        query: params,
        results: paginatedResults,
        metadata
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Re-throw ProviderError as-is
      if (error instanceof ProviderError) {
        throw error;
      }

      // Wrap other errors
      throw new ProviderError(
        'network_error',
        `Google Places API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        500,
        true,
        error as Error
      );
    }
  }

  /**
   * Perform health check by making a simple API request
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.isConfigured) {
        return {
          provider: this.name,
          healthy: false,
          responseTime: 0,
          error: 'Provider not configured'
        };
      }

      // Make a simple test request
      const testParams: PlaceSearchParams = {
        query: 'restaurant',
        limit: 1
      };

      await this.searchPlaces(testParams);

      return {
        provider: this.name,
        healthy: true,
        responseTime: Date.now() - startTime,
        details: {
          endpoint: this.config!.endpoint,
          lastChecked: new Date()
        }
      };

    } catch (error) {
      return {
        provider: this.name,
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          endpoint: this.config?.endpoint,
          lastChecked: new Date()
        }
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.config = undefined;
  }

  /**
   * Transform Google Places results to standardized format
   */
  private transformResults(
    googleResults: GooglePlacesResponse['results'], 
    limit?: number,
    searchLocation?: Location
  ): PlaceResult[] {
    const results = googleResults.map(result => {
      const placeResult: PlaceResult = {
        name: result.name || 'Unknown',
        address: result.formatted_address || '',
        rating: typeof result.rating === 'number' ? result.rating : undefined,
        place_id: result.place_id || '',
        location: result.geometry?.location ? {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        } : undefined,
        category: this.mapGoogleTypesToCategory(result.types),
        price_level: result.price_level,
        opening_hours: result.opening_hours ? {
          open_now: result.opening_hours.open_now
        } : undefined
      };

      // Calculate distance if search location is provided
      if (searchLocation && placeResult.location) {
        placeResult.distance = this.calculateDistance(
          searchLocation,
          placeResult.location
        );
      }

      return placeResult;
    });

    // Apply limit if specified
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Sort results based on the specified sort option
   */
  private sortResults(results: PlaceResult[], sort: string): PlaceResult[] {
    const sortedResults = [...results];

    switch (sort) {
      case 'rating':
        return sortedResults.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA; // Descending order
        });

      case 'distance':
        return sortedResults.sort((a, b) => {
          const distanceA = a.distance || Infinity;
          const distanceB = b.distance || Infinity;
          return distanceA - distanceB; // Ascending order
        });

      case 'name':
        return sortedResults.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });

      case 'relevance':
      default:
        return sortedResults; // Keep original order (relevance)
    }
  }

  /**
   * Map category to Google Place type
   */
  private mapCategoryToGoogleType(category: string): string | null {
    const categoryMapping: Record<string, string> = {
      'restaurant': 'restaurant',
      'cafe': 'cafe',
      'bar': 'bar',
      'hotel': 'lodging',
      'attraction': 'tourist_attraction',
      'shopping': 'shopping_mall',
      'entertainment': 'amusement_park',
      'transportation': 'transit_station',
      'health': 'hospital',
      'services': 'establishment'
    };

    return categoryMapping[category] || null;
  }

  /**
   * Map Google Place types to our standard categories
   */
  private mapGoogleTypesToCategory(types: string[]): import('../types/api-schemas.js').PlaceCategory {
    const typeMapping: Record<string, import('../types/api-schemas.js').PlaceCategory> = {
      'restaurant': 'restaurant',
      'food': 'restaurant',
      'meal_takeaway': 'restaurant',
      'cafe': 'cafe',
      'bar': 'bar',
      'night_club': 'bar',
      'lodging': 'hotel',
      'tourist_attraction': 'attraction',
      'amusement_park': 'entertainment',
      'shopping_mall': 'shopping',
      'store': 'shopping',
      'transit_station': 'transportation',
      'hospital': 'health',
      'pharmacy': 'health',
      'establishment': 'services'
    };

    // Find the first matching category
    for (const type of types) {
      if (typeMapping[type]) {
        return typeMapping[type];
      }
    }

    return 'other';
  }

  /**
   * Calculate distance between two locations using Haversine formula
   */
  private calculateDistance(location1: Location, location2: Location): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = location1.lat * Math.PI / 180;
    const lat2Rad = location2.lat * Math.PI / 180;
    const deltaLatRad = (location2.lat - location1.lat) * Math.PI / 180;
    const deltaLngRad = (location2.lng - location1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // Distance in meters
  }

  /**
   * Map HTTP status codes to provider error types
   */
  private mapHttpStatusToErrorType(status: number): import('./interfaces.js').ProviderErrorType {
    switch (status) {
      case 400:
        return 'invalid_request';
      case 401:
      case 403:
        return 'authentication_failed';
      case 429:
        return 'rate_limit_exceeded';
      case 500:
      case 502:
      case 503:
        return 'service_unavailable';
      case 504:
        return 'timeout';
      default:
        return 'unknown_error';
    }
  }

  /**
   * Map Google Places API status to provider error types
   */
  private mapGoogleStatusToErrorType(status: string): import('./interfaces.js').ProviderErrorType {
    switch (status) {
      case 'INVALID_REQUEST':
        return 'invalid_request';
      case 'OVER_QUERY_LIMIT':
        return 'quota_exceeded';
      case 'REQUEST_DENIED':
        return 'authentication_failed';
      case 'UNKNOWN_ERROR':
        return 'service_unavailable';
      default:
        return 'unknown_error';
    }
  }
}
