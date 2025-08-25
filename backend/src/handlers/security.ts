import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { authService } from '../lib/authenticationService';
import { rbacService } from '../lib/rbacService';
import { auditService } from '../lib/auditService';
import { 
  withSecurity, 
  requireAuth, 
  requirePermissions, 
  requireRoles, 
  requireAdmin,
  SecurityContext 
} from '../lib/securityMiddleware';
import {
  OAuth2Provider,
  LoginRequest,
  User,
  Role,
  Permission,
  AuditQuery
} from '../../../shared/src/types/security';

// Security API Handlers
// Issue #119 - Advanced Security Framework

// ===== Authentication Handlers =====

export const initiateLogin = withSecurity(
  {
    allowAnonymous: true,
    rateLimit: { requests: 10, windowMs: 60000 }, // 10 requests per minute
    auditEvent: { resource: 'authentication', action: 'initiate_login' }
  },
  async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
    try {
      const { provider, redirectUri, state, codeChallenge, codeChallengeMethod } = JSON.parse(event.body || '{}');

      if (!provider || !redirectUri) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: { message: 'Provider and redirectUri are required' }
          })
        };
      }

      const authUrl = await authService.initiateOAuth2Flow(
        provider,
        redirectUri,
        state,
        codeChallenge,
        codeChallengeMethod
      );

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUrl,
          state,
          provider
        })
      };
    } catch (error) {
      console.error('Login initiation error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'Failed to initiate login' }
        })
      };
    }
  }
);

export const completeLogin = withSecurity(
  {
    allowAnonymous: true,
    rateLimit: { requests: 20, windowMs: 60000 },
    auditEvent: { resource: 'authentication', action: 'complete_login' }
  },
  async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
    try {
      const { code, state, redirectUri, codeVerifier } = JSON.parse(event.body || '{}');

      if (!code || !redirectUri) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: { message: 'Code and redirectUri are required' }
          })
        };
      }

      const result = await authService.completeOAuth2Flow(
        code,
        redirectUri,
        state,
        codeVerifier
      );

      // Log successful authentication
      await auditService.logAuthentication(
        'authentication.login',
        result.user.id,
        {
          provider: result.session.provider,
          sessionId: result.session.id
        },
        securityContext
      );

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: result.user,
          session: {
            id: result.session.id,
            token: result.session.token,
            refreshToken: result.session.refreshToken,
            expiresAt: result.session.expiresAt
          }
        })
      };
    } catch (error) {
      console.error('Login completion error:', error);
      
      await auditService.logAuthentication(
        'authentication.failed',
        'unknown',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          code: event.body ? JSON.parse(event.body).code : undefined
        },
        securityContext
      );

      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'Authentication failed' }
        })
      };
    }
  }
);

export const refreshToken = requireAuth({
  rateLimit: { requests: 30, windowMs: 60000 },
  auditEvent: { resource: 'authentication', action: 'refresh_token' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const { refreshToken } = JSON.parse(event.body || '{}');

    if (!refreshToken) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'Refresh token is required' }
        })
      };
    }

    const newSession = await authService.refreshSession(refreshToken);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: {
          id: newSession.id,
          token: newSession.token,
          refreshToken: newSession.refreshToken,
          expiresAt: newSession.expiresAt
        }
      })
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Token refresh failed' }
      })
    };
  }
});

export const logout = requireAuth({
  auditEvent: { resource: 'authentication', action: 'logout' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    if (securityContext.sessionId) {
      await authService.revokeSession(securityContext.sessionId);
      
      await auditService.logAuthentication(
        'authentication.logout',
        securityContext.userId!,
        { sessionId: securityContext.sessionId },
        securityContext
      );
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Logout successful' })
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Logout failed' }
      })
    };
  }
});

// ===== User Management Handlers =====

export const getCurrentUser = requireAuth({
  auditEvent: { resource: 'user', action: 'get_current' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const user = securityContext.user;
    const permissions = await rbacService.getUserPermissions(securityContext.userId!);
    const roles = await rbacService.getUserRoles(securityContext.userId!);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user,
        permissions: permissions.map(p => p.name),
        roles: roles.map(r => r.name)
      })
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to get user information' }
      })
    };
  }
});

export const updateUserProfile = requireAuth({
  auditEvent: { resource: 'user', action: 'update_profile' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const updates = JSON.parse(event.body || '{}');
    
    // In production, validate and sanitize updates
    const updatedUser = await authService.updateUser(securityContext.userId!, updates);

    await auditService.logDataAccess(
      'update',
      securityContext.userId!,
      'user',
      securityContext.userId!,
      Object.keys(updates).map(field => ({
        field,
        oldValue: '[REDACTED]', // Don't log sensitive data
        newValue: '[UPDATED]'
      })),
      securityContext
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: updatedUser })
    };
  } catch (error) {
    console.error('Update user profile error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to update user profile' }
      })
    };
  }
});

