/**
 * Authentication Page Component
 * 
 * Main authentication page that handles login, signup, and email verification flows
 */

import React, { useState } from 'react'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import { EmailVerification } from './EmailVerification'

type AuthPageState = 'login' | 'signup' | 'verify' | 'forgot-password'

interface AuthPageProps {
  initialState?: AuthPageState
  onSuccess?: () => void
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialState = 'login',
  onSuccess
}) => {
  const [currentState, setCurrentState] = useState<AuthPageState>(initialState)
  const [verificationEmail, setVerificationEmail] = useState('')

  const handleSignupSuccess = (email?: string) => {
    if (email) {
      setVerificationEmail(email)
      setCurrentState('verify')
    }
  }

  const handleVerificationSuccess = () => {
    setCurrentState('login')
    // You might want to show a success message here
  }

  const renderCurrentView = () => {
    switch (currentState) {
      case 'login':
        return (
          <LoginForm
            onSuccess={onSuccess}
            onSignupClick={() => setCurrentState('signup')}
            onForgotPasswordClick={() => setCurrentState('forgot-password')}
          />
        )

      case 'signup':
        return (
          <SignupForm
            onSuccess={() => handleSignupSuccess(verificationEmail)}
            onLoginClick={() => setCurrentState('login')}
          />
        )

      case 'verify':
        return (
          <EmailVerification
            email={verificationEmail}
            onSuccess={handleVerificationSuccess}
            onBackToLogin={() => setCurrentState('login')}
          />
        )

      case 'forgot-password':
        // TODO: Implement forgot password component
        return (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Forgot Password
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Forgot password functionality coming soon.
            </p>
            <button
              onClick={() => setCurrentState('login')}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
            >
              Back to Sign In
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {renderCurrentView()}
      </div>
    </div>
  )
}
