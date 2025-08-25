import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { apiGatewayService } from './apiGatewayService';
import { auditService } from './auditService';
import { securityMonitoringService } from './securityMonitoringService';
import { 
  ApiKey, 
  ApiUsage,
  ApiGatewayStats
} from '../../../shared/src/types/api';
import {
  API_GATEWAY_CONFIG,
  ApiGatewayError,
  RateLimitExceededError,
  InvalidApiKeyError,
  InsufficientPermissionsError,
  collectApiMetrics
} from './apiGatewayDb';

// API Gateway Middleware
// Issue #114 - API Management & Rate Limiting

export interface ApiGatewayContext {
  apiKey?: ApiKey;
  userId?: string;
  requestId: string;
  startTime: number;
  rateLimitRemaining: number;
  quotaUsed: Record<string, number>;
  ipAddress: string;
  userAgent: string;
  country?: string;
  region?: string;
}

export interface ApiGatewayMiddlewareConfig {
  requireApiKey?: boolean;
  rateLimitingEnabled?: boolean;
  analyticsEnabled?: boolean;
  corsEnabled?: boolean;
  validationEnabled?: boolean;
  cachingEnabled?: boolean;
  ddosProtectionEnabled?: boolean;
  requiredScopes?: string[];
  allowedMethods?: string[];
  customRateLimits?: string[]; // Rate limit IDs to apply
}

export type ApiGatewayHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  apiContext: ApiGatewayContext
) => Promise<APIGatewayProxyResult>;

export function withApiGateway(
  config: ApiGatewayMiddlewareConfig,
  handler: ApiGatewayHandler
) {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const requestId = context.awsRequestId;
    const ipAddress = event.requestContext.identity.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown';
    
    let apiKey: ApiKey | undefined;
    let apiContext: ApiGatewayContext = {
      requestId,
      startTime,
      rateLimitRemaining: Infinity,
      quotaUsed: {},
      ipAddress,
      userAgent
    };

    try {
      // 1. CORS handling
      if (config.corsEnabled && event.httpMethod === 'OPTIONS') {
        return createCorsResponse();
      }

      // 2. Request size validation
      if (event.body && Buffer.byteLength(event.body, 'utf8') > API_GATEWAY_CONFIG.GATEWAY.MAX_REQUEST_SIZE) {
        throw new ApiGatewayError('Request entity too large', 413, 'REQUEST_TOO_LARGE');
      }

      // 3. Method validation
      if (config.allowedMethods && !config.allowedMethods.includes(event.httpMethod)) {
        throw new ApiGatewayError(`Method ${event.httpMethod} not allowed`, 405, 'METHOD_NOT_ALLOWED');
      }

      // 4. DDoS protection
      if (config.ddosProtectionEnabled) {
        await checkDDoSProtection(ipAddress);
      }

      // 5. API key authentication
      if (config.requireApiKey) {
        apiKey = await authenticateApiKey(event);
        apiContext.apiKey = apiKey;
        apiContext.userId = apiKey.userId;

        // Check API key permissions
        const permissionResult = await apiGatewayService.checkPermissions(
          apiKey,
          event.path,
          event.httpMethod,
          ipAddress
        );

        if (!permissionResult.allowed) {
          throw new InsufficientPermissionsError(
            config.requiredScopes || [],
            { reason: permissionResult.reason }
          );
        }

        // Check required scopes
        if (config.requiredScopes && config.requiredScopes.length > 0) {
          const hasRequiredScopes = config.requiredScopes.every(scope => 
            apiKey.scopes.includes(scope)
          );
          
          if (!hasRequiredScopes) {
            throw new InsufficientPermissionsError(config.requiredScopes);
          }
        }
      }

      // 6. Rate limiting
      if (config.rateLimitingEnabled) {
        const identifier = apiKey ? apiKey.id : ipAddress;
        
        const rateLimitResult = await apiGatewayService.checkRateLimit(
          identifier,
          event.path,
          event.httpMethod,
          apiKey
        );

        if (!rateLimitResult.allowed) {
          // Record rate limit hit
          await recordUsage(event, apiContext, {
            statusCode: 429,
            responseTime: Date.now() - startTime,
            rateLimitHit: true,
            rateLimitRemaining: rateLimitResult.remaining
          });

          throw new RateLimitExceededError(
            0, // Will be filled from rate limit config
            0, // Will be filled from rate limit config
            rateLimitResult.retryAfter,
            {
              remaining: rateLimitResult.remaining,
              resetAt: rateLimitResult.resetAt
            }
          );
        }

        apiContext.rateLimitRemaining = rateLimitResult.remaining;
      }

      // 7. Geolocation (if available)
      if (event.requestContext.identity.sourceIp) {
        const geo = await getGeolocation(event.requestContext.identity.sourceIp);
        apiContext.country = geo?.country;
        apiContext.region = geo?.region;
      }

      // 8. Execute main handler
      let result: APIGatewayProxyResult;
      let handlerError: any = null;

      try {
        result = await handler(event, context, apiContext);
      } catch (error) {
        handlerError = error;
        throw error;
      } finally {
        // 9. Record usage analytics
        if (config.analyticsEnabled) {
          await recordUsage(event, apiContext, {
            statusCode: result?.statusCode || 500,
            responseTime: Date.now() - startTime,
            requestSize: event.body ? Buffer.byteLength(event.body, 'utf8') : 0,
            responseSize: result?.body ? Buffer.byteLength(result.body, 'utf8') : 0,
            rateLimitHit: false,
            rateLimitRemaining: apiContext.rateLimitRemaining,
            errorCode: handlerError?.code,
            errorMessage: handlerError?.message
          });
        }

        // 10. Security monitoring
        await checkForSecurityThreats(event, apiContext, result, handlerError);
      }

      // 11. Add API gateway headers
      result.headers = {
        ...result.headers,
        'X-Request-ID': requestId,
        'X-RateLimit-Remaining': apiContext.rateLimitRemaining.toString(),
        'X-API-Version': '1.0'
      };

      // 12. CORS headers
      if (config.corsEnabled) {
        result.headers = {
          ...result.headers,
          ...getCorsHeaders(event)
        };
      }

      return result;

    } catch (error) {
      console.error('API Gateway error:', error);

      // Record error usage
      if (config.analyticsEnabled) {
        await recordUsage(event, apiContext, {
          statusCode: error instanceof ApiGatewayError ? error.statusCode : 500,
          responseTime: Date.now() - startTime,
          requestSize: event.body ? Buffer.byteLength(event.body, 'utf8') : 0,
          responseSize: 0,
          rateLimitHit: error instanceof RateLimitExceededError,
          rateLimitRemaining: apiContext.rateLimitRemaining,
          errorCode: error.code || 'UNKNOWN_ERROR',
          errorMessage: error.message
        }).catch(recordError => {
          console.error('Failed to record error usage:', recordError);
        });
      }

      return createErrorResponse(error, requestId, config.corsEnabled ? event : undefined);
    }
  };
}

