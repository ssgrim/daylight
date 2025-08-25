/**
 * Authentication Handler
 * 
 * Handles authentication operations including login, logout, refresh tokens,
 * and user profile management with AWS Cognito
 */

import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  UpdateUserAttributesCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  AuthFlowType
} from '@aws-sdk/client-cognito-identity-provider'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { withAuth, AuthenticatedEvent, createAuthenticatedResponse, refreshToken } from '../lib/auth.js'

// Types
interface CognitoConfig {
  userPoolId: string
  userPoolClientId: string
  identityPoolId: string
  region: string
}

interface LoginRequest {
  email: string
  password: string
}

interface SignUpRequest {
  email: string
  password: string
  name?: string
  preferredUsername?: string
}

interface ConfirmSignUpRequest {
  email: string
  confirmationCode: string
}

interface ForgotPasswordRequest {
  email: string
}

interface ResetPasswordRequest {
  email: string
  confirmationCode: string
  newPassword: string
}

interface ChangePasswordRequest {
  previousPassword: string
  proposedPassword: string
}

interface UpdateProfileRequest {
  name?: string
  picture?: string
  preferredUsername?: string
}

// Cache for Cognito configuration
let cognitoConfig: CognitoConfig | null = null
let cognitoClient: CognitoIdentityProviderClient | null = null

/**
 * Get Cognito configuration and client
 */
async function getCognitoClient(): Promise<{
  client: CognitoIdentityProviderClient
  config: CognitoConfig
}> {
  if (cognitoClient && cognitoConfig) {
    return { client: cognitoClient, config: cognitoConfig }
  }

  try {
    const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-west-1' })
    const parameterName = `/daylight/${process.env.NODE_ENV || 'development'}/cognito/config`
    
    const command = new GetParameterCommand({ Name: parameterName })
    const response = await ssm.send(command)
    
    if (!response.Parameter?.Value) {
      throw new Error('Cognito configuration not found')
    }

    cognitoConfig = JSON.parse(response.Parameter.Value) as CognitoConfig
    cognitoClient = new CognitoIdentityProviderClient({
      region: cognitoConfig.region
    })

    return { client: cognitoClient, config: cognitoConfig }
  } catch (error) {
    console.error('Failed to initialize Cognito client:', error)
    throw new Error('Authentication service unavailable')
  }
}

/**
 * Main authentication handler
 */
const authHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method
  const path = event.requestContext.http.path
  
  // Extract operation from path
  const pathParts = path.split('/')
  const operation = pathParts[pathParts.length - 1]

  console.log(`Auth ${method} ${operation}`)

  try {
    switch (`${method}:${operation}`) {
      case 'POST:login':
        return await handleLogin(event)
      case 'POST:signup':
        return await handleSignUp(event)
      case 'POST:confirm-signup':
        return await handleConfirmSignUp(event)
      case 'POST:forgot-password':
        return await handleForgotPassword(event)
      case 'POST:reset-password':
        return await handleResetPassword(event)
      case 'POST:refresh':
        return await handleRefreshToken(event)
      case 'POST:logout':
        return await handleLogout(event)
      case 'GET:profile':
        return await handleGetProfile(event)
      case 'PUT:profile':
        return await handleUpdateProfile(event)
      case 'PUT:change-password':
        return await handleChangePassword(event)
      default:
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Not found',
            message: `Operation ${operation} not found`
          })
        }
    }
  } catch (error) {
    console.error('Auth handler error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Authentication operation failed'
      })
    }
  }
}

/**
 * Handle user login
 */
async function handleLogin(event: any): Promise<APIGatewayProxyResultV2> {
  try {
    const { email, password }: LoginRequest = JSON.parse(event.body || '{}')
    
    if (!email || !password) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Email and password are required'
      })
    }

    const { client, config } = await getCognitoClient()

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: config.userPoolClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    })

    const response = await client.send(command)

    if (response.ChallengeName) {
      // Handle auth challenges (MFA, password change, etc.)
      return createAuthenticatedResponse(200, {
        challengeRequired: true,
        challengeName: response.ChallengeName,
        challengeParameters: response.ChallengeParameters,
        session: response.Session
      })
    }

    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed')
    }

    return createAuthenticatedResponse(200, {
      success: true,
      tokens: {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      },
      message: 'Login successful'
    })

  } catch (error: any) {
    console.error('Login error:', error)
    
    const statusCode = error.name === 'NotAuthorizedException' ? 401 : 500
    const message = error.name === 'NotAuthorizedException' 
      ? 'Invalid email or password'
      : 'Login failed'

    return createAuthenticatedResponse(statusCode, {
      error: 'Authentication failed',
      message
    })
  }
}

