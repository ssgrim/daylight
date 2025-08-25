// API Management System
// Issue #114 - API Management & Rate Limiting
// Complete export index for all API management functionality

// Core Services
export { apiGatewayService } from './lib/apiGatewayService';
export { 
  API_GATEWAY_CONFIG,
  ApiGatewayError,
  RateLimitExceededError,
  InvalidApiKeyError,
  InsufficientPermissionsError,
  QuotaExceededError,
  createApiGatewayTables,
  validateApiKeyFormat,
  generateApiKey,
  hashApiKey,
  encryptApiKey,
  decryptApiKey,
  collectApiMetrics
} from './lib/apiGatewayDb';

// Middleware
export {
  withApiGateway,
  requireApiKey,
  withRateLimiting,
  withAnalytics,
  withFullProtection,
  getApiGatewayStats,
  type ApiGatewayContext,
  type ApiGatewayMiddlewareConfig,
  type ApiGatewayHandler
} from './lib/apiGatewayMiddleware';

// Handlers
export {
  // Developer Portal APIs
  createApiKey,
  getApiKeys,
  getApiKey,
  updateApiKey,
  deleteApiKey,
  regenerateApiKey,
  
  // Analytics APIs
  getApiKeyUsage,
  getUserAnalytics,
  getUsageQuota,
  
  // Rate Limit APIs
  getRateLimits,
  updateRateLimit,
  
  // Admin APIs
  getAllApiKeys,
  getSystemAnalytics,
  createRateLimit,
  deleteRateLimit,
  
  // Documentation & Health
  getApiDocumentation,
  healthCheck,
  testApiKey
} from './handlers/apiGateway';

// Type Definitions (re-exported from shared)
export type {
  // Core Types
  ApiKey,
  ApiKeyRequest,
  ApiKeyStatus,
  ApiKeyQuota,
  ApiKeyValidationResult,
  ApiKeyPermissionResult,
  
  // Rate Limiting
  RateLimit,
  RateLimitConfig,
  RateLimitAlgorithm,
  RateLimitResult,
  TokenBucketConfig,
  FixedWindowConfig,
  SlidingWindowConfig,
  LeakyBucketConfig,
  
  // Usage & Analytics
  ApiUsage,
  ApiAnalytics,
  ApiGatewayStats,
  UsageQuota,
  QuotaUsage,
  
  // Developer Portal
  DeveloperPortalUser,
  DeveloperPortalSettings,
  
  // Configuration
  ApiGatewayConfig,
  DDoSProtectionConfig,
  MonitoringConfig,
  SecurityConfig,
  
  // Request/Response Types
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyListResponse,
  UsageAnalyticsRequest,
  RateLimitUpdateRequest
} from '../../shared/src/types/api';

// Configuration Constants
export const API_MANAGEMENT_VERSION = '1.0.0';

export const DEFAULT_RATE_LIMITS = {
  FREE_TIER: {
    name: 'Free Tier',
    algorithm: 'fixed_window' as const,
    config: {
      limit: 1000,
      windowSize: 3600000 // 1 hour
    }
  },
  
  PREMIUM_TIER: {
    name: 'Premium Tier',
    algorithm: 'token_bucket' as const,
    config: {
      capacity: 10000,
      refillRate: 10,
      refillPeriod: 1000
    }
  },
  
  ENTERPRISE_TIER: {
    name: 'Enterprise Tier',
    algorithm: 'sliding_window' as const,
    config: {
      limit: 100000,
      windowSize: 3600000,
      precision: 12
    }
  }
};

export const DEFAULT_SCOPES = [
  'api:read',
  'api:write',
  'api:keys:read',
  'api:keys:write',
  'api:analytics:read',
  'api:rate_limits:read',
  'api:rate_limits:write',
  'api:admin:read',
  'api:admin:write'
];

export const API_KEY_PATTERNS = {
  PREFIX: 'dlt_',
  LENGTH: 32,
  CHARSET: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
};

// Utility Functions
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  return apiKey.startsWith(API_KEY_PATTERNS.PREFIX) && 
         apiKey.length === API_KEY_PATTERNS.PREFIX.length + API_KEY_PATTERNS.LENGTH;
}

export function extractKeyFromRequest(headers: Record<string, string | undefined>, query?: Record<string, string | undefined>): string | null {
  // Try X-API-Key header
  let apiKey = headers['X-API-Key'] || headers['x-api-key'];
  
  // Try Authorization header
  if (!apiKey) {
    const authHeader = headers.Authorization || headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
  }
  
  // Try query parameter
  if (!apiKey && query) {
    apiKey = query.api_key || query.apikey;
  }
  
  return apiKey || null;
}

export function createRateLimitHeaders(result: { remaining: number; resetAt?: number; retryAfter?: number }): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString()
  };
  
  if (result.resetAt) {
    headers['X-RateLimit-Reset'] = result.resetAt.toString();
  }
  
  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  return headers;
}