// ===== Authentication =====

async function authenticateApiKey(event: APIGatewayProxyEvent): Promise<ApiKey> {
  // Try header first
  let keyString = event.headers['X-API-Key'] || event.headers['x-api-key'];
  
  // Try Authorization header
  if (!keyString) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      keyString = authHeader.substring(7);
    }
  }
  
  // Try query parameter
  if (!keyString && event.queryStringParameters) {
    keyString = event.queryStringParameters.api_key || event.queryStringParameters.apikey;
  }

  if (!keyString) {
    throw new InvalidApiKeyError({ reason: 'API key not provided' });
  }

  const validation = await apiGatewayService.validateApiKey(keyString);
  
  if (!validation.valid) {
    throw new InvalidApiKeyError({ reason: validation.reason });
  }

  return validation.apiKey!;
}

// ===== Rate Limiting & DDoS Protection =====

async function checkDDoSProtection(ipAddress: string): Promise<void> {
  if (API_GATEWAY_CONFIG.DDOS_PROTECTION.WHITELIST_IPS.includes(ipAddress)) {
    return; // IP is whitelisted
  }

  // Check if IP is currently banned
  // In production, this would check Redis or DynamoDB for banned IPs
  
  // Simple DDoS detection based on request volume
  const identifier = `ddos:${ipAddress}`;
  
  const rateLimitResult = await apiGatewayService.checkRateLimit(
    identifier,
    '*', // All endpoints
    '*'  // All methods
  );

  if (!rateLimitResult.allowed) {
    // Log DDoS attempt
    await auditService.logEvent({
      eventType: 'security.ddos_attempt',
      resource: 'api_gateway',
      action: 'ddos_protection',
      outcome: 'blocked',
      details: {
        ipAddress,
        reason: 'Rate limit exceeded for DDoS protection'
      },
      riskLevel: 'high'
    }, { ipAddress });

    throw new RateLimitExceededError(
      API_GATEWAY_CONFIG.DDOS_PROTECTION.THRESHOLD,
      API_GATEWAY_CONFIG.DDOS_PROTECTION.WINDOW_MS,
      rateLimitResult.retryAfter,
      { reason: 'DDoS protection triggered' }
    );
  }
}

// ===== Usage Recording =====

async function recordUsage(
  event: APIGatewayProxyEvent,
  apiContext: ApiGatewayContext,
  metrics: {
    statusCode: number;
    responseTime: number;
    requestSize?: number;
    responseSize?: number;
    rateLimitHit: boolean;
    rateLimitRemaining: number;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    const usage: Omit<ApiUsage, 'id' | 'timestamp' | 'date'> = {
      apiKeyId: apiContext.apiKey?.id || 'anonymous',
      userId: apiContext.userId || 'anonymous',
      endpoint: event.path,
      method: event.httpMethod,
      statusCode: metrics.statusCode,
      responseTime: metrics.responseTime,
      requestSize: metrics.requestSize || 0,
      responseSize: metrics.responseSize || 0,
      rateLimitHit: metrics.rateLimitHit,
      rateLimitRemaining: metrics.rateLimitRemaining,
      quotaUsed: apiContext.quotaUsed,
      ipAddress: apiContext.ipAddress,
      userAgent: apiContext.userAgent,
      country: apiContext.country,
      region: apiContext.region,
      errorCode: metrics.errorCode,
      errorMessage: metrics.errorMessage
    };

    await apiGatewayService.recordUsage(usage);

    // Also collect metrics for monitoring
    if (API_GATEWAY_CONFIG.MONITORING.METRICS_ENABLED) {
      const metricsData = collectApiMetrics(usage);
      // In production, send these to CloudWatch or your metrics system
      console.log('API Metrics:', metricsData);
    }
  } catch (error) {
    console.error('Failed to record API usage:', error);
    // Don't throw - usage recording shouldn't break the API
  }
}

