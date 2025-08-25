// API Management Types
// Issue #114 - API Management & Rate Limiting

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  keyHash: string;
  keyPreview: string; // Last 4 characters for display
  userId: string;
  organizationId?: string;
  
  // Permissions & Access
  scopes: string[];
  allowedEndpoints: string[];
  allowedMethods: string[];
  ipWhitelist: string[];
  
  // Rate Limiting
  rateLimits: RateLimit[];
  quotas: ApiQuota[];
  
  // Status & Lifecycle
  status: 'active' | 'suspended' | 'revoked';
  environment: 'development' | 'staging' | 'production';
  expiresAt?: string;
  lastUsedAt?: string;
  
  // Metadata
  description?: string;
  tags: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RateLimit {
  id: string;
  name: string;
  algorithm: 'token_bucket' | 'fixed_window' | 'sliding_window' | 'leaky_bucket';
  
  // Limit Configuration
  requests: number;
  windowMs: number;
  burstAllowed?: number;
  
  // Scope
  scope: 'global' | 'api_key' | 'user' | 'ip' | 'endpoint';
  endpoints?: string[];
  methods?: string[];
  
  // Actions on Limit Exceeded
  action: 'block' | 'throttle' | 'queue';
  blockDurationMs?: number;
  throttlePercentage?: number;
  queueMaxSize?: number;
  
  // Status
  enabled: boolean;
  priority: number; // Higher priority limits are checked first
  
  // Metadata
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiQuota {
  id: string;
  name: string;
  type: 'requests' | 'bandwidth' | 'compute' | 'storage';
  
  // Quota Limits
  limit: number;
  used: number;
  resetPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  resetAt: string;
  
  // Scope
  scope: 'global' | 'api_key' | 'user' | 'organization';
  
  // Overage Handling
  allowOverage: boolean;
  overageRate?: number; // Cost per unit over quota
  hardLimit?: number; // Absolute maximum
  
  // Status
  enabled: boolean;
  
  // Metadata
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiUsage {
  id: string;
  apiKeyId: string;
  userId: string;
  organizationId?: string;
  
  // Request Details
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  
  // Rate Limiting
  rateLimitHit: boolean;
  rateLimitRemaining: number;
  quotaUsed: Record<string, number>;
  
  // Geographic & Network
  ipAddress: string;
  userAgent: string;
  country?: string;
  region?: string;
  
  // Error Details
  errorCode?: string;
  errorMessage?: string;
  
  // Timing
  timestamp: string;
  date: string; // YYYY-MM-DD for partitioning
}

export interface ApiAnalytics {
  timeRange: {
    start: string;
    end: string;
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  
  // Volume Metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  
  // Performance Metrics
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Top Lists
  topEndpoints: Array<{ endpoint: string; requests: number; avgResponseTime: number }>;
  topUsers: Array<{ userId: string; requests: number }>;
  topErrors: Array<{ error: string; count: number }>;
  
  // Geographic Distribution
  requestsByCountry: Record<string, number>;
  requestsByRegion: Record<string, number>;
  
  // Time Series Data
  requestsOverTime: Array<{ timestamp: string; requests: number }>;
  responseTimeOverTime: Array<{ timestamp: string; avgResponseTime: number }>;
  errorsOverTime: Array<{ timestamp: string; errors: number }>;
}

export interface ApiGatewayConfig {
  // Gateway Settings
  gatewayId: string;
  name: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  
  // Routing Configuration
  routes: ApiRoute[];
  
  // Global Rate Limiting
  globalRateLimits: RateLimit[];
  
  // Security Settings
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  
  // Authentication
  authentication: {
    required: boolean;
    methods: ('api_key' | 'jwt' | 'oauth2')[];
    apiKeyHeader: string;
    apiKeyQuery: string;
  };
  
  // Monitoring & Logging
  monitoring: {
    enabled: boolean;
    logRequests: boolean;
    logResponses: boolean;
    logErrors: boolean;
    metricsEnabled: boolean;
    tracingEnabled: boolean;
  };
  
  // DDoS Protection
  ddosProtection: {
    enabled: boolean;
    threshold: number;
    windowMs: number;
    banDurationMs: number;
    whitelistedIPs: string[];
  };
  
  // Caching
  caching: {
    enabled: boolean;
    defaultTtl: number;
    maxSize: number;
    varyHeaders: string[];
  };
  
  // Transformations
  requestTransforms: ApiTransform[];
  responseTransforms: ApiTransform[];
  
  // Metadata
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRoute {
  id: string;
  path: string;
  methods: string[];
  
  // Backend Configuration
  backend: {
    type: 'lambda' | 'http' | 'mock';
    target: string;
    timeout: number;
    retries: number;
  };
  
  // Route-Specific Settings
  rateLimits: RateLimit[];
  authentication?: {
    required: boolean;
    scopes?: string[];
  };
  
  // Caching
  caching?: {
    enabled: boolean;
    ttl: number;
    varyHeaders: string[];
    cacheKey: string;
  };
  
  // Validation
  requestValidation?: {
    enabled: boolean;
    schema: any; // JSON Schema
  };
  
  responseValidation?: {
    enabled: boolean;
    schema: any; // JSON Schema
  };
  
  // Documentation
  documentation?: {
    summary: string;
    description: string;
    tags: string[];
    deprecated: boolean;
  };
  
  // Metadata
  enabled: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTransform {
  id: string;
  name: string;
  type: 'header' | 'query' | 'body' | 'path';
  operation: 'add' | 'remove' | 'modify' | 'rename';
  
  // Transform Configuration
  source?: string;
  target?: string;
  value?: string;
  condition?: string; // CEL expression
  
  // Metadata
  enabled: boolean;
  order: number;
  description?: string;
}

export interface DeveloperPortalUser {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  
  // Account Status
  status: 'active' | 'suspended' | 'pending_verification';
  emailVerified: boolean;
  
  // API Access
  apiKeys: string[]; // API Key IDs
  subscriptions: ApiSubscription[];
  
  // Usage & Billing
  currentUsage: Record<string, number>;
  billingEnabled: boolean;
  billingAddress?: any;
  paymentMethod?: any;
  
  // Preferences
  notifications: {
    usageAlerts: boolean;
    maintenanceNotices: boolean;
    newFeatures: boolean;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface ApiSubscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  
  // Subscription Details
  status: 'active' | 'cancelled' | 'suspended' | 'expired';
  startDate: string;
  endDate?: string;
  
  // Billing
  billingCycle: 'monthly' | 'yearly';
  price: number;
  currency: string;
  
  // Usage Limits
  quotas: ApiQuota[];
  rateLimits: RateLimit[];
  
  // Features
  features: string[];
  supportLevel: 'basic' | 'standard' | 'premium' | 'enterprise';
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  
  // Pricing
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  
  // Limits & Quotas
  quotas: ApiQuota[];
  rateLimits: RateLimit[];
  
  // Features
  features: string[];
  maxApiKeys: number;
  supportLevel: 'basic' | 'standard' | 'premium' | 'enterprise';
  
  // Access Control
  allowedEndpoints: string[];
  allowedMethods: string[];
  
  // Status
  status: 'active' | 'deprecated' | 'private';
  popular: boolean;
  
  // Metadata
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitState {
  identifier: string; // API key, user ID, IP, etc.
  algorithm: string;
  
  // Current State
  tokens: number;
  requests: number;
  lastRefill: string;
  windowStart: string;
  
  // Configuration
  limit: number;
  windowMs: number;
  burstAllowed?: number;
  
  // Metadata
  firstRequest: string;
  lastRequest: string;
  totalRequests: number;
  
  // Expiry for cleanup
  expiresAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  requestId?: string;
  timestamp: string;
}

export interface ApiMetrics {
  name: string;
  value: number;
  unit: string;
  dimensions: Record<string, string>;
  timestamp: string;
}

// Request/Response Types
export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  scopes: string[];
  allowedEndpoints?: string[];
  allowedMethods?: string[];
  ipWhitelist?: string[];
  expiresAt?: string;
  tags?: Record<string, string>;
}

export interface UpdateApiKeyRequest {
  name?: string;
  description?: string;
  scopes?: string[];
  allowedEndpoints?: string[];
  allowedMethods?: string[];
  ipWhitelist?: string[];
  status?: 'active' | 'suspended';
  expiresAt?: string;
  tags?: Record<string, string>;
}

export interface ApiUsageQuery {
  apiKeyId?: string;
  userId?: string;
  organizationId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  dateFrom: string;
  dateTo: string;
  limit?: number;
  offset?: number;
  groupBy?: 'hour' | 'day' | 'endpoint' | 'user';
}

export interface CreateRateLimitRequest {
  name: string;
  algorithm: 'token_bucket' | 'fixed_window' | 'sliding_window' | 'leaky_bucket';
  requests: number;
  windowMs: number;
  scope: 'global' | 'api_key' | 'user' | 'ip' | 'endpoint';
  endpoints?: string[];
  methods?: string[];
  action: 'block' | 'throttle' | 'queue';
  description?: string;
}

export interface ApiGatewayStats {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  activeApiKeys: number;
  rateLimitedRequests: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  requestsOverTime: Array<{ timestamp: string; requests: number }>;
}
