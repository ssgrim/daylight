/**
 * Test Suite for Pluggable Providers
 * 
 * Comprehensive tests for the provider system including interfaces,
 * implementations, and the factory.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  PlaceSearchProvider,
  ProviderFactory,
  PlaceSearchParams,
  ProviderError,
  ProviderConfig
} from '../src/providers/interfaces.js';
import { GooglePlacesProvider } from '../src/providers/google-places.js';
import { MockPlacesProvider } from '../src/providers/mock-places.js';
import { DefaultProviderFactory } from '../src/providers/factory.js';

describe('Provider Interfaces', () => {
  describe('ProviderError', () => {
    it('should create a ProviderError with all properties', () => {
      const error = new ProviderError(
        'authentication_failed',
        'Invalid API key',
        'test-provider',
        401,
        false,
        new Error('Original error')
      );

      expect(error.name).toBe('ProviderError');
      expect(error.type).toBe('authentication_failed');
      expect(error.message).toBe('Invalid API key');
      expect(error.provider).toBe('test-provider');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
      expect(error.originalError).toBeInstanceOf(Error);
    });

    it('should have default values for optional parameters', () => {
      const error = new ProviderError(
        'network_error',
        'Connection failed',
        'test-provider'
      );

      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(false);
      expect(error.originalError).toBeUndefined();
    });
  });
});

describe('MockPlacesProvider', () => {
  let provider: MockPlacesProvider;

  beforeEach(async () => {
    provider = new MockPlacesProvider();
    await provider.initialize({
      delay: 10, // Fast for tests
      simulateFailures: false,
      maxResults: 10
    });
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  it('should implement PlaceSearchProvider interface', () => {
    expect(provider.name).toBe('mock-places');
    expect(provider.version).toBe('1.0.0');
    expect(provider.isConfigured).toBe(true);
  });

  it('should return search results for restaurants', async () => {
    const params: PlaceSearchParams = {
      query: 'restaurant',
      limit: 5
    };

    const response = await provider.searchPlaces(params);

    expect(response.results).toHaveLength(5);
    expect(response.metadata.provider).toBe('mock-places');
    expect(response.metadata.cached).toBe(false);
    expect(response.query).toEqual(params);

    // Verify result structure
    response.results.forEach(result => {
      expect(result.name).toBeDefined();
      expect(result.address).toBeDefined();
      expect(result.place_id).toBeDefined();
      expect(result.location).toBeDefined();
      expect(result.rating).toBeGreaterThanOrEqual(3.5);
      expect(result.rating).toBeLessThanOrEqual(5.0);
    });
  });

  it('should return different results for different queries', async () => {
    const restaurantResponse = await provider.searchPlaces({ query: 'restaurant' });
    const coffeeResponse = await provider.searchPlaces({ query: 'coffee' });

    expect(restaurantResponse.results[0].name).not.toBe(coffeeResponse.results[0].name);
  });

  it('should respect location bias', async () => {
    const location = { lat: 40.7128, lng: -74.0060 }; // NYC
    const params: PlaceSearchParams = {
      query: 'restaurant',
      location,
      limit: 3
    };

    const response = await provider.searchPlaces(params);

    // Check that results have locations near the bias point
    response.results.forEach(result => {
      expect(result.location).toBeDefined();
      expect(Math.abs(result.location!.lat - location.lat)).toBeLessThan(0.1);
      expect(Math.abs(result.location!.lng - location.lng)).toBeLessThan(0.1);
    });
  });

  it('should handle health checks', async () => {
    const health = await provider.healthCheck();

    expect(health.provider).toBe('mock-places');
    expect(health.healthy).toBe(true);
    expect(health.responseTime).toBeGreaterThan(0);
    expect(health.details).toBeDefined();
  });

  it('should simulate failures when configured', async () => {
    await provider.cleanup();
    await provider.initialize({
      simulateFailures: true,
      failureRate: 1.0 // Always fail
    });

    await expect(provider.searchPlaces({ query: 'test' }))
      .rejects
      .toThrow(ProviderError);
  });

  it('should track request statistics', async () => {
    const initialStats = provider.getStats();
    expect(initialStats.requestCount).toBe(0);

    await provider.searchPlaces({ query: 'test' });
    await provider.searchPlaces({ query: 'test2' });

    const finalStats = provider.getStats();
    expect(finalStats.requestCount).toBe(2);
  });
});

describe('GooglePlacesProvider', () => {
  let provider: GooglePlacesProvider;

  beforeEach(() => {
    provider = new GooglePlacesProvider();
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  it('should implement PlaceSearchProvider interface', () => {
    expect(provider.name).toBe('google-places');
    expect(provider.version).toBe('1.0.0');
    expect(provider.isConfigured).toBe(false);
  });

  it('should require API key for initialization', async () => {
    await expect(provider.initialize({}))
      .rejects
      .toThrow(ProviderError);

    expect(provider.isConfigured).toBe(false);
  });

  it('should fail searches when not configured', async () => {
    await expect(provider.searchPlaces({ query: 'test' }))
      .rejects
      .toThrow(ProviderError);
  });

  // Note: Real API tests would require actual API keys and should be integration tests
  it('should validate API key format during health check', async () => {
    // Mock the fetch to avoid real API calls in unit tests
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });
    global.fetch = mockFetch;

    await expect(provider.initialize({ apiKey: 'invalid-key' }))
      .rejects
      .toThrow(ProviderError);
  });
});

describe('DefaultProviderFactory', () => {
  let factory: ProviderFactory;
  let mockProvider: MockPlacesProvider;
  let googleProvider: GooglePlacesProvider;

  beforeEach(() => {
    factory = new DefaultProviderFactory();
    mockProvider = new MockPlacesProvider();
    googleProvider = new GooglePlacesProvider();
  });

  afterEach(async () => {
    try {
      await factory.checkHealth(); // This might fail, that's OK
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should register providers', () => {
    factory.register('mock', mockProvider);
    factory.register('google', googleProvider);

    const available = factory.getAvailableProviders();
    expect(available).toContain('mock');
    expect(available).toContain('google');
  });

  it('should initialize providers with configuration', async () => {
    factory.register('mock', mockProvider);

    const config = {
      defaultProvider: 'mock',
      providers: {
        mock: {
          delay: 50,
          simulateFailures: false
        }
      }
    };

    await factory.initialize(config);
    expect(mockProvider.isConfigured).toBe(true);

    const provider = factory.getProvider();
    expect(provider).toBe(mockProvider);
  });

  it('should throw error for unknown provider', async () => {
    factory.register('mock', mockProvider);
    
    const config = {
      defaultProvider: 'mock',
      providers: { mock: {} }
    };
    
    await factory.initialize(config);

    expect(() => factory.getProvider('unknown'))
      .toThrow('Provider \'unknown\' not found');
  });

  it('should return default provider when no name specified', async () => {
    factory.register('mock', mockProvider);
    
    const config = {
      defaultProvider: 'mock',
      providers: { mock: {} }
    };
    
    await factory.initialize(config);

    const provider = factory.getProvider();
    expect(provider.name).toBe('mock-places');
  });

  it('should check health of all providers', async () => {
    factory.register('mock', mockProvider);
    
    const config = {
      defaultProvider: 'mock',
      providers: { mock: {} }
    };
    
    await factory.initialize(config);

    const health = await factory.checkHealth();
    expect(health).toHaveProperty('mock');
    expect(health.mock.provider).toBe('mock-places');
  });

  it('should handle provider initialization failures', async () => {
    factory.register('google', googleProvider);

    const config = {
      defaultProvider: 'google',
      providers: {
        google: {} // Missing API key
      }
    };

    await expect(factory.initialize(config))
      .rejects
      .toThrow();
  });

  it('should support failover between providers', async () => {
    factory.register('mock', mockProvider);
    const failingProvider = new MockPlacesProvider();
    factory.register('failing', failingProvider);

    // Configure failing provider to always fail
    await failingProvider.initialize({
      simulateFailures: true,
      failureRate: 1.0
    });

    const config = {
      defaultProvider: 'failing',
      enableFailover: true,
      fallbacks: ['mock'],
      providers: {
        mock: { simulateFailures: false },
        failing: { simulateFailures: true, failureRate: 1.0 }
      }
    };

    await factory.initialize(config);

    // Should get mock provider as fallback
    const provider = await (factory as any).getProviderWithFailover();
    expect(provider.name).toBe('mock-places');
  });
});

describe('Provider Test Utilities', () => {
  it('should provide a test suite interface for providers', () => {
    const mockProvider = new MockPlacesProvider();
    
    const testSuite = {
      provider: mockProvider,
      config: { delay: 10 },
      expectations: {
        searchTests: [
          {
            query: { query: 'restaurant' },
            expectedMinResults: 1,
            expectedMaxResults: 20
          }
        ],
        errorTests: [
          {
            query: { query: '' },
            expectedError: 'invalid_request' as const
          }
        ]
      }
    };

    expect(testSuite.provider).toBe(mockProvider);
    expect(testSuite.expectations.searchTests).toHaveLength(1);
    expect(testSuite.expectations.errorTests).toHaveLength(1);
  });
});

describe('Integration Tests', () => {
  it('should work end-to-end with mock provider', async () => {
    // Set up factory with mock provider
    const factory = new DefaultProviderFactory();
    const mockProvider = new MockPlacesProvider();
    
    factory.register('mock', mockProvider);
    
    await factory.initialize({
      defaultProvider: 'mock',
      providers: {
        mock: {
          delay: 10,
          maxResults: 5
        }
      }
    });

    // Get provider and perform search
    const provider = factory.getProvider();
    const result = await provider.searchPlaces({
      query: 'coffee shops',
      limit: 3
    });

    // Verify end-to-end functionality
    expect(result.results).toHaveLength(3);
    expect(result.metadata.provider).toBe('mock-places');
    expect(result.query.query).toBe('coffee shops');

    // Clean up
    await factory.cleanup();
  });
});