// ===== Security Monitoring =====

async function checkForSecurityThreats(
  event: APIGatewayProxyEvent,
  apiContext: ApiGatewayContext,
  result?: APIGatewayProxyResult,
  error?: any
): Promise<void> {
  try {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//,  // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /\/etc\/passwd/, // File access attempts
      /\.\.\\/, // Windows path traversal
    ];

    const requestPath = event.path + (event.rawQueryString ? '?' + event.rawQueryString : '');
    const requestBody = event.body || '';

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestPath) || pattern.test(requestBody)) {
        await securityMonitoringService.processSecurityEvent({
          eventType: 'security.attack_attempt',
          userId: apiContext.userId,
          sessionId: apiContext.requestId,
          resource: 'api_gateway',
          action: 'malicious_request',
          outcome: 'blocked',
          riskLevel: 'high',
          ipAddress: apiContext.ipAddress,
          userAgent: apiContext.userAgent,
          details: {
            endpoint: event.path,
            method: event.httpMethod,
            pattern: pattern.toString(),
            apiKeyId: apiContext.apiKey?.id
          },
          timestamp: new Date().toISOString()
        });
        break;
      }
    }

    // Check for error patterns that might indicate attacks
    if (error || (result && result.statusCode >= 400)) {
      // Count consecutive errors from same IP
      // In production, implement proper error tracking
    }
  } catch (monitoringError) {
    console.error('Security monitoring error:', monitoringError);
    // Don't throw - monitoring shouldn't break the API
  }
}

// ===== CORS Handling =====

function createCorsResponse(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-API-Key,Authorization',
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  };
}

function getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
  const origin = event.headers.Origin || event.headers.origin || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'X-Request-ID,X-RateLimit-Remaining'
  };
}

// ===== Error Handling =====

function createErrorResponse(
  error: any,
  requestId: string,
  corsEvent?: APIGatewayProxyEvent
): APIGatewayProxyResult {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details = {};

  if (error instanceof ApiGatewayError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
  }

  const response: APIGatewayProxyResult = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId
    },
    body: JSON.stringify({
      error: {
        code,
        message,
        details,
        requestId,
        timestamp: new Date().toISOString()
      }
    })
  };

  // Add CORS headers if needed
  if (corsEvent) {
    response.headers = {
      ...response.headers,
      ...getCorsHeaders(corsEvent)
    };
  }

  // Add rate limit headers if it's a rate limit error
  if (error instanceof RateLimitExceededError) {
    response.headers['X-RateLimit-Remaining'] = '0';
    if (error.details.retryAfter) {
      response.headers['Retry-After'] = error.details.retryAfter.toString();
    }
    if (error.details.resetAt) {
      response.headers['X-RateLimit-Reset'] = error.details.resetAt.toString();
    }
  }

  return response;
}

// ===== Geolocation =====

async function getGeolocation(ipAddress: string): Promise<{ country?: string; region?: string } | null> {
  // In production, integrate with a geolocation service like MaxMind
  // For now, return mock data
  if (ipAddress === '127.0.0.1' || ipAddress === '::1') {
    return { country: 'US', region: 'localhost' };
  }
  
  return null;
}

// ===== Pre-configured Middleware =====

export const requireApiKey = (config: Omit<ApiGatewayMiddlewareConfig, 'requireApiKey'> = {}) =>
  withApiGateway({ ...config, requireApiKey: true });

export const withRateLimiting = (config: Omit<ApiGatewayMiddlewareConfig, 'rateLimitingEnabled'> = {}) =>
  withApiGateway({ ...config, rateLimitingEnabled: true });

export const withAnalytics = (config: Omit<ApiGatewayMiddlewareConfig, 'analyticsEnabled'> = {}) =>
  withApiGateway({ ...config, analyticsEnabled: true });

export const withFullProtection = (config: ApiGatewayMiddlewareConfig = {}) =>
  withApiGateway({
    requireApiKey: true,
    rateLimitingEnabled: true,
    analyticsEnabled: true,
    corsEnabled: true,
    ddosProtectionEnabled: true,
    ...config
  });

// ===== Analytics Helpers =====

export async function getApiGatewayStats(
  timeRange: { start: string; end: string }
): Promise<ApiGatewayStats> {
  // This would query the usage analytics
  // For now, return mock data
  return {
    totalRequests: 0,
    successRate: 0,
    averageResponseTime: 0,
    activeApiKeys: 0,
    rateLimitedRequests: 0,
    topEndpoints: [],
    requestsOverTime: []
  };
}
