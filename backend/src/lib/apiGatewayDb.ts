import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand 
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// API Gateway Database Configuration
// Issue #114 - API Management & Rate Limiting

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ===== Table Configuration =====

export const API_GATEWAY_CONFIG = {
  // Environment
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  
  // Database Tables
  TABLES: {
    API_KEYS: process.env.API_KEYS_TABLE || 'daylight-api-keys',
    API_USAGE: process.env.API_USAGE_TABLE || 'daylight-api-usage',
    RATE_LIMITS: process.env.RATE_LIMITS_TABLE || 'daylight-rate-limits',
    RATE_LIMIT_STATE: process.env.RATE_LIMIT_STATE_TABLE || 'daylight-rate-limit-state',
    API_ANALYTICS: process.env.API_ANALYTICS_TABLE || 'daylight-api-analytics',
    API_PLANS: process.env.API_PLANS_TABLE || 'daylight-api-plans',
    API_SUBSCRIPTIONS: process.env.API_SUBSCRIPTIONS_TABLE || 'daylight-api-subscriptions',
    DEVELOPER_USERS: process.env.DEVELOPER_USERS_TABLE || 'daylight-developer-users'
  },
  
  // Rate Limiting
  RATE_LIMITING: {
    DEFAULT_ALGORITHM: 'token_bucket',
    DEFAULT_WINDOW_MS: 60000, // 1 minute
    DEFAULT_REQUESTS: 1000,
    MAX_BURST_MULTIPLIER: 2,
    CLEANUP_INTERVAL_MS: 300000, // 5 minutes
    STATE_TTL_HOURS: 24
  },
  
  // API Gateway
  GATEWAY: {
    MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
    DEFAULT_TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3,
    CORS_MAX_AGE: 86400, // 24 hours
    CACHE_DEFAULT_TTL: 300, // 5 minutes
    CACHE_MAX_SIZE: 1000 // Max cached responses
  },
  
  // Analytics
  ANALYTICS: {
    BATCH_SIZE: 100,
    BATCH_TIMEOUT_MS: 5000,
    RETENTION_DAYS: 90,
    AGGREGATION_INTERVALS: ['hour', 'day', 'week', 'month']
  },
  
  // Monitoring
  MONITORING: {
    METRICS_ENABLED: true,
    DETAILED_LOGGING: process.env.NODE_ENV !== 'production',
    ALERT_THRESHOLDS: {
      ERROR_RATE: 0.05, // 5%
      RESPONSE_TIME_P95: 5000, // 5 seconds
      RATE_LIMIT_HIT_RATE: 0.1 // 10%
    }
  },
  
  // DDoS Protection
  DDOS_PROTECTION: {
    ENABLED: true,
    THRESHOLD: 10000, // requests per window
    WINDOW_MS: 60000, // 1 minute
    BAN_DURATION_MS: 3600000, // 1 hour
    WHITELIST_IPS: ['127.0.0.1', '::1']
  }
};

// ===== Key Patterns =====

