import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { apiGatewayService } from '../lib/apiGatewayService';
import { auditService } from '../lib/auditService';
import { withApiGateway, requireApiKey, withFullProtection } from '../lib/apiGatewayMiddleware';
import { 
  ApiKey, 
  ApiKeyRequest,
  ApiUsage,
  ApiAnalytics,
  RateLimitConfig,
  DeveloperPortalUser
} from '../../../shared/src/types/api';
import { ApiGatewayError } from '../lib/apiGatewayDb';

// API Gateway Handlers
// Issue #114 - API Management & Rate Limiting

// ===== Developer Portal APIs =====

export const createApiKey = withFullProtection({
  requiredScopes: ['api:keys:write']
})(async (event, context, apiContext) => {
  const request: ApiKeyRequest = JSON.parse(event.body || '{}');
  
  if (!request.name || !request.scopes) {
    throw new ApiGatewayError('Missing required fields: name, scopes', 400, 'INVALID_REQUEST');
  }

  // Validate scopes
  if (!Array.isArray(request.scopes) || request.scopes.length === 0) {
    throw new ApiGatewayError('Scopes must be a non-empty array', 400, 'INVALID_SCOPES');
  }

  const apiKey = await apiGatewayService.createApiKey({
    ...request,
    userId: apiContext.userId!,
    createdBy: apiContext.userId!
  });

  // Log API key creation
  await auditService.logEvent({
    eventType: 'api.key_created',
    resource: 'api_key',
    resourceId: apiKey.id,
    action: 'create',
    outcome: 'success',
    details: {
      name: apiKey.name,
      scopes: apiKey.scopes,
      ipAddress: apiContext.ipAddress
    }
  }, { userId: apiContext.userId });

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: {
        ...apiKey,
        keyValue: undefined // Don't include the actual key value in response
      },
      keyValue: apiKey.keyValue // Return separately for security
    })
  };
});

export const getApiKeys = withFullProtection({
  requiredScopes: ['api:keys:read']
})(async (event, context, apiContext) => {
  const { limit, offset, status } = event.queryStringParameters || {};
  
  const apiKeys = await apiGatewayService.getUserApiKeys(
    apiContext.userId!,
    {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      status: status as any
    }
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKeys: apiKeys.map(key => ({
        ...key,
        keyValue: undefined // Never return the actual key value
      }))
    })
  };
});

export const getApiKey = withFullProtection({
  requiredScopes: ['api:keys:read']
})(async (event, context, apiContext) => {
  const apiKeyId = event.pathParameters?.id;
  
  if (!apiKeyId) {
    throw new ApiGatewayError('API key ID is required', 400, 'MISSING_KEY_ID');
  }

  const apiKey = await apiGatewayService.getApiKey(apiKeyId);
  
  if (!apiKey) {
    throw new ApiGatewayError('API key not found', 404, 'KEY_NOT_FOUND');
  }

  // Check ownership
  if (apiKey.userId !== apiContext.userId) {
    throw new ApiGatewayError('Access denied', 403, 'ACCESS_DENIED');
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: {
        ...apiKey,
        keyValue: undefined // Never return the actual key value
      }
    })
  };
});

export const updateApiKey = withFullProtection({
  requiredScopes: ['api:keys:write']
})(async (event, context, apiContext) => {
  const apiKeyId = event.pathParameters?.id;
  const updates = JSON.parse(event.body || '{}');
  
  if (!apiKeyId) {
    throw new ApiGatewayError('API key ID is required', 400, 'MISSING_KEY_ID');
  }

  const existingKey = await apiGatewayService.getApiKey(apiKeyId);
  if (!existingKey || existingKey.userId !== apiContext.userId) {
    throw new ApiGatewayError('API key not found', 404, 'KEY_NOT_FOUND');
  }

  const updatedKey = await apiGatewayService.updateApiKey(apiKeyId, {
    ...updates,
    lastModifiedBy: apiContext.userId
  });

  // Log API key update
  await auditService.logEvent({
    eventType: 'api.key_updated',
    resource: 'api_key',
    resourceId: apiKeyId,
    action: 'update',
    outcome: 'success',
    details: {
      changes: updates,
      ipAddress: apiContext.ipAddress
    }
  }, { userId: apiContext.userId });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: {
        ...updatedKey,
        keyValue: undefined
      }
    })
  };
});

