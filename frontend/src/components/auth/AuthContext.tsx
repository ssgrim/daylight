/**
 * Authentication Context Provider
 * 
 * Provides authentication state and methods throughout the React application
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// Types
export interface User {
  username: string
  email: string
  name?: string
  picture?: string
  preferredUsername?: string
  emailVerified?: boolean
}

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  confirmSignup: (email: string, code: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  refreshTokens: () => Promise<void>
}

// Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Constants
const TOKEN_STORAGE_KEY = 'daylight_tokens'
const USER_STORAGE_KEY = 'daylight_user'

/**
 * Authentication Provider Component
 */
interface AuthProviderProps {
  children: ReactNode
  apiBaseUrl: string
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, apiBaseUrl }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true
  })

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY)
        const storedUser = localStorage.getItem(USER_STORAGE_KEY)
        
        if (storedTokens && storedUser) {
          const tokens: AuthTokens = JSON.parse(storedTokens)
          const user: User = JSON.parse(storedUser)
          
          // Check if tokens are expired
          const tokenExpiry = tokens.expiresIn * 1000 // Convert to milliseconds
          const currentTime = Date.now()
          
          if (currentTime < tokenExpiry) {
            setAuthState({
              user,
              tokens,
              isAuthenticated: true,
              isLoading: false
            })
          } else {
            // Try to refresh tokens
            try {
              await refreshTokensInternal(tokens.refreshToken)
            } catch (error) {
              console.error('Token refresh failed:', error)
              clearAuthState()
            }
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        clearAuthState()
      }
    }

    initializeAuth()
  }, [])

  // Helper function to make authenticated requests
  const makeAuthRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${apiBaseUrl}/auth/${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authState.tokens && {
          'Authorization': `Bearer ${authState.tokens.accessToken}`
        }),
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Clear authentication state
  const clearAuthState = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    setAuthState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false
    })
  }

  // Store authentication state
  const storeAuthState = (user: User, tokens: AuthTokens) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    setAuthState({
      user,
      tokens,
      isAuthenticated: true,
      isLoading: false
    })
  }

  // Login
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))
      
      const response = await makeAuthRequest('login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      if (response.challengeRequired) {
        // Handle MFA or other challenges
        throw new Error(`Authentication challenge required: ${response.challengeName}`)
      }

      // Get user profile
      const profileResponse = await fetch(`${apiBaseUrl}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${response.tokens.accessToken}`
        }
      })

      if (!profileResponse.ok) {
        throw new Error('Failed to get user profile')
      }

      const { user } = await profileResponse.json()
      storeAuthState(user, response.tokens)
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      throw error
    }
  }

  // Logout
  const logout = async (): Promise<void> => {
    try {
      if (authState.tokens) {
        await makeAuthRequest('logout', { method: 'POST' })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuthState()
    }
  }

  // Sign up
  const signup = async (email: string, password: string, name?: string): Promise<void> => {
    const response = await makeAuthRequest('signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    })
    return response
  }

  // Confirm signup
  const confirmSignup = async (email: string, code: string): Promise<void> => {
    const response = await makeAuthRequest('confirm-signup', {
      method: 'POST',
      body: JSON.stringify({ email, confirmationCode: code })
    })
    return response
  }

  // Forgot password
  const forgotPassword = async (email: string): Promise<void> => {
    const response = await makeAuthRequest('forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
    return response
  }

  // Reset password
  const resetPassword = async (email: string, code: string, newPassword: string): Promise<void> => {
    const response = await makeAuthRequest('reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, confirmationCode: code, newPassword })
    })
    return response
  }

  // Change password
  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await makeAuthRequest('change-password', {
      method: 'PUT',
      body: JSON.stringify({ 
        previousPassword: currentPassword, 
        proposedPassword: newPassword 
      })
    })
    return response
  }

  // Update profile
  const updateProfile = async (updates: Partial<User>): Promise<void> => {
    const response = await makeAuthRequest('profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
    
    if (authState.user) {
      const updatedUser = { ...authState.user, ...updates }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
      setAuthState(prev => ({ ...prev, user: updatedUser }))
    }
    
    return response
  }

  // Refresh tokens (internal)
  const refreshTokensInternal = async (refreshToken: string): Promise<void> => {
    const response = await makeAuthRequest('refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    })

    if (authState.user) {
      storeAuthState(authState.user, response.tokens)
    }
  }

  // Refresh tokens (public)
  const refreshTokens = async (): Promise<void> => {
    if (!authState.tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }
    await refreshTokensInternal(authState.tokens.refreshToken)
  }

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    signup,
    confirmSignup,
    forgotPassword,
    resetPassword,
    changePassword,
    updateProfile,
    refreshTokens
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}
