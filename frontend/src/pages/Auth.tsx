import React, { useState, useEffect } from 'react'
import LoginForm from '../components/LoginForm'
import SignupForm from '../components/SignupForm'
import ConfirmationForm from '../components/ConfirmationForm'
import { useAuthStore } from '../stores/authStore'
import { AuthService } from '../services/authService'
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
