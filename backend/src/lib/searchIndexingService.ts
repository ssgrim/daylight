/**
 * Search Indexing Service - Populate search index with location data
 * Issue #112: Search Infrastructure & Geospatial Indexing
 */

import { searchService, SearchableLocation } from './searchService.js';

export interface POIProvider {
  name: string;
  fetchLocations(bounds?: GeoBounds): Promise<SearchableLocation[]>;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Sample data provider for testing and initial population
 */
class SampleDataProvider implements POIProvider {
  name = 'sample';

  async fetchLocations(): Promise<SearchableLocation[]> {
    // Sample San Francisco Bay Area locations for testing
    return [
      {
        id: 'golden-gate-bridge',
        name: 'Golden Gate Bridge',
        description: 'Iconic suspension bridge connecting San Francisco and Marin County',
        location: { lat: 37.8199, lon: -122.4783 },
        address: 'Golden Gate Bridge, San Francisco, CA',
        category: 'attraction',
        subcategory: 'landmark',
        tags: ['bridge', 'landmark', 'photography', 'walking', 'cycling'],
        rating: 4.7,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'alcatraz-island',
        name: 'Alcatraz Island',
        description: 'Historic federal prison and cultural site',
        location: { lat: 37.8267, lon: -122.4230 },
        address: 'Alcatraz Island, San Francisco, CA',
        category: 'attraction',
        subcategory: 'museum',
        tags: ['history', 'museum', 'tour', 'island', 'prison'],
        rating: 4.5,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'fishermans-wharf',
        name: "Fisherman's Wharf",
        description: 'Tourist area with shops, restaurants, and sea lions',
        location: { lat: 37.8080, lon: -122.4177 },
        address: "Fisherman's Wharf, San Francisco, CA",
        category: 'entertainment',
        subcategory: 'district',
        tags: ['shopping', 'dining', 'seafood', 'tourist', 'waterfront'],
        rating: 4.2,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'union-square',
        name: 'Union Square',
        description: 'Central shopping and hotel district',
        location: { lat: 37.7880, lon: -122.4074 },
        address: 'Union Square, San Francisco, CA',
        category: 'shopping',
        subcategory: 'plaza',
        tags: ['shopping', 'hotels', 'dining', 'theater', 'central'],
        rating: 4.3,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'lombard-street',
        name: 'Lombard Street',
        description: 'The most crooked street in the world',
        location: { lat: 37.8021, lon: -122.4187 },
        address: 'Lombard Street, San Francisco, CA',
        category: 'attraction',
        subcategory: 'street',
        tags: ['crooked', 'photography', 'driving', 'flowers', 'residential'],
        rating: 4.4,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'chinatown-sf',
        name: 'Chinatown',
        description: 'Historic Chinese cultural district',
        location: { lat: 37.7941, lon: -122.4078 },
        address: 'Chinatown, San Francisco, CA',
        category: 'cultural',
        subcategory: 'district',
        tags: ['culture', 'food', 'shopping', 'history', 'chinese'],
        rating: 4.4,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'crissy-field',
        name: 'Crissy Field',
        description: 'Waterfront park with Golden Gate Bridge views',
        location: { lat: 37.8022, lon: -122.4662 },
        address: 'Crissy Field, San Francisco, CA',
        category: 'park',
        subcategory: 'waterfront',
        tags: ['park', 'walking', 'cycling', 'picnic', 'views', 'dogs'],
        rating: 4.6,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'mission-dolores',
        name: 'Mission Dolores',
        description: 'Historic Spanish mission from 1776',
        location: { lat: 37.7649, lon: -122.4268 },
        address: '3321 16th Street, San Francisco, CA',
        category: 'cultural',
        subcategory: 'historic',
        tags: ['history', 'mission', 'spanish', 'church', 'museum'],
        rating: 4.3,
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      // Add some restaurants and cafes
      {
        id: 'tartine-bakery',
        name: 'Tartine Bakery',
        description: 'Famous artisanal bakery and cafe',
        location: { lat: 37.7616, lon: -122.4240 },
        address: '600 Guerrero Street, San Francisco, CA',
        category: 'dining',
        subcategory: 'bakery',
        tags: ['bakery', 'coffee', 'pastries', 'artisanal', 'mission'],
        rating: 4.5,
        priceLevel: 2,
        openingHours: {
          monday: { open: '08:00', close: '19:00' },
          tuesday: { open: '08:00', close: '19:00' },
          wednesday: { open: '08:00', close: '19:00' },
          thursday: { open: '08:00', close: '19:00' },
          friday: { open: '08:00', close: '19:00' },
          saturday: { open: '08:00', close: '19:00' },
          sunday: { open: '08:00', close: '19:00' },
        },
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
      {
        id: 'swan-oyster-depot',
        name: 'Swan Oyster Depot',
        description: 'Historic seafood counter serving fresh oysters',
        location: { lat: 37.7945, lon: -122.4195 },
        address: '1517 Polk Street, San Francisco, CA',
        category: 'dining',
        subcategory: 'seafood',
        tags: ['seafood', 'oysters', 'historic', 'counter', 'fresh'],
        rating: 4.4,
        priceLevel: 3,
        openingHours: {
          monday: { open: '10:30', close: '17:30' },
          tuesday: { open: '10:30', close: '17:30' },
          wednesday: { open: '10:30', close: '17:30' },
          thursday: { open: '10:30', close: '17:30' },
          friday: { open: '10:30', close: '17:30' },
          saturday: { open: '10:30', close: '17:30' },
          sunday: null, // Closed
        },
        metadata: {
          source: 'sample',
          lastUpdated: new Date().toISOString(),
          verified: true,
        },
      },
    ];
  }
}

/**
 * Main indexing service
 */
export class SearchIndexingService {
  private providers: POIProvider[] = [];

  constructor() {
    // Add default providers
    this.addProvider(new SampleDataProvider());
  }

  /**
   * Add a POI data provider
   */
  addProvider(provider: POIProvider): void {
    this.providers.push(provider);
    console.log(`Added POI provider: ${provider.name}`);
  }

  /**
   * Index all locations from all providers
   */
  async indexAllLocations(bounds?: GeoBounds): Promise<void> {
    console.log('Starting location indexing...');

    let totalIndexed = 0;

    for (const provider of this.providers) {
      try {
        console.log(`Fetching locations from provider: ${provider.name}`);
        const locations = await provider.fetchLocations(bounds);

        if (locations.length > 0) {
          console.log(`Indexing ${locations.length} locations from ${provider.name}`);
          await searchService.bulkIndexLocations(locations);
          totalIndexed += locations.length;
        } else {
          console.log(`No locations found from provider: ${provider.name}`);
        }
      } catch (error) {
        console.error(`Error indexing from provider ${provider.name}:`, error);
        // Continue with other providers
      }
    }

    console.log(`Location indexing complete. Total indexed: ${totalIndexed}`);
  }

  /**
   * Reindex a specific provider
   */
  async reindexProvider(providerName: string, bounds?: GeoBounds): Promise<void> {
    const provider = this.providers.find(p => p.name === providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    console.log(`Reindexing provider: ${providerName}`);
    const locations = await provider.fetchLocations(bounds);

    if (locations.length > 0) {
      await searchService.bulkIndexLocations(locations);
      console.log(`Reindexed ${locations.length} locations from ${providerName}`);
    }
  }

  /**
   * Initialize search infrastructure
   */
  async initialize(): Promise<void> {
    console.log('Initializing search infrastructure...');

    // Initialize the search index
    await searchService.initializeIndex();

    // Index sample data
    await this.indexAllLocations();

    console.log('Search infrastructure initialization complete');
  }

  /**
   * Get indexing status
   */
  async getStatus(): Promise<any> {
    const analytics = await searchService.getAnalytics();
    const health = await searchService.healthCheck();

    return {
      providers: this.providers.map(p => ({ name: p.name })),
      analytics,
      health,
      timestamp: new Date().toISOString(),
    };
  }
}

export const searchIndexingService = new SearchIndexingService();
