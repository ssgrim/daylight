import { User } from '../stores/authStore'

// Interfaces for authentication
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

// Lazy load AWS Amplify to reduce initial bundle size
class AuthServiceLoader {
  private authModulePromise: Promise<any> | null = null
  private amplifyModulePromise: Promise<any> | null = null
  private isDevMode: boolean = false
  private mockUsers: Map<string, any> = new Map()
  private currentMockUser: any = null

  constructor() {
    // Initialize mock users for development
    this.mockUsers.set('andrewbernbeck@gmail.com', {
      sub: 'mock-user-1',
      email: 'andrewbernbeck@gmail.com', 
      name: 'SSgrim',
      user_role: 'owner',
      password: 'password123' // In real implementation, this would be hashed
    })
    this.mockUsers.set('test@example.com', {
      sub: 'mock-user-2',
      email: 'test@example.com',
      name: 'Test User',
      user_role: 'viewer',
      password: 'password123'
    })
  }

  private async loadAuthModule() {
    if (!this.authModulePromise) {
      this.authModulePromise = import('@aws-amplify/auth')
    }
    return this.authModulePromise
  }

  private async loadAmplifyModule() {
    if (!this.amplifyModulePromise) {
      this.amplifyModulePromise = import('@aws-amplify/core')
    }
    return this.amplifyModulePromise
  }

  // Get configuration from environment
  private getAuthConfig() {
    const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID
    const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN

    // Check if we're in development mode with placeholder values
    const isDevMode = !userPoolId || 
                     !userPoolClientId || 
                     !cognitoDomain ||
                     userPoolId.includes('PLACEHOLDER') ||
                     userPoolClientId.includes('PLACEHOLDER') ||
                     cognitoDomain.includes('PLACEHOLDER')

    if (isDevMode) {
      console.warn('⚠️ Running in development mode without real AWS Cognito. Authentication will use mock implementation.')
      return null // Signal to use mock auth
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

  // Initialize Amplify (lazy loaded) or set up dev mode
  private async initializeAmplify() {
    const config = this.getAuthConfig()
    
    if (!config) {
      // Development mode - no real AWS Cognito
      this.isDevMode = true
      console.log('🔧 Auth service running in development mode')
      return
    }

    try {
      const { Amplify } = await this.loadAmplifyModule()
      Amplify.configure(config)
      this.isDevMode = false
    } catch (error) {
      console.warn('Cognito configuration failed, falling back to dev mode:', error)
      this.isDevMode = true
    }
  }

  /**
   * Sign up a new user
   */
  async signUp({ email, password, name }: SignUpParams) {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        // Mock implementation for development
        console.log('🔧 Mock sign up for:', email)
        
        if (this.mockUsers.has(email)) {
          throw new Error('User already exists')
        }
        
        // Add user to mock database
        this.mockUsers.set(email, {
          sub: `mock-user-${Date.now()}`,
          email,
          name: name || email,
          user_role: 'viewer',
          password,
          confirmed: false // Simulate email confirmation needed
        })
        
        return {
          success: true,
          userId: `mock-user-${Date.now()}`,
          nextStep: {
            signUpStep: 'CONFIRM_SIGN_UP',
            codeDeliveryDetails: {
              deliveryMedium: 'EMAIL',
              destination: email
            }
          }
        }
      }
      
      const { signUp } = await this.loadAuthModule()
      
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
  async confirmSignUp({ email, confirmationCode }: ConfirmSignUpParams) {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        // Mock implementation - any 6-digit code works
        console.log('🔧 Mock confirm sign up for:', email)
        
        const user = this.mockUsers.get(email)
        if (!user) {
          throw new Error('User not found')
        }
        
        if (confirmationCode.length !== 6) {
          throw new Error('Invalid confirmation code')
        }
        
        // Mark user as confirmed
        user.confirmed = true
        this.mockUsers.set(email, user)
        
        return { success: true }
      }
      
      const { confirmSignUp } = await this.loadAuthModule()
      
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
  async resendConfirmationCode(email: string) {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        console.log('🔧 Mock resend confirmation code for:', email)
        
        const user = this.mockUsers.get(email)
        if (!user) {
          throw new Error('User not found')
        }
        
        return { success: true }
      }
      
      const { resendSignUpCode } = await this.loadAuthModule()
      
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
  async signIn({ email, password }: SignInParams) {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        // Mock implementation for development
        console.log('🔧 Mock sign in for:', email)
        
        const user = this.mockUsers.get(email)
        if (!user || user.password !== password) {
          throw new Error('Invalid email or password')
        }
        
        if (!user.confirmed) {
          throw new Error('User not confirmed. Please check your email for confirmation code.')
        }
        
        this.currentMockUser = user
        
        // Generate mock JWT token
        const mockToken = btoa(JSON.stringify({
          sub: user.sub,
          email: user.email,
          name: user.name,
          'custom:user_role': user.user_role,
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
        }))
        
        return {
          success: true,
          user: {
            sub: user.sub,
            email: user.email,
            name: user.name,
            user_role: user.user_role
          },
          token: `mock.${mockToken}.signature`,
          nextStep: { signInStep: 'DONE' }
        }
      }
      
      const { signIn, fetchAuthSession } = await this.loadAuthModule()
      
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
  async signOut() {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        console.log('🔧 Mock sign out')
        this.currentMockUser = null
        return { success: true }
      }
      
      const { signOut } = await this.loadAuthModule()
      
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
  async getCurrentUser(): Promise<User | null> {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        return this.currentMockUser ? {
          sub: this.currentMockUser.sub,
          email: this.currentMockUser.email,
          name: this.currentMockUser.name,
          user_role: this.currentMockUser.user_role
        } : null
      }
      
      const { getCurrentUser } = await this.loadAuthModule()
      
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
  async getCurrentSession() {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        if (!this.currentMockUser) {
          return { success: false }
        }
        
        const mockToken = btoa(JSON.stringify({
          sub: this.currentMockUser.sub,
          email: this.currentMockUser.email,
          name: this.currentMockUser.name,
          'custom:user_role': this.currentMockUser.user_role,
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
        }))
        
        return {
          success: true,
          accessToken: `mock.${mockToken}.signature`,
          idToken: `mock.${mockToken}.signature`
        }
      }
      
      const { fetchAuthSession } = await this.loadAuthModule()
      
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
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.initializeAmplify()
      
      if (this.isDevMode) {
        return this.currentMockUser !== null
      }
      
      const { fetchAuthSession } = await this.loadAuthModule()
      
      const session = await fetchAuthSession()
      return !!session.tokens?.accessToken
    } catch (error) {
      return false
    }
  }

  /**
   * Decode JWT token to get user info
   */
  decodeToken(token: string): any {
    try {
      // Handle mock tokens
      if (token.startsWith('mock.')) {
        const parts = token.split('.')
        if (parts.length === 3) {
          return JSON.parse(atob(parts[1]))
        }
      }
      
      // Handle real JWT tokens
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
  async initializeAuth() {
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

export const AuthService = new AuthServiceLoader()