export const deleteApiKey = withFullProtection({
  requiredScopes: ['api:keys:write']
})(async (event, context, apiContext) => {
  const apiKeyId = event.pathParameters?.id;
  
  if (!apiKeyId) {
    throw new ApiGatewayError('API key ID is required', 400, 'MISSING_KEY_ID');
  }

  const existingKey = await apiGatewayService.getApiKey(apiKeyId);
  if (!existingKey || existingKey.userId !== apiContext.userId) {
    throw new ApiGatewayError('API key not found', 404, 'KEY_NOT_FOUND');
  }

  await apiGatewayService.deleteApiKey(apiKeyId);

  // Log API key deletion
  await auditService.logEvent({
    eventType: 'api.key_deleted',
    resource: 'api_key',
    resourceId: apiKeyId,
    action: 'delete',
    outcome: 'success',
    details: {
      name: existingKey.name,
      ipAddress: apiContext.ipAddress
    }
  }, { userId: apiContext.userId });

  return {
    statusCode: 204,
    headers: {},
    body: ''
  };
});

export const regenerateApiKey = withFullProtection({
  requiredScopes: ['api:keys:write']
})(async (event, context, apiContext) => {
  const apiKeyId = event.pathParameters?.id;
  
  if (!apiKeyId) {
    throw new ApiGatewayError('API key ID is required', 400, 'MISSING_KEY_ID');
  }

  const existingKey = await apiGatewayService.getApiKey(apiKeyId);
  if (!existingKey || existingKey.userId !== apiContext.userId) {
    throw new ApiGatewayError('API key not found', 404, 'KEY_NOT_FOUND');
  }

  const newKey = await apiGatewayService.regenerateApiKey(apiKeyId, apiContext.userId!);

  // Log API key regeneration
  await auditService.logEvent({
    eventType: 'api.key_regenerated',
    resource: 'api_key',
    resourceId: apiKeyId,
    action: 'regenerate',
    outcome: 'success',
    details: {
      name: existingKey.name,
      ipAddress: apiContext.ipAddress
    },
    riskLevel: 'medium'
  }, { userId: apiContext.userId });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: {
        ...newKey,
        keyValue: undefined
      },
      keyValue: newKey.keyValue
    })
  };
});

// ===== Usage Analytics APIs =====

export const getApiKeyUsage = withFullProtection({
  requiredScopes: ['api:analytics:read']
})(async (event, context, apiContext) => {
  const apiKeyId = event.pathParameters?.id;
  const { startDate, endDate, granularity } = event.queryStringParameters || {};
  
  if (!apiKeyId) {
    throw new ApiGatewayError('API key ID is required', 400, 'MISSING_KEY_ID');
  }

  // Verify ownership
  const apiKey = await apiGatewayService.getApiKey(apiKeyId);
  if (!apiKey || apiKey.userId !== apiContext.userId) {
    throw new ApiGatewayError('API key not found', 404, 'KEY_NOT_FOUND');
  }

  const usage = await apiGatewayService.getUsageAnalytics(apiKeyId, {
    startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    endDate: endDate || new Date().toISOString(),
    granularity: granularity as any || 'daily'
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usage })
  };
});

export const getUserAnalytics = withFullProtection({
  requiredScopes: ['api:analytics:read']
})(async (event, context, apiContext) => {
  const { startDate, endDate } = event.queryStringParameters || {};
  
  const analytics = await apiGatewayService.getUserAnalytics(apiContext.userId!, {
    startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: endDate || new Date().toISOString()
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analytics })
  };
});

export const getUsageQuota = withFullProtection({
  requiredScopes: ['api:analytics:read']
})(async (event, context, apiContext) => {
  const quotaInfo = await apiGatewayService.getQuotaUsage(apiContext.userId!);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quota: quotaInfo })
  };
});

// ===== Rate Limit Management APIs =====

export const getRateLimits = withFullProtection({
  requiredScopes: ['api:rate_limits:read']
})(async (event, context, apiContext) => {
  const rateLimits = await apiGatewayService.getUserRateLimits(apiContext.userId!);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rateLimits })
  };
});

export const updateRateLimit = withFullProtection({
  requiredScopes: ['api:rate_limits:write']
})(async (event, context, apiContext) => {
  const rateLimitId = event.pathParameters?.id;
  const updates: Partial<RateLimitConfig> = JSON.parse(event.body || '{}');
  
  if (!rateLimitId) {
    throw new ApiGatewayError('Rate limit ID is required', 400, 'MISSING_RATE_LIMIT_ID');
  }

  const rateLimit = await apiGatewayService.updateRateLimit(rateLimitId, updates);

  // Log rate limit update
  await auditService.logEvent({
    eventType: 'api.rate_limit_updated',
    resource: 'rate_limit',
    resourceId: rateLimitId,
    action: 'update',
    outcome: 'success',
    details: {
      changes: updates,
      ipAddress: apiContext.ipAddress
    }
  }, { userId: apiContext.userId });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rateLimit })
  };
});

