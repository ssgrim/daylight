/**
 * Provider Factory Implementation
 * 
 * Manages multiple place search providers and handles provider selection,
 * failover, and health monitoring.
 */

import {
  ProviderFactory,
  ProviderFactoryConfig,
  PlaceSearchProvider,
  HealthCheckResult,
  ProviderError
} from './interfaces.js';

/**
 * Default provider factory implementation
 */
export class DefaultProviderFactory implements ProviderFactory {
  private providers = new Map<string, PlaceSearchProvider>();
  private config?: ProviderFactoryConfig;
  private initialized = false;

  /**
   * Register a provider implementation
   */
  register(name: string, provider: PlaceSearchProvider): void {
    this.providers.set(name, provider);
    console.log(`[ProviderFactory] Registered provider: ${name}`);
  }

  /**
   * Get a configured provider instance
   */
  getProvider(name?: string): PlaceSearchProvider {
    if (!this.initialized) {
      throw new Error('Provider factory not initialized');
    }

    const providerName = name || this.config!.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider '${providerName}' not found. Available: ${this.getAvailableProviders().join(', ')}`);
    }

    if (!provider.isConfigured) {
      throw new Error(`Provider '${providerName}' is not properly configured`);
    }

    return provider;
  }

  /**
   * Get all available provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check health of providers
   */
  async checkHealth(providerNames?: string[]): Promise<Record<string, HealthCheckResult>> {
    const providersToCheck = providerNames || this.getAvailableProviders();
    const results: Record<string, HealthCheckResult> = {};

    // Run health checks in parallel
    const healthPromises = providersToCheck.map(async (name) => {
      const provider = this.providers.get(name);
      if (!provider) {
        results[name] = {
          provider: name,
          healthy: false,
          responseTime: 0,
          error: 'Provider not found'
        };
        return;
      }

      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        results[name] = {
          provider: name,
          healthy: false,
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    await Promise.all(healthPromises);
    return results;
  }

  /**
   * Initialize all providers with their configurations
   */
  async initialize(config: ProviderFactoryConfig): Promise<void> {
    this.config = config;

    // Initialize each configured provider
    const initPromises = Object.entries(config.providers).map(async ([name, providerConfig]) => {
      const provider = this.providers.get(name);
      if (!provider) {
        console.warn(`[ProviderFactory] Configuration found for unregistered provider: ${name}`);
        return;
      }

      try {
        await provider.initialize(providerConfig);
        console.log(`[ProviderFactory] Initialized provider: ${name}`);
      } catch (error) {
        console.error(`[ProviderFactory] Failed to initialize provider ${name}:`, error);
        throw error;
      }
    });

    await Promise.all(initPromises);

    // Verify default provider is available and configured
    if (!this.providers.has(config.defaultProvider)) {
      throw new Error(`Default provider '${config.defaultProvider}' is not registered`);
    }

    const defaultProvider = this.providers.get(config.defaultProvider)!;
    if (!defaultProvider.isConfigured) {
      throw new Error(`Default provider '${config.defaultProvider}' failed to initialize`);
    }

    this.initialized = true;
    console.log(`[ProviderFactory] Factory initialized with default provider: ${config.defaultProvider}`);
  }

  /**
   * Get provider with automatic failover support
   */
  async getProviderWithFailover(preferredProvider?: string): Promise<PlaceSearchProvider> {
    if (!this.initialized) {
      throw new Error('Provider factory not initialized');
    }

    const primaryProvider = preferredProvider || this.config!.defaultProvider;
    
    // Try to get the primary provider
    try {
      const provider = this.getProvider(primaryProvider);
      
      // Quick health check if failover is enabled
      if (this.config!.enableFailover) {
        const health = await provider.healthCheck();
        if (health.healthy) {
          return provider;
        }
        console.warn(`[ProviderFactory] Primary provider ${primaryProvider} unhealthy, attempting failover`);
      } else {
        return provider;
      }
    } catch (error) {
      if (!this.config!.enableFailover) {
        throw error;
      }
      console.warn(`[ProviderFactory] Primary provider ${primaryProvider} failed, attempting failover:`, error);
    }

    // Try fallback providers if enabled
    if (this.config!.enableFailover && this.config!.fallbacks) {
      for (const fallbackName of this.config!.fallbacks) {
        try {
          const fallbackProvider = this.getProvider(fallbackName);
          const health = await fallbackProvider.healthCheck();
          
          if (health.healthy) {
            console.log(`[ProviderFactory] Using fallback provider: ${fallbackName}`);
            return fallbackProvider;
          }
        } catch (error) {
          console.warn(`[ProviderFactory] Fallback provider ${fallbackName} failed:`, error);
          continue;
        }
      }
    }

    throw new ProviderError(
      'service_unavailable',
      'No healthy providers available',
      'factory',
      503,
      true
    );
  }

  /**
   * Clean up all providers
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.providers.values()).map(provider => 
      provider.cleanup().catch(error => {
        console.error(`[ProviderFactory] Error cleaning up provider ${provider.name}:`, error);
      })
    );

    await Promise.all(cleanupPromises);
    this.initialized = false;
    console.log('[ProviderFactory] All providers cleaned up');
  }

  /**
   * Get factory statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      registeredProviders: this.getAvailableProviders(),
      defaultProvider: this.config?.defaultProvider,
      fallbacksEnabled: this.config?.enableFailover || false,
      fallbackProviders: this.config?.fallbacks || []
    };
  }
}

/**
 * Global provider factory instance
 */
export const providerFactory = new DefaultProviderFactory();

/**
 * Helper function to configure providers from environment variables
 */
export function createProviderConfigFromEnv(): ProviderFactoryConfig {
  // Determine which provider to use
  const defaultProvider = process.env.PLACES_PROVIDER || 'google-places';
  
  // Enable failover in production
  const enableFailover = process.env.NODE_ENV === 'production' || 
                        process.env.ENABLE_PROVIDER_FAILOVER === 'true';

  const config: ProviderFactoryConfig = {
    defaultProvider,
    enableFailover,
    providers: {},
    fallbacks: []
  };

  // Google Places configuration
  if (process.env.GOOGLE_PLACES_API_KEY) {
    config.providers['google-places'] = {
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
      timeout: parseInt(process.env.GOOGLE_PLACES_TIMEOUT || '8000'),
      maxRetries: parseInt(process.env.GOOGLE_PLACES_MAX_RETRIES || '3'),
      baseDelay: parseInt(process.env.GOOGLE_PLACES_BASE_DELAY || '200'),
      options: {
        language: process.env.GOOGLE_PLACES_LANGUAGE || 'en',
        region: process.env.GOOGLE_PLACES_REGION
      }
    };

    // Add as fallback if not primary
    if (defaultProvider !== 'google-places') {
      config.fallbacks!.push('google-places');
    }
  }

  // Mock provider configuration (always available)
  config.providers['mock-places'] = {
    timeout: parseInt(process.env.MOCK_PROVIDER_DELAY || '100'),
    options: {
      simulateFailures: process.env.MOCK_SIMULATE_FAILURES === 'true',
      failureRate: parseFloat(process.env.MOCK_FAILURE_RATE || '0.1'),
      maxResults: parseInt(process.env.MOCK_MAX_RESULTS || '20')
    }
  };

  // Add mock as fallback in development
  if (process.env.NODE_ENV === 'development' && defaultProvider !== 'mock-places') {
    config.fallbacks!.push('mock-places');
  }

  return config;
}

/**
 * Initialize the global provider factory from environment variables
 */
export async function initializeProvidersFromEnv(): Promise<void> {
  const { GooglePlacesProvider } = await import('./google-places.js');
  const { MockPlacesProvider } = await import('./mock-places.js');

  // Register all available providers
  providerFactory.register('google-places', new GooglePlacesProvider());
  providerFactory.register('mock-places', new MockPlacesProvider());

  // Initialize with environment-based configuration
  const config = createProviderConfigFromEnv();
  await providerFactory.initialize(config);

  console.log(`[ProviderFactory] Initialized with config:`, {
    defaultProvider: config.defaultProvider,
    availableProviders: Object.keys(config.providers),
    failoverEnabled: config.enableFailover,
    fallbacks: config.fallbacks
  });
}
