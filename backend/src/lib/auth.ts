/**
 * JWT Authentication Middleware for AWS Cognito
 * 
 * Provides comprehensive JWT token validation and user authentication
 * for API Gateway Lambda functions using AWS Cognito User Pools
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { CognitoJwtVerifier } from 'aws-jwt-verify'

// Types
interface CognitoConfig {
  userPoolId: string
  userPoolClientId: string
  identityPoolId: string
  region: string
  domain: string
}

interface AuthenticatedUser {
  sub: string // Cognito user ID
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  preferred_username?: string
  'cognito:groups'?: string[]
  'cognito:username': string
  token_use: 'access' | 'id'
  iss: string
  aud: string
  exp: number
  iat: number
}

interface AuthContext {
  user: AuthenticatedUser
  token: string
  isAuthenticated: boolean
  groups: string[]
}

export interface AuthenticatedEvent extends APIGatewayProxyEventV2 {
  auth: AuthContext
}

// Cache for Cognito configuration and JWT verifier
let cognitoConfig: CognitoConfig | null = null
let jwtVerifier: CognitoJwtVerifier | null = null
const configCache = new Map<string, any>()
const CONFIG_TTL = 15 * 60 * 1000 // 15 minutes

/**
 * Get Cognito configuration from SSM
 */
async function getCognitoConfig(): Promise<CognitoConfig> {
  const cacheKey = 'cognito-config'
  const cached = configCache.get(cacheKey)
  
  if (cached && (Date.now() - cached.timestamp) < CONFIG_TTL) {
    return cached.config
  }

  try {
    const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-west-1' })
    const parameterName = `/daylight/${process.env.NODE_ENV || 'development'}/cognito/config`
    
    const command = new GetParameterCommand({ Name: parameterName })
    const response = await ssm.send(command)
    
    if (!response.Parameter?.Value) {
      throw new Error('Cognito configuration not found in SSM')
    }

    const config = JSON.parse(response.Parameter.Value) as CognitoConfig
    configCache.set(cacheKey, { config, timestamp: Date.now() })
    
    return config
  } catch (error) {
    console.error('Failed to get Cognito configuration:', error)
    throw new Error('Authentication configuration unavailable')
  }
}

/**
 * Initialize JWT verifier
 */
async function getJwtVerifier(): Promise<CognitoJwtVerifier> {
  if (jwtVerifier) {
    return jwtVerifier
  }

  const config = await getCognitoConfig()
  
  jwtVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.userPoolClientId,
  })

  return jwtVerifier
}

/**
 * Extract JWT token from event
 */
function extractToken(event: APIGatewayProxyEventV2): string | null {
  // Check Authorization header
  const authHeader = event.headers?.authorization || event.headers?.Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check query parameters
  const token = event.queryStringParameters?.token
  if (token) {
    return token
  }

  // Check cookies
  const cookies = event.cookies || []
  for (const cookie of cookies) {
    if (cookie.startsWith('accessToken=')) {
      return cookie.substring(12)
    }
  }

  return null
}

/**
 * Verify JWT token and extract user information
 */
async function verifyToken(token: string): Promise<AuthenticatedUser> {
  try {
    const verifier = await getJwtVerifier()
    const payload = await verifier.verify(token)
    
    return payload as AuthenticatedUser
  } catch (error) {
    console.warn('JWT verification failed:', error)
    throw new Error('Invalid or expired token')
  }
}

/**
 * Create authentication context
 */
function createAuthContext(user: AuthenticatedUser, token: string): AuthContext {
  return {
    user,
    token,
    isAuthenticated: true,
    groups: user['cognito:groups'] || []
  }
}

/**
 * Create unauthenticated context
 */
function createUnauthenticatedContext(): AuthContext {
  return {
    user: null as any,
    token: '',
    isAuthenticated: false,
    groups: []
  }
}

/**
 * Authentication middleware wrapper
 */
