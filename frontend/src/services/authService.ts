import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession, confirmSignUp, resendSignUpCode } from '@aws-amplify/auth'
import { Amplify } from '@aws-amplify/core'
import { User } from '../stores/authStore'

// Get configuration from environment
const getAuthConfig = () => {
  const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID
  const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID
  const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN

  if (!userPoolId || !userPoolClientId || !cognitoDomain) {
    throw new Error('Missing required Cognito configuration. Please check your environment variables.')
  }

  return {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain: cognitoDomain,
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: [window.location.origin],
            redirectSignOut: [window.location.origin],
            responseType: 'code' as const
          }
        }
      }
    }
  }
}

// Initialize Amplify
try {
  Amplify.configure(getAuthConfig())
} catch (error) {
  console.warn('Cognito configuration not available:', error)
}

export interface SignUpParams {
  email: string
  password: string
  name?: string
}

export interface SignInParams {
  email: string
  password: string
}

export interface ConfirmSignUpParams {
  email: string
  confirmationCode: string
}

export class AuthService {
  /**
   * Sign up a new user
   */
  static async signUp({ email, password, name }: SignUpParams) {
    try {
      const result = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name: name || email,
            'custom:user_role': 'viewer' // Default role
          }
        }
      })
      
      return {
        success: true,
        userId: result.userId,
        nextStep: result.nextStep
      }
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  /**
   * Confirm sign up with verification code
   */
  static async confirmSignUp({ email, confirmationCode }: ConfirmSignUpParams) {
    try {
      await confirmSignUp({
        username: email,
        confirmationCode
      })
      return { success: true }
    } catch (error) {
      console.error('Confirm sign up error:', error)
      throw error
    }
  }

  /**
   * Resend confirmation code
   */
  static async resendConfirmationCode(email: string) {
    try {
      await resendSignUpCode({ username: email })
      return { success: true }
    } catch (error) {
      console.error('Resend confirmation code error:', error)
      throw error
    }
  }

  /**
   * Sign in an existing user
   */
  static async signIn({ email, password }: SignInParams) {
    try {
      const result = await signIn({
        username: email,
        password
      })

      if (result.isSignedIn) {
        const user = await this.getCurrentUser()
        const session = await fetchAuthSession()
        const token = session.tokens?.idToken?.toString()

        return {
          success: true,
          user,
          token,
          nextStep: result.nextStep
        }
      }

      return {
        success: false,
        nextStep: result.nextStep
      }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut() {
    try {
      await signOut()
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  /**
   * Get the current authenticated user
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const user = await getCurrentUser()
      
      return {
        sub: user.userId,
        email: user.signInDetails?.loginId || '',
        name: user.username,
        user_role: 'viewer' // Default, will be updated from token
      }
    } catch (error) {
      console.error('Get current user error:', error)
      return null
    }
  }

  /**
   * Get the current session and tokens
   */
  static async getCurrentSession() {
    try {
      const session = await fetchAuthSession()
      
      if (session.tokens) {
        return {
          success: true,
          accessToken: session.tokens.accessToken?.toString(),
          idToken: session.tokens.idToken?.toString()
        }
      }
      
      return { success: false }
    } catch (error) {
      console.error('Get current session error:', error)
      return { success: false }
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession()
      return !!session.tokens?.accessToken
    } catch (error) {
      return false
    }
  }

  /**
   * Decode JWT token to get user info
   */
  static decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Token decode error:', error)
      return null
    }
  }

  /**
   * Initialize auth state on app startup
   */
  static async initializeAuth() {
    try {
      const session = await this.getCurrentSession()
      
      if (session.success && session.idToken) {
        const user = await this.getCurrentUser()
        const tokenData = this.decodeToken(session.idToken)
        
        if (user && tokenData) {
          return {
            success: true,
            user: {
              ...user,
              user_role: tokenData['custom:user_role'] || 'viewer'
            },
            token: session.idToken
          }
        }
      }
      
      return { success: false }
    } catch (error) {
      console.error('Initialize auth error:', error)
      return { success: false }
    }
  }
}
