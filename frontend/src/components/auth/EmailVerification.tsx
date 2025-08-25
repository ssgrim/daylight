/**
 * Email Verification Component
 * 
 * Handles email verification after signup
 */

import React, { useState } from 'react'
import { useAuth } from './AuthContext'

interface EmailVerificationProps {
  email: string
  onSuccess?: () => void
  onBackToLogin?: () => void
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({
  email,
  onSuccess,
  onBackToLogin
}) => {
  const { confirmSignup, isLoading } = useAuth()
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!verificationCode.trim()) {
      setError('Verification code is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await confirmSignup(email, verificationCode.trim())
      onSuccess?.()
    } catch (error: any) {
      setError(error.message || 'Verification failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    setIsResending(true)
    setError('')

    try {
      // Note: You would need to implement a resend endpoint in your auth handler
      // For now, we'll just show a message
      console.log('Resending verification code for:', email)
      // await resendConfirmationCode(email)
      alert('Verification code resent to your email')
    } catch (error: any) {
      setError(error.message || 'Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Verify Your Email
        </h2>
        <p className="text-gray-600">
          We've sent a verification code to
        </p>
        <p className="text-blue-600 font-medium">
          {email}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
            Verification Code
          </label>
          <input
            type="text"
            id="verificationCode"
            value={verificationCode}
            onChange={(e) => {
              setVerificationCode(e.target.value)
              if (error) setError('')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter 6-digit code"
            maxLength={6}
            disabled={isSubmitting || isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLoading || !verificationCode.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center">
        <div>
          <span className="text-sm text-gray-600">Didn't receive the code? </span>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isResending}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'Resend'}
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-sm text-gray-600 hover:text-gray-500"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