export const API_KEY_PATTERNS = {
  // API Keys Table
  apiKey: (keyId: string) => ({
    PK: `api_key#${keyId}`,
    SK: 'metadata',
    GSI1PK: `user#${keyId.split('#')[1] || 'unknown'}`, // Extract user ID
    GSI1SK: `api_key#${keyId}`
  }),
  
  apiKeyByUser: (userId: string, keyId: string) => ({
    PK: `user#${userId}`,
    SK: `api_key#${keyId}`,
    GSI1PK: `api_key#${keyId}`,
    GSI1SK: 'metadata'
  }),
  
  // API Usage Table
  apiUsage: (date: string, timestamp: number, usageId: string) => ({
    PK: `usage#${date}`,
    SK: `${timestamp}#${usageId}`,
    GSI1PK: `api_key#${usageId.split('#')[1] || 'unknown'}`,
    GSI1SK: `${timestamp}`
  }),
  
  apiUsageByKey: (apiKeyId: string, timestamp: number, usageId: string) => ({
    PK: `api_key#${apiKeyId}`,
    SK: `usage#${timestamp}#${usageId}`,
    GSI1PK: `usage#${new Date(timestamp).toISOString().split('T')[0]}`,
    GSI1SK: `${timestamp}#${usageId}`
  }),
  
  // Rate Limits Table
  rateLimit: (rateLimitId: string) => ({
    PK: `rate_limit#${rateLimitId}`,
    SK: 'config',
    GSI1PK: 'rate_limits',
    GSI1SK: `priority#${rateLimitId}`
  }),
  
  rateLimitByScope: (scope: string, rateLimitId: string) => ({
    PK: `scope#${scope}`,
    SK: `rate_limit#${rateLimitId}`,
    GSI1PK: `rate_limit#${rateLimitId}`,
    GSI1SK: 'config'
  }),
  
  // Rate Limit State Table
  rateLimitState: (identifier: string, algorithm: string) => ({
    PK: `state#${identifier}`,
    SK: `${algorithm}`,
    GSI1PK: `algorithm#${algorithm}`,
    GSI1SK: identifier
  }),
  
  // Analytics Table
  analytics: (metric: string, date: string, granularity: string) => ({
    PK: `analytics#${metric}#${granularity}`,
    SK: date,
    GSI1PK: `date#${date}`,
    GSI1SK: `${metric}#${granularity}`
  }),
  
  // API Plans Table
  apiPlan: (planId: string) => ({
    PK: `plan#${planId}`,
    SK: 'metadata',
    GSI1PK: 'plans',
    GSI1SK: `order#${planId}`
  }),
  
  // API Subscriptions Table
  subscription: (subscriptionId: string) => ({
    PK: `subscription#${subscriptionId}`,
    SK: 'metadata',
    GSI1PK: `user#${subscriptionId.split('#')[1] || 'unknown'}`,
    GSI1SK: `subscription#${subscriptionId}`
  }),
  
  subscriptionByUser: (userId: string, subscriptionId: string) => ({
    PK: `user#${userId}`,
    SK: `subscription#${subscriptionId}`,
    GSI1PK: `subscription#${subscriptionId}`,
    GSI1SK: 'metadata'
  }),
  
  // Developer Users Table
  developerUser: (userId: string) => ({
    PK: `dev_user#${userId}`,
    SK: 'profile',
    GSI1PK: `email#${userId}`, // For email lookups
    GSI1SK: 'profile'
  }),
  
  developerUserByEmail: (email: string) => ({
    PK: `email#${email}`,
    SK: 'profile',
    GSI1PK: `dev_user#${email}`,
    GSI1SK: 'profile'
  })
};

// ===== Utility Functions =====

