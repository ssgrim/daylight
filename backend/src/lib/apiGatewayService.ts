import {
  ApiKey,
  RateLimit,
  ApiUsage,
  RateLimitState,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  CreateRateLimitRequest
} from '../../../shared/src/types/api';
import {
  docClient,
  API_GATEWAY_CONFIG,
  API_KEY_PATTERNS,
  generateApiKeyId,
  generateUsageId,
  generateRateLimitId,
  generateSecureApiKey,
  hashApiKey,
  getApiKeyPreview,
  getCurrentDateString,
  getTimestamp,
  calculateTTL,
  validateApiKey,
  validateRateLimit,
  RateLimitingAlgorithms,
  ApiGatewayError,
  RateLimitExceededError,
  InvalidApiKeyError,
  InsufficientPermissionsError
} from './apiGatewayDb';
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';

// API Gateway Service
// Issue #114 - API Management & Rate Limiting

export class ApiGatewayService {
  private rateLimitStateCache = new Map<string, RateLimitState>();
  private rateLimitConfigCache = new Map<string, RateLimit[]>();
  private cacheExpiryMs = 300000; // 5 minutes

  // ===== API Key Management =====

  async createApiKey(userId: string, request: CreateApiKeyRequest): Promise<ApiKey> {
    const apiKeyId = generateApiKeyId();
    const key = generateSecureApiKey();
    const keyHash = hashApiKey(key);
    const keyPreview = getApiKeyPreview(key);
    const now = new Date().toISOString();

    const apiKey: ApiKey = {
      id: apiKeyId,
      name: request.name,
      key, // Return the actual key only once
      keyHash,
      keyPreview,
      userId,
      
      // Permissions & Access
      scopes: request.scopes,
      allowedEndpoints: request.allowedEndpoints || [],
      allowedMethods: request.allowedMethods || ['GET', 'POST'],
      ipWhitelist: request.ipWhitelist || [],
      
      // Rate Limiting - Apply default limits
      rateLimits: [],
      quotas: [],
      
      // Status & Lifecycle
      status: 'active',
      environment: API_GATEWAY_CONFIG.ENVIRONMENT as any,
      expiresAt: request.expiresAt,
      
      // Metadata
      description: request.description,
      tags: request.tags || {},
      createdAt: now,
      updatedAt: now,
      createdBy: userId
    };

    // Store in database
    const keys = API_KEY_PATTERNS.apiKey(apiKeyId);
    
    await docClient.send(new PutCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.API_KEYS,
      Item: {
        ...keys,
        ...apiKey,
        key: undefined, // Don't store the actual key
        keyHash // Store only the hash
      }
    }));

    // Also store by user for easy lookup
    const userKeys = API_KEY_PATTERNS.apiKeyByUser(userId, apiKeyId);
    
    await docClient.send(new PutCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.API_KEYS,
      Item: {
        ...userKeys,
        apiKeyId,
        name: apiKey.name,
        status: apiKey.status,
        createdAt: now
      }
    }));

    return apiKey;
  }

  async validateApiKey(keyString: string): Promise<{
    valid: boolean;
    apiKey?: ApiKey;
    reason?: string;
  }> {
    try {
      if (!validateApiKey(keyString)) {
        return { valid: false, reason: 'Invalid key format' };
      }

      const keyHash = hashApiKey(keyString);
      
      // Query by key hash (you'd need a GSI for this in production)
      const result = await docClient.send(new QueryCommand({
        TableName: API_GATEWAY_CONFIG.TABLES.API_KEYS,
        IndexName: 'KeyHashIndex', // Would need to create this GSI
        KeyConditionExpression: 'keyHash = :hash',
        ExpressionAttributeValues: {
          ':hash': keyHash
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return { valid: false, reason: 'API key not found' };
      }

      const apiKey = result.Items[0] as ApiKey;

      // Check if key is active
      if (apiKey.status !== 'active') {
        return { valid: false, reason: `API key is ${apiKey.status}` };
      }

      // Check expiration
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        return { valid: false, reason: 'API key has expired' };
      }

      // Update last used timestamp
      await this.updateApiKeyLastUsed(apiKey.id);

      return { valid: true, apiKey };
    } catch (error) {
      console.error('API key validation error:', error);
      return { valid: false, reason: 'Validation failed' };
    }
  }

  async updateApiKey(apiKeyId: string, updates: UpdateApiKeyRequest): Promise<ApiKey> {
    const keys = API_KEY_PATTERNS.apiKey(apiKeyId);
    
    const updateExpression: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (updates.name !== undefined) {
      updateExpression.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = updates.name;
    }

    if (updates.description !== undefined) {
      updateExpression.push('description = :description');
      expressionAttributeValues[':description'] = updates.description;
    }

    if (updates.scopes !== undefined) {
      updateExpression.push('scopes = :scopes');
      expressionAttributeValues[':scopes'] = updates.scopes;
    }

    if (updates.status !== undefined) {
      updateExpression.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updates.status;
    }

    if (updates.allowedEndpoints !== undefined) {
      updateExpression.push('allowedEndpoints = :allowedEndpoints');
      expressionAttributeValues[':allowedEndpoints'] = updates.allowedEndpoints;
    }

    if (updates.allowedMethods !== undefined) {
      updateExpression.push('allowedMethods = :allowedMethods');
      expressionAttributeValues[':allowedMethods'] = updates.allowedMethods;
    }

    if (updates.ipWhitelist !== undefined) {
      updateExpression.push('ipWhitelist = :ipWhitelist');
      expressionAttributeValues[':ipWhitelist'] = updates.ipWhitelist;
    }

    if (updates.expiresAt !== undefined) {
      updateExpression.push('expiresAt = :expiresAt');
      expressionAttributeValues[':expiresAt'] = updates.expiresAt;
    }

    if (updates.tags !== undefined) {
      updateExpression.push('tags = :tags');
      expressionAttributeValues[':tags'] = updates.tags;
    }

    updateExpression.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const result = await docClient.send(new UpdateCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.API_KEYS,
      Key: keys,
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ReturnValues: 'ALL_NEW'
    }));

    return result.Attributes as ApiKey;
  }

  async revokeApiKey(apiKeyId: string): Promise<void> {
    await this.updateApiKey(apiKeyId, { status: 'revoked' });
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.API_KEYS,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `user#${userId}`
      }
    }));

    return (result.Items || []) as ApiKey[];
  }

  private async updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
    const keys = API_KEY_PATTERNS.apiKey(apiKeyId);
    
    await docClient.send(new UpdateCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.API_KEYS,
      Key: keys,
      UpdateExpression: 'SET lastUsedAt = :lastUsedAt',
      ExpressionAttributeValues: {
        ':lastUsedAt': new Date().toISOString()
      }
    }));
  }

  // ===== Rate Limiting =====

  async createRateLimit(request: CreateRateLimitRequest): Promise<RateLimit> {
    const validation = validateRateLimit(request);
    if (!validation.valid) {
      throw new ApiGatewayError(
        `Invalid rate limit configuration: ${validation.errors.join(', ')}`,
        400
      );
    }

    const rateLimitId = generateRateLimitId();
    const now = new Date().toISOString();

    const rateLimit: RateLimit = {
      id: rateLimitId,
      name: request.name,
      algorithm: request.algorithm,
      requests: request.requests,
      windowMs: request.windowMs,
      scope: request.scope,
      endpoints: request.endpoints,
      methods: request.methods,
      action: request.action,
      enabled: true,
      priority: 100, // Default priority
      description: request.description,
      createdAt: now,
      updatedAt: now
    };

    // Store rate limit configuration
    const keys = API_KEY_PATTERNS.rateLimit(rateLimitId);
    
    await docClient.send(new PutCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMITS,
      Item: {
        ...keys,
        ...rateLimit
      }
    }));

    // Also store by scope for efficient lookup
    const scopeKeys = API_KEY_PATTERNS.rateLimitByScope(request.scope, rateLimitId);
    
    await docClient.send(new PutCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMITS,
      Item: {
        ...scopeKeys,
        rateLimitId,
        priority: rateLimit.priority
      }
    }));

    // Clear cache
    this.rateLimitConfigCache.clear();

    return rateLimit;
  }

  async checkRateLimit(
    identifier: string,
    endpoint: string,
    method: string,
    apiKey?: ApiKey
  ): Promise<{
    allowed: boolean;
    rateLimitHit: boolean;
    remaining: number;
    resetAt?: number;
    retryAfter?: number;
  }> {
    try {
      // Get applicable rate limits
      const rateLimits = await this.getApplicableRateLimits(endpoint, method, apiKey);
      
      if (rateLimits.length === 0) {
        return { allowed: true, rateLimitHit: false, remaining: Infinity };
      }

      // Check each rate limit (highest priority first)
      for (const rateLimit of rateLimits.sort((a, b) => b.priority - a.priority)) {
        const result = await this.checkSingleRateLimit(identifier, rateLimit);
        
        if (!result.allowed) {
          return {
            allowed: false,
            rateLimitHit: true,
            remaining: result.remaining,
            resetAt: result.resetAt,
            retryAfter: result.retryAfter
          };
        }
      }

      return { allowed: true, rateLimitHit: false, remaining: Infinity };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open in case of errors
      return { allowed: true, rateLimitHit: false, remaining: Infinity };
    }
  }

  private async getApplicableRateLimits(
    endpoint: string,
    method: string,
    apiKey?: ApiKey
  ): Promise<RateLimit[]> {
    const cacheKey = `${endpoint}:${method}:${apiKey?.id || 'anonymous'}`;
    
    if (this.rateLimitConfigCache.has(cacheKey)) {
      const cached = this.rateLimitConfigCache.get(cacheKey)!;
      return cached;
    }

    const rateLimits: RateLimit[] = [];

    // Get global rate limits
    const globalResult = await docClient.send(new QueryCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMITS,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'scope#global'
      }
    }));

    // Get API key specific limits
    let apiKeyResult;
    if (apiKey) {
      apiKeyResult = await docClient.send(new QueryCommand({
        TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMITS,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'scope#api_key'
        }
      }));
    }

    // Get endpoint specific limits
    const endpointResult = await docClient.send(new QueryCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMITS,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'scope#endpoint'
      }
    }));

    // Filter and collect applicable rate limits
    const allLimits = [
      ...(globalResult.Items || []),
      ...(apiKeyResult?.Items || []),
      ...(endpointResult.Items || [])
    ];

    for (const item of allLimits) {
      // Get full rate limit configuration
      const rateLimitResult = await docClient.send(new GetCommand({
        TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMITS,
        Key: API_KEY_PATTERNS.rateLimit(item.rateLimitId)
      }));

      if (rateLimitResult.Item) {
        const rateLimit = rateLimitResult.Item as RateLimit;
        
        if (this.isRateLimitApplicable(rateLimit, endpoint, method)) {
          rateLimits.push(rateLimit);
        }
      }
    }

    // Cache the result
    this.rateLimitConfigCache.set(cacheKey, rateLimits);
    setTimeout(() => this.rateLimitConfigCache.delete(cacheKey), this.cacheExpiryMs);

    return rateLimits;
  }

  private isRateLimitApplicable(
    rateLimit: RateLimit,
    endpoint: string,
    method: string
  ): boolean {
    if (!rateLimit.enabled) {
      return false;
    }

    // Check endpoint matching
    if (rateLimit.endpoints && rateLimit.endpoints.length > 0) {
      const matches = rateLimit.endpoints.some(pattern => {
        // Simple pattern matching - in production, use a proper matcher
        return endpoint.startsWith(pattern) || new RegExp(pattern).test(endpoint);
      });
      if (!matches) return false;
    }

    // Check method matching
    if (rateLimit.methods && rateLimit.methods.length > 0) {
      if (!rateLimit.methods.includes(method.toUpperCase())) {
        return false;
      }
    }

    return true;
  }

  private async checkSingleRateLimit(
    identifier: string,
    rateLimit: RateLimit
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt?: number;
    retryAfter?: number;
  }> {
    const stateKey = `${identifier}:${rateLimit.id}`;
    
    // Get current state
    let state = await this.getRateLimitState(identifier, rateLimit.algorithm);
    
    if (!state) {
      // Initialize new state
      state = {
        identifier,
        algorithm: rateLimit.algorithm,
        tokens: rateLimit.requests,
        requests: 0,
        lastRefill: new Date().toISOString(),
        windowStart: new Date().toISOString(),
        limit: rateLimit.requests,
        windowMs: rateLimit.windowMs,
        firstRequest: new Date().toISOString(),
        lastRequest: new Date().toISOString(),
        totalRequests: 0,
        expiresAt: new Date(Date.now() + API_GATEWAY_CONFIG.RATE_LIMITING.STATE_TTL_HOURS * 3600 * 1000).toISOString()
      };
    }

    // Apply rate limiting algorithm
    let result;
    const now = Date.now();

    switch (rateLimit.algorithm) {
      case 'token_bucket':
        const tokenResult = RateLimitingAlgorithms.tokenBucket(
          state.tokens,
          new Date(state.lastRefill).getTime(),
          rateLimit.requests,
          rateLimit.requests / (rateLimit.windowMs / 1000)
        );
        
        result = {
          allowed: tokenResult.allowed,
          remaining: tokenResult.tokens,
          resetAt: undefined,
          retryAfter: tokenResult.allowed ? undefined : Math.ceil(1000 / (rateLimit.requests / (rateLimit.windowMs / 1000)))
        };
        
        state.tokens = tokenResult.tokens;
        state.lastRefill = new Date(tokenResult.lastRefill).toISOString();
        break;

      case 'fixed_window':
        const windowResult = RateLimitingAlgorithms.fixedWindow(
          state.requests,
          new Date(state.windowStart).getTime(),
          rateLimit.windowMs,
          rateLimit.requests
        );
        
        result = {
          allowed: windowResult.allowed,
          remaining: rateLimit.requests - windowResult.requests,
          resetAt: windowResult.resetAt,
          retryAfter: windowResult.allowed ? undefined : windowResult.resetAt - now
        };
        
        state.requests = windowResult.requests;
        state.windowStart = new Date(windowResult.windowStart).toISOString();
        break;

      default:
        throw new ApiGatewayError(`Unsupported algorithm: ${rateLimit.algorithm}`);
    }

    // Update state
    state.lastRequest = new Date().toISOString();
    state.totalRequests += 1;
    
    await this.updateRateLimitState(state);

    return result;
  }

  private async getRateLimitState(
    identifier: string,
    algorithm: string
  ): Promise<RateLimitState | null> {
    const cacheKey = `${identifier}:${algorithm}`;
    
    if (this.rateLimitStateCache.has(cacheKey)) {
      return this.rateLimitStateCache.get(cacheKey)!;
    }

    const keys = API_KEY_PATTERNS.rateLimitState(identifier, algorithm);
    
    const result = await docClient.send(new GetCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMIT_STATE,
      Key: keys
    }));

    const state = result.Item as RateLimitState | null;
    
    if (state) {
      this.rateLimitStateCache.set(cacheKey, state);
      setTimeout(() => this.rateLimitStateCache.delete(cacheKey), 60000); // 1 minute cache
    }

    return state;
  }

  private async updateRateLimitState(state: RateLimitState): Promise<void> {
    const keys = API_KEY_PATTERNS.rateLimitState(state.identifier, state.algorithm);
    
    await docClient.send(new PutCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.RATE_LIMIT_STATE,
      Item: {
        ...keys,
        ...state,
        ttl: calculateTTL(API_GATEWAY_CONFIG.RATE_LIMITING.STATE_TTL_HOURS)
      }
    }));

    // Update cache
    const cacheKey = `${state.identifier}:${state.algorithm}`;
    this.rateLimitStateCache.set(cacheKey, state);
  }

  // ===== Usage Tracking =====

  async recordUsage(usage: Omit<ApiUsage, 'id' | 'timestamp' | 'date'>): Promise<void> {
    const usageId = generateUsageId();
    const timestamp = new Date();
    const date = getCurrentDateString();

    const apiUsage: ApiUsage = {
      ...usage,
      id: usageId,
      timestamp: timestamp.toISOString(),
      date
    };

    // Store usage record
    const keys = API_KEY_PATTERNS.apiUsage(date, timestamp.getTime(), usageId);
    
    await docClient.send(new PutCommand({
      TableName: API_GATEWAY_CONFIG.TABLES.API_USAGE,
      Item: {
        ...keys,
        ...apiUsage,
        ttl: calculateTTL(API_GATEWAY_CONFIG.ANALYTICS.RETENTION_DAYS * 24)
      }
    }));

    // Also store by API key for easier querying
    if (usage.apiKeyId) {
      const keyUsageKeys = API_KEY_PATTERNS.apiUsageByKey(usage.apiKeyId, timestamp.getTime(), usageId);
      
      await docClient.send(new PutCommand({
        TableName: API_GATEWAY_CONFIG.TABLES.API_USAGE,
        Item: {
          ...keyUsageKeys,
          ...apiUsage,
          ttl: calculateTTL(API_GATEWAY_CONFIG.ANALYTICS.RETENTION_DAYS * 24)
        }
      }));
    }
  }

  // ===== Permission Checking =====

  async checkPermissions(
    apiKey: ApiKey,
    endpoint: string,
    method: string,
    ipAddress?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check endpoint permissions
    if (apiKey.allowedEndpoints.length > 0) {
      const endpointAllowed = apiKey.allowedEndpoints.some(pattern => {
        return endpoint.startsWith(pattern) || new RegExp(pattern).test(endpoint);
      });
      
      if (!endpointAllowed) {
        return {
          allowed: false,
          reason: `Endpoint ${endpoint} not allowed for this API key`
        };
      }
    }

    // Check method permissions
    if (apiKey.allowedMethods.length > 0) {
      if (!apiKey.allowedMethods.includes(method.toUpperCase())) {
        return {
          allowed: false,
          reason: `Method ${method} not allowed for this API key`
        };
      }
    }

    // Check IP whitelist
    if (apiKey.ipWhitelist.length > 0 && ipAddress) {
      if (!apiKey.ipWhitelist.includes(ipAddress)) {
        return {
          allowed: false,
          reason: `IP address ${ipAddress} not in whitelist`
        };
      }
    }

    return { allowed: true };
  }

  // ===== Cleanup =====

  async cleanupExpiredStates(): Promise<void> {
    // This would be called periodically to clean up expired rate limit states
    // Implementation would scan for expired items and delete them
    console.log('Cleaning up expired rate limit states...');
  }
}

export const apiGatewayService = new ApiGatewayService();
