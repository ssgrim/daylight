/**
 * Mock Places Provider Implementation
 * 
 * A mock implementation of PlaceSearchProvider for testing and development.
 * Returns deterministic results based on query patterns.
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
import { PlaceResult } from '../types/api-schemas.js';

/**
 * Mock provider configuration
 */
interface MockProviderConfig extends ProviderConfig {
  /** Simulated response delay in ms */
  delay?: number;
  /** Whether to simulate random failures */
  simulateFailures?: boolean;
  /** Failure rate (0.0 to 1.0) */
  failureRate?: number;
  /** Maximum results to return */
  maxResults?: number;
  /** Custom mock data */
  mockData?: PlaceResult[];
}

/**
 * Mock Places Provider for testing and development
 */
export class MockPlacesProvider implements PlaceSearchProvider {
  public readonly name = 'mock-places';
  public readonly version = '1.0.0';
  
  private config?: MockProviderConfig;
  private initialized = false;
  private requestCount = 0;

  public get isConfigured(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the mock provider
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = {
      delay: 100,
      simulateFailures: false,
      failureRate: 0.1,
      maxResults: 20,
      ...config
    } as MockProviderConfig;

    this.initialized = true;
    this.requestCount = 0;
  }

  /**
   * Search for places using mock data
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
    this.requestCount++;

    // Simulate network delay
    if (this.config!.delay! > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config!.delay));
    }

    // Simulate random failures if enabled
    if (this.config!.simulateFailures && Math.random() < this.config!.failureRate!) {
      throw new ProviderError(
        'service_unavailable',
        'Simulated service failure',
        this.name,
        503,
        true
      );
    }

    // Generate mock results based on query
    let results = this.generateMockResults(params);
    const totalResults = results.length;

    // Apply sorting
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
  }

  /**
   * Always reports healthy unless configured to fail
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    // Simulate random health check failures
    if (this.config?.simulateFailures && Math.random() < (this.config.failureRate || 0)) {
      return {
        provider: this.name,
        healthy: false,
        responseTime: Date.now() - startTime,
        error: 'Simulated health check failure',
        details: {
          lastChecked: new Date(),
          errorCount: Math.floor(Math.random() * 5)
        }
      };
    }

    return {
      provider: this.name,
      healthy: true,
      responseTime: Date.now() - startTime,
      details: {
        lastChecked: new Date(),
        endpoint: 'mock://localhost',
        rateLimitStatus: 'unlimited'
      }
    };
  }

  /**
   * Clean up mock provider
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.config = undefined;
    this.requestCount = 0;
  }

  /**
   * Get request statistics (useful for testing)
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      isConfigured: this.isConfigured,
      config: this.config
    };
  }

  /**
   * Generate mock results based on query patterns
   */
  private generateMockResults(params: PlaceSearchParams): PlaceResult[] {
    // Use custom mock data if provided
    if (this.config?.mockData) {
      let results = [...this.config.mockData];
      
      // Apply category filter
      if (params.category) {
        results = results.filter(place => place.category === params.category);
      }
      
      return results;
    }

    // Generate deterministic results based on query and category
    const query = params.query.toLowerCase();
    const category = params.category;
    const baseLocation = params.location || { lat: 37.7749, lng: -122.4194 }; // Default to SF
    const results: PlaceResult[] = [];

    // Determine result count based on query specificity and category
    let resultCount = this.getResultCount(query, category);
    
    // Cap by maxResults
    resultCount = Math.min(resultCount, this.config!.maxResults!);

    // Generate mock places
    for (let i = 0; i < resultCount; i++) {
      const placeCategory = category || this.inferCategoryFromQuery(query);
      const placeName = this.generatePlaceName(query, placeCategory, i);
      
      // Add small random offset to location
      const locationOffset = 0.01; // ~1km
      const lat = baseLocation.lat + (Math.random() - 0.5) * locationOffset;
      const lng = baseLocation.lng + (Math.random() - 0.5) * locationOffset;

      const place: PlaceResult = {
        name: placeName,
        address: this.generateAddress(lat, lng, i),
        rating: this.generateRating(),
        place_id: `mock_place_${Date.now()}_${i}`,
        location: { lat, lng },
        category: placeCategory as import('../types/api-schemas.js').PlaceCategory,
        price_level: this.generatePriceLevel(placeCategory),
        opening_hours: {
          open_now: Math.random() > 0.3 // 70% chance of being open
        }
      };

      // Calculate distance if search location is provided
      if (params.location && place.location) {
        place.distance = this.calculateDistance(params.location, place.location);
      }

      results.push(place);
    }

    return results;
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
   * Get result count based on query and category
   */
  private getResultCount(query: string, category?: string): number {
    if (category) {
      // Category-specific result counts
      const categoryCounts: Record<string, number> = {
        'restaurant': 15,
        'cafe': 10,
        'bar': 8,
        'hotel': 6,
        'attraction': 12,
        'shopping': 14,
        'entertainment': 9,
        'transportation': 5,
        'health': 7,
        'services': 11,
        'other': 8
      };
      return categoryCounts[category] || 8;
    }

    // Query-based result counts (fallback)
    if (query.includes('restaurant') || query.includes('food')) {
      return 15;
    } else if (query.includes('coffee') || query.includes('cafe')) {
      return 10;
    } else if (query.includes('hotel') || query.includes('accommodation')) {
      return 8;
    } else if (query.includes('shop') || query.includes('store')) {
      return 12;
    } else {
      return 5;
    }
  }

  /**
   * Infer category from query when no explicit category is provided
   */
  private inferCategoryFromQuery(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('restaurant') || queryLower.includes('food')) return 'restaurant';
    if (queryLower.includes('coffee') || queryLower.includes('cafe')) return 'cafe';
    if (queryLower.includes('bar') || queryLower.includes('pub')) return 'bar';
    if (queryLower.includes('hotel') || queryLower.includes('motel')) return 'hotel';
    if (queryLower.includes('museum') || queryLower.includes('park')) return 'attraction';
    if (queryLower.includes('shop') || queryLower.includes('store')) return 'shopping';
    if (queryLower.includes('theater') || queryLower.includes('cinema')) return 'entertainment';
    if (queryLower.includes('station') || queryLower.includes('airport')) return 'transportation';
    if (queryLower.includes('hospital') || queryLower.includes('clinic')) return 'health';
    if (queryLower.includes('bank') || queryLower.includes('office')) return 'services';
    
    return 'other';
  }