export function withAuth(
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResultV2>,
  options: {
    required?: boolean
    requiredGroups?: string[]
    requiredScopes?: string[]
  } = {}
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const { required = true, requiredGroups = [], requiredScopes = [] } = options

    try {
      // Handle preflight CORS requests
      if (event.requestContext.http.method === 'OPTIONS') {
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Max-Age': '3600'
          }
        }
      }

      const token = extractToken(event)
      let authContext: AuthContext

      if (token) {
        try {
          const user = await verifyToken(token)
          authContext = createAuthContext(user, token)

          // Check required groups
          if (requiredGroups.length > 0) {
            const hasRequiredGroup = requiredGroups.some(group => 
              authContext.groups.includes(group)
            )
            if (!hasRequiredGroup) {
              return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  error: 'Insufficient permissions',
                  message: `Required groups: ${requiredGroups.join(', ')}`
                })
              }
            }
          }

          // Check required scopes (if applicable)
          if (requiredScopes.length > 0) {
            // Implementation depends on how scopes are stored in your tokens
            console.log('Scope validation not yet implemented')
          }

        } catch (error) {
          if (required) {
            return {
              statusCode: 401,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                error: 'Authentication failed',
                message: error instanceof Error ? error.message : 'Invalid token'
              })
            }
          } else {
            authContext = createUnauthenticatedContext()
          }
        }
      } else {
        if (required) {
          return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'Authentication required',
              message: 'Missing authorization token'
            })
          }
        } else {
          authContext = createUnauthenticatedContext()
        }
      }

      // Add auth context to event
      const authenticatedEvent: AuthenticatedEvent = {
        ...event,
        auth: authContext
      }

      // Call the original handler
      const result = await handler(authenticatedEvent)

      // Add CORS headers to response
      return {
        ...result,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
          ...result.headers
        }
      }

    } catch (error) {
      console.error('Authentication middleware error:', error)
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Authentication system unavailable'
        })
      }
    }
  }
}

/**
 * Get current user information from authenticated event
 */
export function getCurrentUser(event: AuthenticatedEvent): AuthenticatedUser | null {
  return event.auth.isAuthenticated ? event.auth.user : null
}

/**
 * Check if user has specific group
 */
export function hasGroup(event: AuthenticatedEvent, group: string): boolean {
  return event.auth.groups.includes(group)
}

/**
 * Check if user has any of the specified groups
 */
export function hasAnyGroup(event: AuthenticatedEvent, groups: string[]): boolean {
  return groups.some(group => event.auth.groups.includes(group))
}

/**
 * Check if user is admin
 */
export function isAdmin(event: AuthenticatedEvent): boolean {
  return hasGroup(event, 'admin')
}

/**
 * Get user ID from authenticated event
 */
export function getUserId(event: AuthenticatedEvent): string | null {
  return event.auth.isAuthenticated ? event.auth.user.sub : null
}

/**
 * Create a response with authentication headers
 */
export function createAuthenticatedResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {}
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }
}

/**
 * Validate refresh token and return new access token
 */
export async function refreshToken(refreshToken: string): Promise<{
  accessToken: string
  idToken: string
  expiresIn: number
}> {
  try {
    const config = await getCognitoConfig()
    
    // Use Cognito InitiateAuth API to refresh tokens
    // This requires AWS SDK v3 Cognito Identity Provider client
    const { CognitoIdentityProviderClient, InitiateAuthCommand } = await import('@aws-sdk/client-cognito-identity-provider')
    
    const cognitoClient = new CognitoIdentityProviderClient({
      region: config.region
    })

    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: config.userPoolClientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    })

    const response = await cognitoClient.send(command)

    if (!response.AuthenticationResult) {
      throw new Error('Failed to refresh token')
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600
    }

  } catch (error) {
    console.error('Token refresh failed:', error)
    throw new Error('Failed to refresh authentication token')
  }
}

/**
 * Health check for authentication system
 */
export async function checkAuthHealth(): Promise<{
  status: 'healthy' | 'unhealthy'
  message: string
  details: Record<string, any>
}> {
  try {
    const config = await getCognitoConfig()
    const verifier = await getJwtVerifier()

    return {
      status: 'healthy',
      message: 'Authentication system is operational',
      details: {
        userPoolId: config.userPoolId,
        region: config.region,
        verifierInitialized: !!verifier
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Authentication system is unavailable',
      details: {
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// Export types for use in other modules
export type { AuthenticatedUser, AuthContext, AuthenticatedEvent }
