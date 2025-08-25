import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { authService } from './authenticationService';
import { rbacService } from './rbacService';
import { auditService } from './auditService';
import { SecurityError } from '../../../shared/src/types/security';

// Security Middleware for API Gateway
// Issue #119 - Advanced Security Framework

export interface SecurityMiddlewareConfig {
  requireAuth?: boolean;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  allowAnonymous?: boolean;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  auditEvent?: {
    resource: string;
    action: string;
  };
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  user?: any;
  session?: any;
  permissions: string[];
  roles: string[];
  ipAddress: string;
  userAgent: string;
  correlationId: string;
  traceId: string;
}

export type SecureHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  securityContext: SecurityContext
) => Promise<APIGatewayProxyResult>;

// Rate limiting storage (in production, use Redis or DynamoDB)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withSecurity(
  config: SecurityMiddlewareConfig,
  handler: SecureHandler
) {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const correlationId = generateCorrelationId();
    const traceId = event.headers['x-trace-id'] || correlationId;
    
    try {
      // 1. Extract request context
      const requestContext = extractRequestContext(event, correlationId, traceId);
      
      // 2. Rate limiting
      if (config.rateLimit) {
        await enforceRateLimit(requestContext.ipAddress, config.rateLimit);
      }

      // 3. Authentication (if required)
      let securityContext: SecurityContext = {
        permissions: [],
        roles: [],
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        correlationId,
        traceId
      };

      if (config.requireAuth && !config.allowAnonymous) {
        const authResult = await authenticateRequest(event);
        if (!authResult.success) {
          await auditService.logAuthentication(
            'authentication.failed',
            'unknown',
            { reason: authResult.error, endpoint: event.path },
            requestContext
          );
          
          return createErrorResponse(401, 'Authentication required', correlationId);
        }

        securityContext = {
          ...securityContext,
          userId: authResult.userId,
          sessionId: authResult.sessionId,
          user: authResult.user,
          session: authResult.session
        };

        // Get user permissions and roles
        if (authResult.userId) {
          const userPermissions = await rbacService.getUserPermissions(authResult.userId);
          const userRoles = await rbacService.getUserRoles(authResult.userId);
          
          securityContext.permissions = userPermissions.map(p => p.name);
          securityContext.roles = userRoles.map(r => r.name);
        }
      }

      // 4. Authorization (if permissions/roles required)
      if (config.requiredPermissions || config.requiredRoles) {
        const authzResult = await authorizeRequest(securityContext, config);
        if (!authzResult.authorized) {
          await auditService.logAuthorization(
            false,
            securityContext.userId || 'anonymous',
            config.auditEvent?.resource || event.path,
            config.auditEvent?.action || event.httpMethod,
            { 
              reason: authzResult.reason,
              requiredPermissions: config.requiredPermissions,
              requiredRoles: config.requiredRoles,
              userPermissions: securityContext.permissions,
              userRoles: securityContext.roles
            },
            requestContext
          );
          
          return createErrorResponse(403, 'Insufficient permissions', correlationId);
        }

        // Log successful authorization
        await auditService.logAuthorization(
          true,
          securityContext.userId || 'anonymous',
          config.auditEvent?.resource || event.path,
          config.auditEvent?.action || event.httpMethod,
          {
            requiredPermissions: config.requiredPermissions,
            requiredRoles: config.requiredRoles
          },
          requestContext
        );
      }

      // 5. Execute handler
      const startTime = Date.now();
      let result: APIGatewayProxyResult;
      let error: any = null;

      try {
        result = await handler(event, context, securityContext);
      } catch (handlerError) {
        error = handlerError;
        throw handlerError;
      } finally {
        // 6. Audit logging
        if (config.auditEvent) {
          const duration = Date.now() - startTime;
          await auditService.logEvent({
            eventType: error ? 'api.error' : 'api.success',
            resource: config.auditEvent.resource,
            action: config.auditEvent.action,
            outcome: error ? 'failure' : 'success',
            details: {
              endpoint: event.path,
              method: event.httpMethod,
              statusCode: result?.statusCode,
              duration,
              error: error?.message
            },
            riskLevel: error ? 'medium' : 'low'
          }, requestContext);
        }
      }

      // Add security headers
      result.headers = {
        ...result.headers,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'",
        'X-Correlation-ID': correlationId
      };

      return result;

    } catch (error) {
      console.error('Security middleware error:', error);
      
      // Log security error
      await auditService.logEvent({
        eventType: 'security.error',
        resource: 'api',
        action: 'middleware',
        outcome: 'failure',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint: event.path,
          method: event.httpMethod
        },
        riskLevel: 'high'
      }, {
        ipAddress: event.requestContext.identity.sourceIp,
        userAgent: event.headers['User-Agent'] || 'unknown',
        correlationId,
        traceId
      });

      if (error instanceof SecurityError) {
        return createErrorResponse(error.statusCode || 500, error.message, correlationId);
      }

      return createErrorResponse(500, 'Internal server error', correlationId);
    }
  };
}

