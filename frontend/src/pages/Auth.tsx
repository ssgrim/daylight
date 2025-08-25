import React, { useState, useEffect } from 'react'
import LoginForm from '../components/LoginForm'
import SignupForm from '../components/SignupForm'
import ConfirmationForm from '../components/ConfirmationForm'
import { useAuthStore } from '../stores/authStore'
import { AuthService } from '../services/authServiceLazy'
import { Navigate } from 'react-router-dom'

type AuthView = 'login' | 'signup' | 'confirmation'

export default function Auth() {
  const [view, setView] = useState<AuthView>('login')
  const [signupEmail, setSignupEmail] = useState('')
  const { isAuthenticated, setLoading, login } = useAuthStore()

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true)
      try {
        const result = await AuthService.initializeAuth()
        if (result.success && result.user && result.token) {
          login(result.user, result.token)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!isAuthenticated) {
      checkAuth()
    }
  }, [isAuthenticated, setLoading, login])

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSwitchToSignup = () => {
    setView('signup')
  }

  const handleSwitchToLogin = () => {
    setView('login')
    setSignupEmail('')
  }

  const handleSignupSuccess = (email: string) => {
    setSignupEmail(email)
    setView('confirmation')
  }

  const handleConfirmationSuccess = () => {
    setView('login')
    setSignupEmail('')
  }

  const handleBackToSignup = () => {
    setView('signup')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Development Mode Banner */}
        {import.meta.env.DEV && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">
                  Development Mode
                </h3>
                <div className="mt-2 text-sm text-orange-700">
                  <p>
                    AWS Cognito not configured. Use any email/password to test authentication.
                    <br />
                    <strong>Pre-configured accounts:</strong>
                    <br />
                    • andrewbernbeck@gmail.com / password123
                    <br />
                    • test@example.com / password123
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'login' && (
          <LoginForm onSwitchToSignup={handleSwitchToSignup} />
        )}
        
        {view === 'signup' && (
          <SignupForm 
            onSwitchToLogin={handleSwitchToLogin}
            onSignupSuccess={handleSignupSuccess}
          />
        )}
        
        {view === 'confirmation' && (
          <ConfirmationForm
            email={signupEmail}
            onConfirmationSuccess={handleConfirmationSuccess}
            onBackToSignup={handleBackToSignup}
          />
        )}
      </div>
    </div>
  )
}