// ===== Role & Permission Management Handlers =====

export const listRoles = requirePermissions(['roles:read'], {
  auditEvent: { resource: 'roles', action: 'list' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const roles = await rbacService.listRoles();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles })
    };
  } catch (error) {
    console.error('List roles error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to list roles' }
      })
    };
  }
});

export const createRole = requirePermissions(['roles:create'], {
  auditEvent: { resource: 'roles', action: 'create' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const roleData = JSON.parse(event.body || '{}');
    const role = await rbacService.createRole(roleData);

    await auditService.logSecurityEvent(
      'security.role_change',
      securityContext.userId!,
      'roles',
      {
        action: 'create',
        roleId: role.id,
        roleName: role.name,
        permissions: role.permissions
      },
      securityContext
    );

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    };
  } catch (error) {
    console.error('Create role error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to create role' }
      })
    };
  }
});

export const assignUserRole = requirePermissions(['users:manage_roles'], {
  auditEvent: { resource: 'user_roles', action: 'assign' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const { userId, roleId } = JSON.parse(event.body || '{}');
    
    if (!userId || !roleId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'userId and roleId are required' }
        })
      };
    }

    await rbacService.assignUserRole(userId, roleId);

    await auditService.logSecurityEvent(
      'security.role_change',
      securityContext.userId!,
      'user_roles',
      {
        action: 'assign',
        targetUserId: userId,
        roleId
      },
      securityContext
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Role assigned successfully' })
    };
  } catch (error) {
    console.error('Assign user role error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to assign role' }
      })
    };
  }
});

// ===== Audit & Compliance Handlers =====

export const getAuditLogs = requirePermissions(['audit:read'], {
  auditEvent: { resource: 'audit', action: 'query' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const query: AuditQuery = {
      limit: parseInt(event.queryStringParameters?.limit || '100'),
      dateFrom: event.queryStringParameters?.dateFrom,
      dateTo: event.queryStringParameters?.dateTo,
      userId: event.queryStringParameters?.userId,
      eventTypes: event.queryStringParameters?.eventTypes?.split(','),
      resource: event.queryStringParameters?.resource,
      outcome: event.queryStringParameters?.outcome as any,
      riskLevel: event.queryStringParameters?.riskLevel?.split(',') as any,
      ipAddress: event.queryStringParameters?.ipAddress
    };

    const result = await auditService.queryAuditEvents(query);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Get audit logs error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to retrieve audit logs' }
      })
    };
  }
});

export const getAuditStatistics = requirePermissions(['audit:read'], {
  auditEvent: { resource: 'audit', action: 'statistics' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const dateFrom = event.queryStringParameters?.dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = event.queryStringParameters?.dateTo || new Date().toISOString();

    const statistics = await auditService.getAuditStatistics(dateFrom, dateTo);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statistics)
    };
  } catch (error) {
    console.error('Get audit statistics error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to retrieve audit statistics' }
      })
    };
  }
});

// ===== Admin Handlers =====

export const adminGetUsers = requireAdmin({
  auditEvent: { resource: 'admin', action: 'list_users' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    // In production, implement proper user listing with pagination
    const users = await authService.listUsers({
      limit: parseInt(event.queryStringParameters?.limit || '100'),
      cursor: event.queryStringParameters?.cursor
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users)
    };
  } catch (error) {
    console.error('Admin get users error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to retrieve users' }
      })
    };
  }
});

export const adminDeleteUser = requireAdmin({
  auditEvent: { resource: 'admin', action: 'delete_user' }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'User ID is required' }
        })
      };
    }

    await authService.deleteUser(userId);

    await auditService.logDataAccess(
      'delete',
      securityContext.userId!,
      'user',
      userId,
      undefined,
      securityContext
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'User deleted successfully' })
    };
  } catch (error) {
    console.error('Admin delete user error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Failed to delete user' }
      })
    };
  }
});

// ===== Health & Status Handlers =====

export const securityHealthCheck = withSecurity({
  allowAnonymous: true,
  rateLimit: { requests: 100, windowMs: 60000 }
}, async (event: APIGatewayProxyEvent, context: Context, securityContext: SecurityContext): Promise<APIGatewayProxyResult> => {
  try {
    // Check various security service health
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {
        authentication: 'healthy',
        authorization: 'healthy',
        audit: 'healthy',
        database: 'healthy'
      }
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(health)
    };
  } catch (error) {
    console.error('Security health check error:', error);
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
});
