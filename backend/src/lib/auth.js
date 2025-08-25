import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { warn, error, info } from './logger.mjs'

// Cognito configuration from environment
const COGNITO_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2'
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID

// JWKS client for Cognito
let jwksClientInstance = null

function getJwksClient() {
  if (!jwksClientInstance && COGNITO_USER_POOL_ID) {
    // Initialize JWKS client for JWT verification
const jwksClient = jwks({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000 // 10 minutes
})
    jwksClientInstance = jwksClient({
      jwksUri,
      requestHeaders: {},
      timeout: 30000,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000 // 10 minutes
    })
  }
  return jwksClientInstance
}

/**
 * Get the signing key for JWT verification
 */
function getKey(header, callback) {
  const client = getJwksClient()
  if (!client) {
    return callback(new Error('JWKS client not initialized'))
  }
  
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err)
    }
    const signingKey = key.publicKey || key.rsaPublicKey
    callback(null, signingKey)
  })
}

/**
 * Verify JWT token from Cognito
 * @param {string} token - JWT token from Authorization header
 * @returns {Promise<Object>} - Decoded token payload
 */
export async function verifyJWT(token) {
  if (!token) {
    throw new Error('No token provided')
  }

  if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
    throw new Error('Cognito configuration missing')
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: COGNITO_CLIENT_ID,
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        reject(new Error(`JWT verification failed: ${err.message}`))
      } else {
        resolve(decoded)
      }
    })
  })
}

/**
 * Extract JWT token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - JWT token or null
 */
export function extractToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/**
 * Get user role from JWT claims
 * @param {Object} decodedToken - Decoded JWT payload
 * @returns {string} - User role (viewer, editor, owner)
 */
export function getUserRole(decodedToken) {
  // Role can be in custom attributes or token scope
  const role = decodedToken['custom:user_role'] || 
               decodedToken.user_role ||
               decodedToken['cognito:groups']?.[0] ||
               'viewer' // default role
  
  // Validate role
  const validRoles = ['viewer', 'editor', 'owner']
  return validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : 'viewer'
}

/**
 * Check if user has required permission
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role for operation
 * @returns {boolean} - Whether user has permission
 */
export function hasPermission(userRole, requiredRole) {
  const roleHierarchy = {
    viewer: 1,
    editor: 2,
    owner: 3
  }
  
  const userLevel = roleHierarchy[userRole] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0
  
  return userLevel >= requiredLevel
}

/**
 * Middleware function to validate JWT and extract user info
 * @param {Object} event - Lambda event object
 * @returns {Promise<Object>} - User info object
 */
export async function authenticateUser(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization
    const token = extractToken(authHeader)
    
    if (!token) {
      throw new Error('No authorization token provided')
    }

    const decodedToken = await verifyJWT(token)
    const role = getUserRole(decodedToken)
    
    return {
      userId: decodedToken.sub,
      email: decodedToken.email,
      role: role,
      cognitoUsername: decodedToken['cognito:username'],
      tokenExp: decodedToken.exp,
      tokenIat: decodedToken.iat,
      claims: decodedToken
    }
  } catch (err) {
    error('Authentication failed:', err.message)
    throw new Error(`Authentication failed: ${err.message}`)
  }
}

/**
 * Helper to create authentication responses
 */
export const AuthResponses = {
  unauthorized: (message = 'Unauthorized') => ({
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  }),
  
  forbidden: (message = 'Forbidden - insufficient permissions') => ({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  })
}