export function generateApiKeyId(): string {
  return `ak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateUsageId(): string {
  return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRateLimitId(): string {
  return `rl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSubscriptionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getTimestamp(): number {
  return Date.now();
}

export function hashApiKey(key: string): string {
  // In production, use a proper hashing function like bcrypt
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateSecureApiKey(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('base64url');
}

export function getApiKeyPreview(key: string): string {
  return key.length > 4 ? `...${key.slice(-4)}` : key;
}

export function calculateTTL(hours: number): number {
  return Math.floor(Date.now() / 1000) + (hours * 3600);
}

// ===== Batch Processing =====

export async function batchProcessUsage<T>(
  items: T[],
  processor: (batch: T[]) => Promise<any[]>,
  batchSize: number = API_GATEWAY_CONFIG.ANALYTICS.BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
  }
}

// ===== Rate Limiting Algorithms =====

export class RateLimitingAlgorithms {
  
  static tokenBucket(
    currentTokens: number,
    lastRefill: number,
    capacity: number,
    refillRate: number,
    requested: number = 1
  ): { allowed: boolean; tokens: number; lastRefill: number } {
    const now = Date.now();
    const elapsed = Math.max(0, now - lastRefill);
    
    // Calculate tokens to add
    const tokensToAdd = Math.floor((elapsed / 1000) * refillRate);
    const newTokens = Math.min(capacity, currentTokens + tokensToAdd);
    
    if (newTokens >= requested) {
      return {
        allowed: true,
        tokens: newTokens - requested,
        lastRefill: now
      };
    }
    
    return {
      allowed: false,
      tokens: newTokens,
      lastRefill: now
    };
  }
  
  static fixedWindow(
    requests: number,
    windowStart: number,
    windowMs: number,
    limit: number,
    requested: number = 1
  ): { allowed: boolean; requests: number; windowStart: number; resetAt: number } {
    const now = Date.now();
    
    // Check if we're in a new window
    if (now - windowStart >= windowMs) {
      return {
        allowed: requested <= limit,
        requests: requested <= limit ? requested : requests,
        windowStart: now,
        resetAt: now + windowMs
      };
    }
    
    // Check if request fits in current window
    if (requests + requested <= limit) {
      return {
        allowed: true,
        requests: requests + requested,
        windowStart,
        resetAt: windowStart + windowMs
      };
    }
    
    return {
      allowed: false,
      requests,
      windowStart,
      resetAt: windowStart + windowMs
    };
  }
  
  static slidingWindow(
    requestTimes: number[],
    windowMs: number,
    limit: number
  ): { allowed: boolean; requestTimes: number[] } {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Remove requests outside the window
    const validRequests = requestTimes.filter(time => time > windowStart);
    
    if (validRequests.length < limit) {
      return {
        allowed: true,
        requestTimes: [...validRequests, now]
      };
    }
    
    return {
      allowed: false,
      requestTimes: validRequests
    };
  }
  
  static leakyBucket(
    queueSize: number,
    lastLeak: number,
    capacity: number,
    leakRate: number,
    requested: number = 1
  ): { allowed: boolean; queueSize: number; lastLeak: number } {
    const now = Date.now();
    const elapsed = Math.max(0, now - lastLeak);
    
    // Calculate items that have leaked out
    const leakedItems = Math.floor((elapsed / 1000) * leakRate);
    const newQueueSize = Math.max(0, queueSize - leakedItems);
    
    if (newQueueSize + requested <= capacity) {
      return {
        allowed: true,
        queueSize: newQueueSize + requested,
        lastLeak: now
      };
    }
    
    return {
      allowed: false,
      queueSize: newQueueSize,
      lastLeak: now
    };
  }
}

// ===== Validation =====

export function validateApiKey(key: string): boolean {
  // API key format: base64url, 32+ characters
  return /^[A-Za-z0-9_-]{32,}$/.test(key);
}

export function validateRateLimit(rateLimit: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!rateLimit.requests || rateLimit.requests <= 0) {
    errors.push('Requests must be a positive number');
  }
  
  if (!rateLimit.windowMs || rateLimit.windowMs <= 0) {
    errors.push('Window duration must be a positive number');
  }
  
  if (!['token_bucket', 'fixed_window', 'sliding_window', 'leaky_bucket'].includes(rateLimit.algorithm)) {
    errors.push('Invalid algorithm');
  }
  
  if (!['global', 'api_key', 'user', 'ip', 'endpoint'].includes(rateLimit.scope)) {
    errors.push('Invalid scope');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateEndpoint(endpoint: string): boolean {
  // Basic endpoint validation
  return /^\/[a-zA-Z0-9\/_-]*$/.test(endpoint);
}

export function validateHttpMethod(method: string): boolean {
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

// ===== Metrics Collection =====

export function collectApiMetrics(usage: any): any[] {
  const metrics = [];
  const timestamp = new Date().toISOString();
  
  // Request count metric
  metrics.push({
    name: 'api.requests.count',
    value: 1,
    unit: 'count',
    dimensions: {
      endpoint: usage.endpoint,
      method: usage.method,
      statusCode: usage.statusCode.toString(),
      apiKey: usage.apiKeyId
    },
    timestamp
  });
  
  // Response time metric
  metrics.push({
    name: 'api.requests.duration',
    value: usage.responseTime,
    unit: 'milliseconds',
    dimensions: {
      endpoint: usage.endpoint,
      method: usage.method,
      apiKey: usage.apiKeyId
    },
    timestamp
  });
  
  // Request size metric
  metrics.push({
    name: 'api.requests.size',
    value: usage.requestSize,
    unit: 'bytes',
    dimensions: {
      endpoint: usage.endpoint,
      method: usage.method,
      apiKey: usage.apiKeyId
    },
    timestamp
  });
  
  // Response size metric
  metrics.push({
    name: 'api.response.size',
    value: usage.responseSize,
    unit: 'bytes',
    dimensions: {
      endpoint: usage.endpoint,
      method: usage.method,
      statusCode: usage.statusCode.toString(),
      apiKey: usage.apiKeyId
    },
    timestamp
  });
  
  return metrics;
}

// ===== Error Handling =====

export class ApiGatewayError extends Error {
  public statusCode: number;
  public code: string;
  public details: Record<string, any>;
  
  constructor(
    message: string, 
    statusCode: number = 500, 
    code: string = 'API_GATEWAY_ERROR',
    details: Record<string, any> = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiGatewayError';
  }
}

export class RateLimitExceededError extends ApiGatewayError {
  constructor(
    limit: number,
    windowMs: number,
    retryAfter?: number,
    details: Record<string, any> = {}
  ) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      429,
      'RATE_LIMIT_EXCEEDED',
      {
        limit,
        windowMs,
        retryAfter,
        ...details
      }
    );
  }
}

export class InvalidApiKeyError extends ApiGatewayError {
  constructor(details: Record<string, any> = {}) {
    super(
      'Invalid or missing API key',
      401,
      'INVALID_API_KEY',
      details
    );
  }
}

export class InsufficientPermissionsError extends ApiGatewayError {
  constructor(requiredScopes: string[], details: Record<string, any> = {}) {
    super(
      `Insufficient permissions. Required scopes: ${requiredScopes.join(', ')}`,
      403,
      'INSUFFICIENT_PERMISSIONS',
      {
        requiredScopes,
        ...details
      }
    );
  }
}