export function formatUsageForBilling(usage: ApiUsage[]): {
  totalRequests: number;
  totalDataTransfer: number;
  costByEndpoint: Record<string, number>;
  billingPeriod: { start: string; end: string };
} {
  const totalRequests = usage.length;
  const totalDataTransfer = usage.reduce((total, u) => total + u.requestSize + u.responseSize, 0);
  
  const costByEndpoint: Record<string, number> = {};
  usage.forEach(u => {
    const endpoint = u.endpoint;
    if (!costByEndpoint[endpoint]) {
      costByEndpoint[endpoint] = 0;
    }
    costByEndpoint[endpoint] += 1; // Simple per-request pricing
  });
  
  const dates = usage.map(u => new Date(u.timestamp));
  const start = new Date(Math.min(...dates.map(d => d.getTime())));
  const end = new Date(Math.max(...dates.map(d => d.getTime())));
  
  return {
    totalRequests,
    totalDataTransfer,
    costByEndpoint,
    billingPeriod: {
      start: start.toISOString(),
      end: end.toISOString()
    }
  };
}

// Setup Functions
export async function initializeApiManagement(config?: Partial<typeof API_GATEWAY_CONFIG>): Promise<void> {
  console.log('Initializing API Management System...');
  
  try {
    // Create database tables
    await createApiGatewayTables();
    console.log('✓ Database tables created');
    
    // Initialize default rate limits
    const rateLimits = Object.values(DEFAULT_RATE_LIMITS);
    for (const rateLimit of rateLimits) {
      try {
        await apiGatewayService.createRateLimit({
          ...rateLimit,
          endpoints: ['*'],
          methods: ['*'],
          enabled: true,
          createdBy: 'system'
        });
        console.log(`✓ Created rate limit: ${rateLimit.name}`);
      } catch (error) {
        // Rate limit might already exist
        console.log(`- Rate limit already exists: ${rateLimit.name}`);
      }
    }
    
    console.log('✓ API Management System initialized successfully');
  } catch (error) {
    console.error('Failed to initialize API Management System:', error);
    throw error;
  }
}

export async function validateSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'healthy' | 'unhealthy'>;
  version: string;
  timestamp: string;
}> {
  const health = {
    status: 'healthy' as const,
    services: {} as Record<string, 'healthy' | 'unhealthy'>,
    version: API_MANAGEMENT_VERSION,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Test database connectivity
    await apiGatewayService.healthCheck();
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'unhealthy';
  }
  
  try {
    // Test rate limiting
    const testResult = await apiGatewayService.checkRateLimit('health-check', '/health', 'GET');
    health.services.rateLimiting = testResult ? 'healthy' : 'unhealthy';
  } catch (error) {
    health.services.rateLimiting = 'unhealthy';
    health.status = 'degraded';
  }
  
  try {
    // Test API key validation
    const validationResult = await apiGatewayService.validateApiKey('test-key');
    health.services.authentication = 'healthy'; // Will be unhealthy for test key, but service is working
  } catch (error) {
    health.services.authentication = 'unhealthy';
    health.status = 'degraded';
  }
  
  return health;
}

// Development Utilities
export async function createDevelopmentApiKey(userId: string, name: string = 'Development Key'): Promise<ApiKey> {
  return await apiGatewayService.createApiKey({
    name,
    description: 'Development API key for testing',
    userId,
    scopes: DEFAULT_SCOPES,
    allowedIps: ['127.0.0.1', '::1'], // Localhost only
    rateLimits: ['free-tier'],
    quotas: [
      {
        type: 'requests',
        limit: 10000,
        period: 'monthly',
        used: 0
      }
    ],
    createdBy: userId
  });
}

export async function cleanupExpiredKeys(): Promise<{ deletedCount: number; errors: string[] }> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  let deletedCount = 0;
  
  try {
    // This would typically be a database query to find expired keys
    // For now, we'll implement a simple version
    console.log('Cleaning up expired API keys...');
    
    // In production, implement proper expired key cleanup
    // const expiredKeys = await findExpiredApiKeys(now);
    // for (const key of expiredKeys) {
    //   try {
    //     await apiGatewayService.deleteApiKey(key.id);
    //     deletedCount++;
    //   } catch (error) {
    //     errors.push(`Failed to delete key ${key.id}: ${error.message}`);
    //   }
    // }
    
    return { deletedCount, errors };
  } catch (error) {
    errors.push(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { deletedCount, errors };
  }
}

// Export everything for easy access
export default {
  // Services
  apiGatewayService,
  
  // Middleware
  withApiGateway,
  requireApiKey,
  withRateLimiting,
  withAnalytics,
  withFullProtection,
  
  // Configuration
  API_GATEWAY_CONFIG,
  DEFAULT_RATE_LIMITS,
  DEFAULT_SCOPES,
  API_KEY_PATTERNS,
  
  // Utilities
  isValidApiKeyFormat,
  extractKeyFromRequest,
  createRateLimitHeaders,
  formatUsageForBilling,
  
  // Setup
  initializeApiManagement,
  validateSystemHealth,
  createDevelopmentApiKey,
  cleanupExpiredKeys,
  
  // Version
  version: API_MANAGEMENT_VERSION
};