// ===== Admin APIs (for API administrators) =====

export const getAllApiKeys = withFullProtection({
  requiredScopes: ['api:admin:read']
})(async (event, context, apiContext) => {
  const { limit, offset, userId, status } = event.queryStringParameters || {};
  
  const apiKeys = await apiGatewayService.getAllApiKeys({
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
    userId,
    status: status as any
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKeys: apiKeys.map(key => ({
        ...key,
        keyValue: undefined // Never return actual key values
      }))
    })
  };
});

export const getSystemAnalytics = withFullProtection({
  requiredScopes: ['api:admin:read']
})(async (event, context, apiContext) => {
  const { startDate, endDate } = event.queryStringParameters || {};
  
  const analytics = await apiGatewayService.getSystemAnalytics({
    startDate: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    endDate: endDate || new Date().toISOString()
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analytics })
  };
});

export const createRateLimit = withFullProtection({
  requiredScopes: ['api:admin:write']
})(async (event, context, apiContext) => {
  const rateLimitConfig: Omit<RateLimitConfig, 'id' | 'createdAt' | 'updatedAt'> = JSON.parse(event.body || '{}');
  
  if (!rateLimitConfig.name || !rateLimitConfig.algorithm) {
    throw new ApiGatewayError('Missing required fields: name, algorithm', 400, 'INVALID_REQUEST');
  }

  const rateLimit = await apiGatewayService.createRateLimit({
    ...rateLimitConfig,
    createdBy: apiContext.userId!
  });

  // Log rate limit creation
  await auditService.logEvent({
    eventType: 'api.rate_limit_created',
    resource: 'rate_limit',
    resourceId: rateLimit.id,
    action: 'create',
    outcome: 'success',
    details: {
      name: rateLimit.name,
      algorithm: rateLimit.algorithm,
      ipAddress: apiContext.ipAddress
    }
  }, { userId: apiContext.userId });

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rateLimit })
  };
});

export const deleteRateLimit = withFullProtection({
  requiredScopes: ['api:admin:write']
})(async (event, context, apiContext) => {
  const rateLimitId = event.pathParameters?.id;
  
  if (!rateLimitId) {
    throw new ApiGatewayError('Rate limit ID is required', 400, 'MISSING_RATE_LIMIT_ID');
  }

  await apiGatewayService.deleteRateLimit(rateLimitId);

  // Log rate limit deletion
  await auditService.logEvent({
    eventType: 'api.rate_limit_deleted',
    resource: 'rate_limit',
    resourceId: rateLimitId,
    action: 'delete',
    outcome: 'success',
    details: {
      ipAddress: apiContext.ipAddress
    }
  }, { userId: apiContext.userId });

  return {
    statusCode: 204,
    headers: {},
    body: ''
  };
});

// ===== API Documentation Endpoints =====

export const getApiDocumentation = withApiGateway({
  corsEnabled: true
})(async (event, context, apiContext) => {
  // This would return OpenAPI/Swagger documentation
  // For now, return a simple structure
  
  const documentation = {
    openapi: '3.0.0',
    info: {
      title: 'Daylight API',
      version: '1.0.0',
      description: 'Comprehensive API management and rate limiting system'
    },
    paths: {
      '/api/keys': {
        get: {
          summary: 'Get API keys',
          security: [{ ApiKeyAuth: [] }]
        },
        post: {
          summary: 'Create API key',
          security: [{ ApiKeyAuth: [] }]
        }
      },
      '/api/keys/{id}': {
        get: {
          summary: 'Get API key details',
          security: [{ ApiKeyAuth: [] }]
        },
        put: {
          summary: 'Update API key',
          security: [{ ApiKeyAuth: [] }]
        },
        delete: {
          summary: 'Delete API key',
          security: [{ ApiKeyAuth: [] }]
        }
      }
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    }
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(documentation)
  };
});

// ===== Health Check =====

export const healthCheck = withApiGateway({
  corsEnabled: true
})(async (event, context, apiContext) => {
  // Basic health check for the API gateway
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'healthy', // In production, check actual database connectivity
      authentication: 'healthy',
      rateLimiting: 'healthy'
    }
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(health)
  };
});

// ===== Test Endpoint (for validating API keys) =====

export const testApiKey = requireApiKey({
  corsEnabled: true,
  rateLimitingEnabled: true,
  analyticsEnabled: true
})(async (event, context, apiContext) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'API key is valid',
      apiKey: {
        id: apiContext.apiKey!.id,
        name: apiContext.apiKey!.name,
        scopes: apiContext.apiKey!.scopes
      },
      rateLimitRemaining: apiContext.rateLimitRemaining,
      requestId: apiContext.requestId
    })
  };
});