/**
 * Handle user sign up
 */
async function handleSignUp(event: any): Promise<APIGatewayProxyResultV2> {
  try {
    const { email, password, name, preferredUsername }: SignUpRequest = JSON.parse(event.body || '{}')
    
    if (!email || !password) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Email and password are required'
      })
    }

    const { client, config } = await getCognitoClient()

    const userAttributes = [
      { Name: 'email', Value: email }
    ]

    if (name) {
      userAttributes.push({ Name: 'name', Value: name })
    }

    if (preferredUsername) {
      userAttributes.push({ Name: 'preferred_username', Value: preferredUsername })
    }

    const command = new SignUpCommand({
      ClientId: config.userPoolClientId,
      Username: email,
      Password: password,
      UserAttributes: userAttributes
    })

    const response = await client.send(command)

    return createAuthenticatedResponse(201, {
      success: true,
      userSub: response.UserSub,
      codeDeliveryDetails: response.CodeDeliveryDetails,
      message: 'User created successfully. Please check your email for verification code.'
    })

  } catch (error: any) {
    console.error('Sign up error:', error)
    
    const message = error.name === 'UsernameExistsException' 
      ? 'User already exists'
      : error.name === 'InvalidPasswordException'
      ? 'Password does not meet requirements'
      : 'Sign up failed'

    return createAuthenticatedResponse(400, {
      error: 'Sign up failed',
      message
    })
  }
}

/**
 * Handle sign up confirmation
 */
async function handleConfirmSignUp(event: any): Promise<APIGatewayProxyResultV2> {
  try {
    const { email, confirmationCode }: ConfirmSignUpRequest = JSON.parse(event.body || '{}')
    
    if (!email || !confirmationCode) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Email and confirmation code are required'
      })
    }

    const { client, config } = await getCognitoClient()

    const command = new ConfirmSignUpCommand({
      ClientId: config.userPoolClientId,
      Username: email,
      ConfirmationCode: confirmationCode
    })

    await client.send(command)

    return createAuthenticatedResponse(200, {
      success: true,
      message: 'Email verified successfully. You can now log in.'
    })

  } catch (error: any) {
    console.error('Confirm sign up error:', error)
    
    const message = error.name === 'CodeMismatchException' 
      ? 'Invalid confirmation code'
      : error.name === 'ExpiredCodeException'
      ? 'Confirmation code has expired'
      : 'Email verification failed'

    return createAuthenticatedResponse(400, {
      error: 'Verification failed',
      message
    })
  }
}

/**
 * Handle forgot password
 */
async function handleForgotPassword(event: any): Promise<APIGatewayProxyResultV2> {
  try {
    const { email }: ForgotPasswordRequest = JSON.parse(event.body || '{}')
    
    if (!email) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Email is required'
      })
    }

    const { client, config } = await getCognitoClient()

    const command = new ForgotPasswordCommand({
      ClientId: config.userPoolClientId,
      Username: email
    })

    const response = await client.send(command)

    return createAuthenticatedResponse(200, {
      success: true,
      codeDeliveryDetails: response.CodeDeliveryDetails,
      message: 'Password reset code sent to your email'
    })

  } catch (error: any) {
    console.error('Forgot password error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to send reset code',
      message: 'Please try again later'
    })
  }
}

/**
 * Handle password reset
 */
async function handleResetPassword(event: any): Promise<APIGatewayProxyResultV2> {
  try {
    const { email, confirmationCode, newPassword }: ResetPasswordRequest = JSON.parse(event.body || '{}')
    
    if (!email || !confirmationCode || !newPassword) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Email, confirmation code, and new password are required'
      })
    }

    const { client, config } = await getCognitoClient()

    const command = new ConfirmForgotPasswordCommand({
      ClientId: config.userPoolClientId,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword
    })

    await client.send(command)

    return createAuthenticatedResponse(200, {
      success: true,
      message: 'Password reset successfully'
    })

  } catch (error: any) {
    console.error('Reset password error:', error)
    
    const message = error.name === 'CodeMismatchException' 
      ? 'Invalid confirmation code'
      : error.name === 'InvalidPasswordException'
      ? 'Password does not meet requirements'
      : 'Password reset failed'

    return createAuthenticatedResponse(400, {
      error: 'Password reset failed',
      message
    })
  }
}