// Authentication helper
async function authenticateRequest(event: APIGatewayProxyEvent): Promise<{
  success: boolean;
  userId?: string;
  sessionId?: string;
  user?: any;
  session?: any;
  error?: string;
}> {
  try {
    // Check for Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return { success: false, error: 'No authorization header' };
    }

    // Handle Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await authService.validateSession(token);
      
      if (!session) {
        return { success: false, error: 'Invalid or expired token' };
      }

      return {
        success: true,
        userId: session.userId,
        sessionId: session.id,
        session,
        user: session.user // Assuming session includes user data
      };
    }

    return { success: false, error: 'Unsupported authentication method' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Authentication error' 
    };
  }
}

// Authorization helper
async function authorizeRequest(
  securityContext: SecurityContext,
  config: SecurityMiddlewareConfig
): Promise<{ authorized: boolean; reason?: string }> {
  try {
    // Check required roles
    if (config.requiredRoles && config.requiredRoles.length > 0) {
      const hasRequiredRole = config.requiredRoles.some(role => 
        securityContext.roles.includes(role)
      );
      
      if (!hasRequiredRole) {
        return {
          authorized: false,
          reason: `Missing required role. Required: ${config.requiredRoles.join(', ')}`
        };
      }
    }

    // Check required permissions
    if (config.requiredPermissions && config.requiredPermissions.length > 0) {
      const hasRequiredPermissions = config.requiredPermissions.every(permission =>
        securityContext.permissions.includes(permission)
      );
      
      if (!hasRequiredPermissions) {
        return {
          authorized: false,
          reason: `Missing required permissions. Required: ${config.requiredPermissions.join(', ')}`
        };
      }
    }

    // For more complex authorization, use RBAC service
    if (securityContext.userId && (config.requiredPermissions || config.requiredRoles)) {
      const authorized = await rbacService.checkAccess(
        securityContext.userId,
        config.auditEvent?.resource || 'api',
        config.auditEvent?.action || 'access',
        {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          path: config.auditEvent?.resource
        }
      );

      if (!authorized) {
        return {
          authorized: false,
          reason: 'Access denied by authorization policy'
        };
      }
    }

    return { authorized: true };
  } catch (error) {
    return {
      authorized: false,
      reason: error instanceof Error ? error.message : 'Authorization error'
    };
  }
}

// Rate limiting helper
async function enforceRateLimit(
  identifier: string,
  config: { requests: number; windowMs: number }
): Promise<void> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Clean up old entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }

  const current = rateLimitStore.get(identifier);
  
  if (!current) {
    // First request in window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return;
  }

  if (current.resetTime < now) {
    // Window expired, reset
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return;
  }

  if (current.count >= config.requests) {
    throw new SecurityError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Increment counter
  current.count++;
  rateLimitStore.set(identifier, current);
}

// Helper functions
function extractRequestContext(
  event: APIGatewayProxyEvent,
  correlationId: string,
  traceId: string
) {
  return {
    ipAddress: event.requestContext.identity.sourceIp || 'unknown',
    userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown',
    correlationId,
    traceId
  };
}

function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createErrorResponse(
  statusCode: number,
  message: string,
  correlationId: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    },
    body: JSON.stringify({
      error: {
        message,
        correlationId,
        timestamp: new Date().toISOString()
      }
    })
  };
}

// Pre-configured middleware for common scenarios
export const requireAuth = (config: Omit<SecurityMiddlewareConfig, 'requireAuth'> = {}) =>
  withSecurity({ ...config, requireAuth: true });

export const requirePermissions = (
  permissions: string[],
  config: Omit<SecurityMiddlewareConfig, 'requiredPermissions'> = {}
) =>
  withSecurity({ ...config, requireAuth: true, requiredPermissions: permissions });

export const requireRoles = (
  roles: string[],
  config: Omit<SecurityMiddlewareConfig, 'requiredRoles'> = {}
) =>
  withSecurity({ ...config, requireAuth: true, requiredRoles: roles });

export const requireAdmin = (config: Omit<SecurityMiddlewareConfig, 'requiredRoles'> = {}) =>
  withSecurity({ ...config, requireAuth: true, requiredRoles: ['admin'] });

// Rate limiting middleware
export const withRateLimit = (
  requests: number,
  windowMs: number,
  config: Omit<SecurityMiddlewareConfig, 'rateLimit'> = {}
) =>
  withSecurity({ ...config, rateLimit: { requests, windowMs } });
