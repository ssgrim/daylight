/**
 * Pluggable Provider Interfaces for Daylight
 * 
 * This file defines the core interfaces that all providers must implement,
 * enabling runtime switching between different service providers.
 */

import { Location, PlaceResult } from '../types/api-schemas.js';

/**
 * Configuration for provider instances
 */
export interface ProviderConfig {
  /** API key or authentication token */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  baseDelay?: number;
  /** Custom endpoint URL (for testing/mocking) */
  endpoint?: string;
  /** Additional provider-specific options */
  options?: Record<string, any>;
}

/**
 * Search parameters for place queries
 */
export interface PlaceSearchParams {
  /** Search query string */
  query: string;
  /** Optional location bias for results */
  location?: Location;
  /** Radius in meters for location-based searches */
  radius?: number;
  /** Maximum number of results to return */
  limit?: number;
  /** Page offset for pagination (0-based) */
  offset?: number;
  /** Sort option for results */
  sort?: 'relevance' | 'rating' | 'distance' | 'name';
  /** Category filter */
  category?: string;
  /** Language code for results (e.g., 'en', 'es') */
  language?: string;
  /** Additional provider-specific parameters */
  extra?: Record<string, any>;
}

/**
 * Search result metadata
 */
export interface SearchMetadata {
  /** Provider that returned the results */
  provider: string;
  /** Time taken for the search (ms) */
  duration: number;
  /** Whether results came from cache */
  cached: boolean;
  /** Total results available (may be more than returned) */
  totalResults?: number;
  /** Current page (1-based) */
  page?: number;
  /** Results per page */
  pageSize?: number;
  /** Total pages available */
  totalPages?: number;
  /** Sort option used */
  sort?: string;
  /** Category filter used */
  category?: string;
  /** Rate limit information */
  rateLimit?: {
    remaining: number;
    resetTime: Date;
  };
}

/**
 * Standard search response from any provider
 */
export interface SearchResponse {
  /** Search parameters used */
  query: PlaceSearchParams;
  /** Normalized place results */
  results: PlaceResult[];
  /** Response metadata */
  metadata: SearchMetadata;
}

/**
 * Error types that providers can return
 */
export type ProviderErrorType = 
  | 'invalid_request'
  | 'authentication_failed'
  | 'rate_limit_exceeded'
  | 'service_unavailable'
  | 'timeout'
  | 'network_error'
  | 'quota_exceeded'
  | 'unknown_error';

/**
 * Standardized provider error
 */
export class ProviderError extends Error {
  public readonly type: ProviderErrorType;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly provider: string;
  public readonly originalError?: Error;

  constructor(
    type: ProviderErrorType,
    message: string,
    provider: string,
    statusCode: number = 500,
    retryable: boolean = false,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
    this.type = type;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.provider = provider;
    this.originalError = originalError;
  }
}

/**
 * Health check result for provider monitoring
 */
export interface HealthCheckResult {
  /** Provider identifier */
  provider: string;
  /** Whether the provider is healthy */
  healthy: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Additional health information */
  details?: {
    endpoint?: string;
    lastChecked: Date;
    errorCount?: number;
    rateLimitStatus?: string;
  };
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Core interface that all place search providers must implement
 */
export interface PlaceSearchProvider {
  /** Unique provider identifier */
  readonly name: string;
  
  /** Provider version */
  readonly version: string;
  
  /** Whether the provider is currently configured and ready */
  readonly isConfigured: boolean;

  /**
   * Initialize the provider with configuration
   * @param config Provider configuration options
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Search for places based on query parameters
   * @param params Search parameters
   * @returns Promise resolving to search results
   * @throws ProviderError on failure
   */
  searchPlaces(params: PlaceSearchParams): Promise<SearchResponse>;

  /**
   * Perform a health check on the provider
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Clean up resources (close connections, clear caches, etc.)
   */
  cleanup(): Promise<void>;
}

/**
 * Configuration for the provider factory
 */
export interface ProviderFactoryConfig {
  /** Default provider to use */
  defaultProvider: string;
  /** Configuration for each provider */
  providers: Record<string, ProviderConfig>;
  /** Fallback chain if primary provider fails */
  fallbacks?: string[];
  /** Enable automatic failover */
  enableFailover?: boolean;
}

/**
 * Provider factory interface for managing multiple providers
 */
export interface ProviderFactory {
  /**
   * Register a provider implementation
   * @param name Provider identifier
   * @param provider Provider implementation
   */
  register(name: string, provider: PlaceSearchProvider): void;

  /**
   * Get a configured provider instance
   * @param name Provider name (optional, uses default if not specified)
   * @returns Provider instance
   * @throws Error if provider not found or not configured
   */
  getProvider(name?: string): PlaceSearchProvider;

  /**
   * Get all available provider names
   * @returns Array of registered provider names
   */
  getAvailableProviders(): string[];

  /**
   * Check health of all or specific providers
   * @param providerNames Optional list of providers to check
   * @returns Health status for each provider
   */
  checkHealth(providerNames?: string[]): Promise<Record<string, HealthCheckResult>>;

  /**
   * Initialize all providers with their configurations
   * @param config Factory configuration
   */
  initialize(config: ProviderFactoryConfig): Promise<void>;
}

/**
 * Utility type for provider test suites
 */
export interface ProviderTestSuite {
  /** Provider instance to test */
  provider: PlaceSearchProvider;
  /** Test configuration */
  config: ProviderConfig;
  /** Expected behavior definitions */
  expectations: {
    /** Test queries and expected result counts */
    searchTests: Array<{
      query: PlaceSearchParams;
      expectedMinResults: number;
      expectedMaxResults: number;
    }>;
    /** Error conditions to test */
    errorTests: Array<{
      query: PlaceSearchParams;
      expectedError: ProviderErrorType;
    }>;
  };
}