  /**
   * Generate place name based on query and category
   */
  private generatePlaceName(query: string, category: string, index: number): string {
    const placeNames: Record<string, string[]> = {
      'restaurant': ['The Golden Fork', 'Bella Vista', 'Ocean Breeze', 'Downtown Grill', 'Family Table', 'Tasty Bites', 'Chef\'s Special'],
      'cafe': ['Blue Bottle Coffee', 'Morning Brew', 'The Coffee House', 'Bean There', 'Sunrise Cafe', 'Daily Grind', 'Corner Cafe'],
      'bar': ['The Tavern', 'Sunset Lounge', 'Happy Hour', 'The Pub', 'Cocktail Corner', 'Night Owl', 'Local Bar'],
      'hotel': ['Grand Hotel', 'Comfort Inn', 'Boutique Suites', 'City Lodge', 'The Plaza', 'Traveler\'s Rest', 'Urban Stay'],
      'attraction': ['City Museum', 'Central Park', 'Historic District', 'Art Gallery', 'Science Center', 'Memorial Square', 'Cultural Hub'],
      'shopping': ['Main Street Market', 'The Boutique', 'Corner Store', 'Fashion Plaza', 'Local Shop', 'Retail Center', 'Style Store'],
      'entertainment': ['Cinema Complex', 'Theater District', 'Game Center', 'Music Hall', 'Entertainment Hub', 'Fun Zone', 'Activity Center'],
      'transportation': ['Central Station', 'Bus Terminal', 'Metro Stop', 'Transit Hub', 'Airport Shuttle', 'Train Station', 'Transport Center'],
      'health': ['City Hospital', 'Medical Center', 'Health Clinic', 'Wellness Center', 'Emergency Care', 'Family Practice', 'Healthcare Hub'],
      'services': ['City Hall', 'Business Center', 'Service Office', 'Professional Plaza', 'Community Center', 'Public Services', 'Admin Building'],
      'other': ['Local Business', 'Community Center', 'Downtown Location', 'Main Street', 'The Place', 'Central Building', 'General Services']
    };
    
    const names = placeNames[category] || placeNames['other'];
    return names[index % names.length];
  }

  /**
   * Generate price level based on category
   */
  private generatePriceLevel(category: string): number {
    const priceLevels: Record<string, number[]> = {
      'restaurant': [1, 2, 2, 3, 3, 4], // Restaurants tend to be mid-range
      'cafe': [1, 1, 2, 2, 3], // Cafes are usually cheaper
      'bar': [2, 2, 3, 3, 4], // Bars can be pricey
      'hotel': [2, 3, 3, 4, 4], // Hotels tend to be expensive
      'shopping': [1, 2, 2, 3, 4], // Shopping varies widely
      'other': [1, 2, 2, 3] // Others are generally affordable
    };
    
    const levels = priceLevels[category] || priceLevels['other'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  /**
   * Calculate distance between two locations using Haversine formula
   */
  private calculateDistance(location1: import('../types/api-schemas.js').Location, location2: import('../types/api-schemas.js').Location): number {
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
   * Generate realistic address
   */
  private generateAddress(lat: number, lng: number, index: number): string {
    const streetNumbers = [123, 456, 789, 101, 555];
    const streetNames = ['Main St', 'Oak Ave', 'First St', 'Park Blvd', 'Cedar Dr'];
    const cities = ['San Francisco', 'Oakland', 'Berkeley', 'Palo Alto', 'San Jose'];
    
    const streetNumber = streetNumbers[index % streetNumbers.length];
    const streetName = streetNames[index % streetNames.length];
    const city = cities[index % cities.length];
    
    return `${streetNumber} ${streetName}, ${city}, CA`;
  }

  /**
   * Generate realistic rating
   */
  private generateRating(): number {
    // Weighted towards higher ratings (3.5-5.0)
    const ratings = [3.5, 3.8, 4.0, 4.2, 4.5, 4.7, 4.8, 5.0];
    return ratings[Math.floor(Math.random() * ratings.length)];
  }

  /**
   * Get place types based on query
   */
  private getPlaceTypes(query: string): string[] {
    const query_lower = query.toLowerCase();
    
    if (query_lower.includes('restaurant')) return ['restaurant', 'food', 'establishment'];
    if (query_lower.includes('coffee')) return ['cafe', 'food', 'establishment'];
    if (query_lower.includes('hotel')) return ['lodging', 'establishment'];
    if (query_lower.includes('shop')) return ['store', 'establishment'];
    
    return ['establishment'];
  }
}
