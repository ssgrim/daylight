import React, { useState } from 'react'
import { AuthService } from '../services/authServiceLazy'

interface ConfirmationFormProps {
  email: string
  onConfirmationSuccess: () => void
  onBackToSignup: () => void
}

export default function ConfirmationForm({ 
  email, 
  onConfirmationSuccess, 
  onBackToSignup 
}: ConfirmationFormProps) {
  const [confirmationCode, setConfirmationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await AuthService.confirmSignUp({
        email,
        confirmationCode
      })
      
      setMessage('Account confirmed successfully!')
      setTimeout(() => {
        onConfirmationSuccess()
      }, 1500)
    } catch (error: any) {
      console.error('Confirmation error:', error)
      setError(error.message || 'Failed to confirm account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError(null)
    setMessage(null)
    setIsResending(true)

    try {
      await AuthService.resendConfirmationCode(email)
      setMessage('New confirmation code sent to your email')
    } catch (error: any) {
      console.error('Resend error:', error)
      setError(error.message || 'Failed to resend confirmation code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6">Confirm Your Account</h2>
      
      <p className="text-gray-600 text-center mb-6">
        We've sent a confirmation code to <strong>{email}</strong>. 
        Please enter the code below to activate your account.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="confirmationCode" className="block text-sm font-medium text-gray-700 mb-2">
            Confirmation Code
          </label>
          <input
            type="text"
            id="confirmationCode"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
            disabled={isLoading}
            placeholder="Enter code"
            maxLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !confirmationCode}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isLoading ? 'Confirming...' : 'Confirm Account'}
        </button>
      </form>

      <div className="text-center">
        <button
          onClick={handleResendCode}
          disabled={isResending}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
        >
          {isResending ? 'Sending...' : 'Resend confirmation code'}
        </button>
        
        <br />
        
        <button
          onClick={onBackToSignup}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Back to signup
        </button>
      </div>
    </div>
  )
}