/**
 * Handle token refresh
 */
async function handleRefreshToken(event: any): Promise<APIGatewayProxyResultV2> {
  try {
    const { refreshToken: refresh } = JSON.parse(event.body || '{}')
    
    if (!refresh) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Refresh token is required'
      })
    }

    const tokens = await refreshToken(refresh)

    return createAuthenticatedResponse(200, {
      success: true,
      tokens,
      message: 'Tokens refreshed successfully'
    })

  } catch (error) {
    console.error('Refresh token error:', error)
    return createAuthenticatedResponse(401, {
      error: 'Token refresh failed',
      message: 'Invalid or expired refresh token'
    })
  }
}

/**
 * Handle logout (requires authentication)
 */
const handleLogout = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const { client } = await getCognitoClient()

    const command = new GlobalSignOutCommand({
      AccessToken: event.auth.token
    })

    await client.send(command)

    return createAuthenticatedResponse(200, {
      success: true,
      message: 'Logged out successfully'
    })

  } catch (error) {
    console.error('Logout error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Logout failed',
      message: 'Please try again'
    })
  }
}, { required: true })

/**
 * Get user profile (requires authentication)
 */
const handleGetProfile = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const { client } = await getCognitoClient()

    const command = new GetUserCommand({
      AccessToken: event.auth.token
    })

    const response = await client.send(command)

    const userAttributes = response.UserAttributes?.reduce((acc, attr) => {
      if (attr.Name && attr.Value) {
        acc[attr.Name] = attr.Value
      }
      return acc
    }, {} as Record<string, string>) || {}

    return createAuthenticatedResponse(200, {
      user: {
        username: response.Username,
        ...userAttributes
      }
    })

  } catch (error) {
    console.error('Get profile error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to get profile',
      message: 'Please try again'
    })
  }
}, { required: true })

/**
 * Update user profile (requires authentication)
 */
const handleUpdateProfile = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const { name, picture, preferredUsername }: UpdateProfileRequest = JSON.parse(event.body || '{}')
    
    const userAttributes = []
    
    if (name) userAttributes.push({ Name: 'name', Value: name })
    if (picture) userAttributes.push({ Name: 'picture', Value: picture })
    if (preferredUsername) userAttributes.push({ Name: 'preferred_username', Value: preferredUsername })

    if (userAttributes.length === 0) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'At least one attribute must be provided'
      })
    }

    const { client } = await getCognitoClient()

    const command = new UpdateUserAttributesCommand({
      AccessToken: event.auth.token,
      UserAttributes: userAttributes
    })

    await client.send(command)

    return createAuthenticatedResponse(200, {
      success: true,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('Update profile error:', error)
    return createAuthenticatedResponse(500, {
      error: 'Failed to update profile',
      message: 'Please try again'
    })
  }
}, { required: true })

/**
 * Change password (requires authentication)
 */
const handleChangePassword = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const { previousPassword, proposedPassword }: ChangePasswordRequest = JSON.parse(event.body || '{}')
    
    if (!previousPassword || !proposedPassword) {
      return createAuthenticatedResponse(400, {
        error: 'Validation failed',
        message: 'Previous password and new password are required'
      })
    }

    const { client } = await getCognitoClient()

    const command = new ChangePasswordCommand({
      AccessToken: event.auth.token,
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword
    })

    await client.send(command)

    return createAuthenticatedResponse(200, {
      success: true,
      message: 'Password changed successfully'
    })

  } catch (error: any) {
    console.error('Change password error:', error)
    
    const message = error.name === 'NotAuthorizedException' 
      ? 'Current password is incorrect'
      : error.name === 'InvalidPasswordException'
      ? 'New password does not meet requirements'
      : 'Password change failed'

    return createAuthenticatedResponse(400, {
      error: 'Password change failed',
      message
    })
  }
}, { required: true })

export const handler = authHandler
