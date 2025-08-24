# Adding New Providers to Daylight

This guide explains how to implement and integrate new place search providers into the Daylight pluggable provider system.

## Table of Contents

- [Overview](#overview)
- [Provider Interface](#provider-interface)
- [Implementation Steps](#implementation-steps)
- [Testing Your Provider](#testing-your-provider)
- [Integration Steps](#integration-steps)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The Daylight provider system allows you to implement new place search providers that can be used interchangeably at runtime. All providers implement the same `PlaceSearchProvider` interface, ensuring consistent behavior and easy switching.

### Benefits of the Provider System

- **Runtime Switching**: Change providers without code changes
- **Failover Support**: Automatic fallback to backup providers
- **Consistent API**: All providers expose the same interface
- **Testing**: Easy to mock and test different providers
- **Extensibility**: Add new providers without modifying existing code

## Provider Interface

All providers must implement the `PlaceSearchProvider` interface:

```typescript
interface PlaceSearchProvider {
  readonly name: string;
  readonly version: string;
  readonly isConfigured: boolean;
  
  initialize(config: ProviderConfig): Promise<void>;
  searchPlaces(params: PlaceSearchParams): Promise<SearchResponse>;
  healthCheck(): Promise<HealthCheckResult>;
  cleanup(): Promise<void>;
}
```

### Key Components

1. **Identification**: `name` and `version` for provider identification
2. **Configuration**: `initialize()` method for setup with API keys, endpoints, etc.
3. **Search**: `searchPlaces()` method for the core functionality
4. **Monitoring**: `healthCheck()` for provider health monitoring
5. **Lifecycle**: `cleanup()` for resource cleanup

## Implementation Steps

### Step 1: Create Your Provider Class

Create a new file in `backend/src/providers/` (e.g., `my-provider.ts`):

```typescript
import {
  PlaceSearchProvider,
  ProviderConfig,
  PlaceSearchParams,
  SearchResponse,
  HealthCheckResult,
  ProviderError
} from './interfaces.js';
import { PlaceResult } from '../types/api-schemas.js';

export class MyProvider implements PlaceSearchProvider {
  public readonly name = 'my-provider';
  public readonly version = '1.0.0';
  
  private config?: MyProviderConfig;
  private initialized = false;

  public get isConfigured(): boolean {
    return this.initialized && !!this.config?.apiKey;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    // Validate required configuration
    if (!config.apiKey) {
      throw new ProviderError(
        'authentication_failed',
        'API key is required',
        this.name,
        401
      );
    }

    this.config = {
      timeout: 8000,
      maxRetries: 3,
      baseDelay: 200,
      endpoint: 'https://api.example.com',
      ...config
    } as MyProviderConfig;

    this.initialized = true;

    // Verify configuration with a test request
    await this.healthCheck();
  }

  async searchPlaces(params: PlaceSearchParams): Promise<SearchResponse> {
    if (!this.isConfigured) {
      throw new ProviderError(
        'invalid_request',
        'Provider not configured',
        this.name,
        500
      );
    }

    const startTime = Date.now();

    try {
      // Implement your search logic here
      const results = await this.performSearch(params);
      
      return {
        query: params,
        results,
        metadata: {
          provider: this.name,
          duration: Date.now() - startTime,
          cached: false,
          totalResults: results.length
        }
      };
    } catch (error) {
      // Handle and wrap errors appropriately
      throw this.wrapError(error);
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // Implement health check logic
    const startTime = Date.now();
    
    try {
      // Perform a simple test request
      await this.testConnection();
      
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
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cleanup(): Promise<void> {
    // Clean up resources (close connections, clear caches, etc.)
    this.initialized = false;
    this.config = undefined;
  }

  // Private helper methods
  private async performSearch(params: PlaceSearchParams): Promise<PlaceResult[]> {
    // Implement your provider-specific search logic
    // Return normalized PlaceResult[] array
  }

  private async testConnection(): Promise<void> {
    // Implement a simple connectivity test
  }

  private wrapError(error: any): ProviderError {
    // Convert provider-specific errors to ProviderError instances
    if (error instanceof ProviderError) {
      return error;
    }

    return new ProviderError(
      'unknown_error',
      error.message || 'Unknown error',
      this.name,
      500,
      true,
      error
    );
  }
}
```

### Step 2: Define Provider-Specific Configuration

Create a configuration interface for your provider:

```typescript
interface MyProviderConfig extends ProviderConfig {
  apiKey: string;
  endpoint?: string;
  // Add provider-specific options
  region?: string;
  language?: string;
  customOptions?: {
    enableCaching?: boolean;
    timeout?: number;
  };
}
```

### Step 3: Implement Search Logic

The `searchPlaces` method should:

1. **Validate parameters**: Check required fields
2. **Build API request**: Construct the appropriate API call
3. **Handle rate limiting**: Respect API limits
4. **Transform results**: Convert to standardized `PlaceResult[]` format
5. **Handle errors**: Wrap in `ProviderError` with appropriate types

```typescript
private async performSearch(params: PlaceSearchParams): Promise<PlaceResult[]> {
  // Build API URL
  const url = new URL(`${this.config!.endpoint}/search`);
  url.searchParams.set('query', params.query);
  url.searchParams.set('key', this.config!.apiKey);

  // Add optional parameters
  if (params.location) {
    url.searchParams.set('lat', params.location.lat.toString());
    url.searchParams.set('lng', params.location.lng.toString());
  }

  if (params.radius) {
    url.searchParams.set('radius', params.radius.toString());
  }

  // Make API request with retry logic
  const response = await this.makeRequest(url.toString());
  const data = await response.json();

  // Transform to standard format
  return this.transformResults(data);
}

private transformResults(apiResults: any[]): PlaceResult[] {
  return apiResults.map(result => ({
    name: result.name || 'Unknown',
    address: result.address || '',
    rating: result.rating ? Number(result.rating) : undefined,
    place_id: result.id || `${this.name}_${Date.now()}_${Math.random()}`,
    location: result.coordinates ? {
      lat: Number(result.coordinates.lat),
      lng: Number(result.coordinates.lng)
    } : undefined
  }));
}
```

### Step 4: Implement Error Handling

Map your provider's errors to standard `ProviderError` types:

```typescript
private wrapError(error: any): ProviderError {
  // Handle HTTP errors
  if (error.status) {
    switch (error.status) {
      case 401:
      case 403:
        return new ProviderError(
          'authentication_failed',
          'Invalid API credentials',
          this.name,
          error.status
        );
      case 429:
        return new ProviderError(
          'rate_limit_exceeded',
          'API rate limit exceeded',
          this.name,
          429,
          true // Retryable
        );
      case 500:
      case 502:
      case 503:
        return new ProviderError(
          'service_unavailable',
          'Provider service error',
          this.name,
          error.status,
          true // Retryable
        );
      default:
        return new ProviderError(
          'unknown_error',
          `HTTP ${error.status}: ${error.message}`,
          this.name,
          error.status
        );
    }
  }

  // Handle network errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new ProviderError(
      'network_error',
      'Network connection failed',
      this.name,
      500,
      true
    );
  }

  // Default error wrapper
  return new ProviderError(
    'unknown_error',
    error.message || 'Unknown error occurred',
    this.name,
    500,
    false,
    error
  );
}
```

## Testing Your Provider

### Step 1: Create Unit Tests

Create a test file `backend/test/my-provider.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MyProvider } from '../src/providers/my-provider.js';
import { ProviderError } from '../src/providers/interfaces.js';

describe('MyProvider', () => {
  let provider: MyProvider;

  beforeEach(() => {
    provider = new MyProvider();
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  it('should implement provider interface', () => {
    expect(provider.name).toBe('my-provider');
    expect(provider.version).toBe('1.0.0');
    expect(provider.isConfigured).toBe(false);
  });

  it('should require API key for initialization', async () => {
    await expect(provider.initialize({}))
      .rejects
      .toThrow(ProviderError);
  });

  it('should search for places when configured', async () => {
    // Mock API responses for testing
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            name: 'Test Place',
            address: '123 Test St',
            coordinates: { lat: 37.7749, lng: -122.4194 }
          }
        ]
      })
    });

    await provider.initialize({ apiKey: 'test-key' });
    
    const result = await provider.searchPlaces({
      query: 'restaurant',
      limit: 5
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('Test Place');
    expect(result.metadata.provider).toBe('my-provider');
  });

  it('should handle API errors gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });

    await provider.initialize({ apiKey: 'invalid-key' });

    await expect(provider.searchPlaces({ query: 'test' }))
      .rejects
      .toThrow(ProviderError);
  });
});
```

### Step 2: Integration Testing

Test your provider with the factory system:

```typescript
describe('MyProvider Integration', () => {
  it('should work with provider factory', async () => {
    const factory = new DefaultProviderFactory();
    const provider = new MyProvider();
    
    factory.register('my-provider', provider);
    
    await factory.initialize({
      defaultProvider: 'my-provider',
      providers: {
        'my-provider': {
          apiKey: process.env.MY_PROVIDER_API_KEY || 'test-key'
        }
      }
    });

    const searchProvider = factory.getProvider();
    const result = await searchProvider.searchPlaces({
      query: 'coffee shop'
    });

    expect(result.results.length).toBeGreaterThan(0);
  });
});
```

## Integration Steps

### Step 1: Register Your Provider

Add your provider to the factory initialization in `factory.ts`:

```typescript
// Import your provider
import { MyProvider } from './my-provider.js';

export async function initializeProvidersFromEnv(): Promise<void> {
  // ... existing providers ...
  
  // Register your provider
  providerFactory.register('my-provider', new MyProvider());
  
  // ... rest of initialization
}
```

### Step 2: Add Environment Configuration

Update the `createProviderConfigFromEnv` function:

```typescript
export function createProviderConfigFromEnv(): ProviderFactoryConfig {
  // ... existing configuration ...
  
  // Add your provider configuration
  if (process.env.MY_PROVIDER_API_KEY) {
    config.providers['my-provider'] = {
      apiKey: process.env.MY_PROVIDER_API_KEY,
      timeout: parseInt(process.env.MY_PROVIDER_TIMEOUT || '8000'),
      options: {
        region: process.env.MY_PROVIDER_REGION,
        language: process.env.MY_PROVIDER_LANGUAGE || 'en'
      }
    };
  }
  
  return config;
}
```

### Step 3: Update Environment Variables

Add environment variables for your provider:

```bash
# Environment variables for MyProvider
MY_PROVIDER_API_KEY=your_api_key_here
MY_PROVIDER_TIMEOUT=8000
MY_PROVIDER_REGION=us
MY_PROVIDER_LANGUAGE=en

# Set as default provider (optional)
PLACES_PROVIDER=my-provider

# Enable failover with your provider
ENABLE_PROVIDER_FAILOVER=true
```

### Step 4: Update Documentation

Add your provider to the environment variables documentation and setup guides.

## Best Practices

### Error Handling

1. **Use appropriate error types**: Map errors to correct `ProviderErrorType`
2. **Mark retryable errors**: Set `retryable: true` for transient failures
3. **Preserve original errors**: Include original error in `ProviderError`
4. **Handle timeouts**: Implement proper timeout handling

### Performance

1. **Implement caching**: Use HTTP caching headers if available
2. **Connection pooling**: Reuse connections when possible
3. **Rate limiting**: Respect API rate limits
4. **Pagination**: Handle large result sets efficiently

### Configuration

1. **Validate required fields**: Check API keys and required configuration
2. **Provide defaults**: Set sensible defaults for optional parameters
3. **Environment variables**: Support configuration via environment variables
4. **Secrets management**: Use secure storage for API keys

### Testing

1. **Mock external APIs**: Don't make real API calls in unit tests
2. **Test error conditions**: Cover all error scenarios
3. **Integration tests**: Test with real APIs in integration environment
4. **Performance tests**: Verify response times and rate limits

## Examples

### Example: Foursquare Provider

```typescript
export class FoursquareProvider implements PlaceSearchProvider {
  public readonly name = 'foursquare';
  public readonly version = '1.0.0';
  
  // Implementation following the pattern above
  // with Foursquare-specific API calls and transformations
}
```

### Example: Yelp Provider

```typescript
export class YelpProvider implements PlaceSearchProvider {
  public readonly name = 'yelp';
  public readonly version = '1.0.0';
  
  // Implementation with Yelp Fusion API
  // Handle OAuth authentication and business search
}
```

### Example: HERE Places Provider

```typescript
export class HEREPlacesProvider implements PlaceSearchProvider {
  public readonly name = 'here-places';
  public readonly version = '1.0.0';
  
  // Implementation with HERE Places API
  // Support for geocoding and place discovery
}
```

## Provider-Specific Features

### Supporting Provider-Specific Parameters

Use the `extra` field in `PlaceSearchParams` for provider-specific options:

```typescript
async searchPlaces(params: PlaceSearchParams): Promise<SearchResponse> {
  // Extract provider-specific parameters
  const providerOptions = params.extra || {};
  
  // Example: Foursquare categories
  if (providerOptions.categoryId) {
    url.searchParams.set('categoryId', providerOptions.categoryId);
  }
  
  // Example: Yelp price range
  if (providerOptions.price) {
    url.searchParams.set('price', providerOptions.price);
  }
}
```

### Advanced Features

1. **Autocomplete**: Implement search suggestions
2. **Details**: Support place detail lookups
3. **Photos**: Include place photos in results
4. **Reviews**: Add review/rating information
5. **Real-time data**: Include open hours, busy times

---

For more examples and advanced patterns, see the existing `GooglePlacesProvider` and `MockPlacesProvider` implementations in the codebase.
