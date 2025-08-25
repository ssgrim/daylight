import { useState } from 'react'
import { 
  ComponentErrorBoundary, 
  useAsyncError,
  useFormError,
  useNetworkError,
  ErrorToast,
  InlineError,
  LoadingError
} from '../components/error'

// Component that throws an error
function ErrorThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Intentional test error from component')
  }
  return <div className="p-2 bg-green-100 text-green-800 rounded">Component rendered successfully!</div>
}

// Async function that simulates API failures
const simulateApiCall = async (shouldFail: boolean): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  if (shouldFail) {
    throw new Error('Simulated API failure')
  }
  return 'API call succeeded!'
}

export default function ErrorTestPage() {
  const [throwError, setThrowError] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  
  const asyncError = useAsyncError<string>()
  const formError = useFormError()
  const { isOnline, networkError } = useNetworkError()

  const handleAsyncError = (shouldFail: boolean) => {
    asyncError.execute(() => simulateApiCall(shouldFail))
  }

  const handleFormSubmit = () => {
    // Clear previous errors
    formError.clearAllErrors()
    
    // Validate form
    if (!formData.email) {
      formError.setFieldError('email', 'Email is required')
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      formError.setFieldError('email', 'Please enter a valid email address')
    }
    
    if (!formData.password) {
      formError.setFieldError('password', 'Password is required')
    } else if (formData.password.length < 6) {
      formError.setFieldError('password', 'Password must be at least 6 characters')
    }
    
    if (!formError.hasErrors) {
      alert('Form submitted successfully!')
    }
  }

  const triggerGlobalError = () => {
    // This will be caught by the global error handler
    setTimeout(() => {
      throw new Error('Unhandled global error test')
    }, 100)
  }

  const triggerNetworkError = async () => {
    try {
      await fetch('https://nonexistent-domain-test-12345.com/api')
    } catch (error) {
      console.log('Network error caught:', error)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Error Handling Test Page</h1>
      
      {/* Network Status */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Network Status</h2>
        <div className="p-3 border rounded">
          <p>Status: {isOnline ? '🟢 Online' : '🔴 Offline'}</p>
          {networkError && (
            <InlineError 
              message={`Network error: ${networkError}`}
              onDismiss={() => {}} 
            />
          )}
          <div className="mt-2 space-x-2">
            <button
              className="px-3 py-1 bg-red-600 text-white rounded"
              onClick={triggerNetworkError}
            >
              Test Network Error
            </button>
          </div>
        </div>
      </div>

      {/* Component Error Boundaries */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Component Error Boundaries</h2>
        <div className="p-3 border rounded">
          <div className="mb-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={throwError}
                onChange={(e) => setThrowError(e.target.checked)}
              />
              Make component throw error
            </label>
          </div>
          
          <ComponentErrorBoundary componentName="TestComponent">
            <ErrorThrowingComponent shouldThrow={throwError} />
          </ComponentErrorBoundary>
        </div>
      </div>

      {/* Async Error Handling */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Async Error Handling</h2>
        <div className="p-3 border rounded">
          <div className="mb-3 space-x-2">
            <button
              className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
              onClick={() => handleAsyncError(false)}
              disabled={asyncError.loading}
            >
              {asyncError.loading ? 'Loading...' : 'Test Success'}
            </button>
            <button
              className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
              onClick={() => handleAsyncError(true)}
              disabled={asyncError.loading}
            >
              {asyncError.loading ? 'Loading...' : 'Test Failure'}
            </button>
            {asyncError.hasError && (
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded"
                onClick={() => asyncError.retry(() => simulateApiCall(false))}
              >
                Retry with Success
              </button>
            )}
          </div>
          
          {asyncError.loading && (
            <div className="mb-3">
              <LoadingError message="Testing async operation..." />
            </div>
          )}
          
          {asyncError.hasError && (
            <InlineError
              message={asyncError.error?.message || 'Unknown async error'}
              errorId={asyncError.errorId || undefined}
              onRetry={() => asyncError.retry(() => simulateApiCall(false))}
              onDismiss={asyncError.clearError}
            />
          )}
          
          {!asyncError.loading && !asyncError.hasError && asyncError.data && (
            <div className="p-2 bg-green-100 text-green-800 rounded">
              {asyncError.data}
            </div>
          )}
        </div>
      </div>

      {/* Form Error Handling */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Form Error Handling</h2>
        <div className="p-3 border rounded">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className={`w-full px-3 py-2 border rounded ${
                  formError.fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {formError.fieldErrors.email && (
                <p className="text-red-600 text-sm mt-1">{formError.fieldErrors.email}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className={`w-full px-3 py-2 border rounded ${
                  formError.fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {formError.fieldErrors.password && (
                <p className="text-red-600 text-sm mt-1">{formError.fieldErrors.password}</p>
              )}
            </div>
            
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={handleFormSubmit}
            >
              Submit Form
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Toast Notifications</h2>
        <div className="p-3 border rounded">
          <div className="space-x-2">
            <button
              className="px-3 py-1 bg-red-600 text-white rounded"
              onClick={() => setShowToast(true)}
            >
              Show Error Toast
            </button>
            <button
              className="px-3 py-1 bg-orange-600 text-white rounded"
              onClick={triggerGlobalError}
            >
              Trigger Global Error
            </button>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      {showToast && (
        <ErrorToast
          notification={{
            id: 'test-toast-123',
            type: 'error',
            message: 'This is a test error notification'
          }}
          onClose={() => setShowToast(false)}
        />
      )}
      
      {/* Debug Info */}
      <div className="mt-8 p-3 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info</h3>
        <pre className="text-xs overflow-x-auto">
          {JSON.stringify({
            asyncError: {
              loading: asyncError.loading,
              hasError: asyncError.hasError,
              errorId: asyncError.errorId,
              error: asyncError.error?.message
            },
            formError: {
              hasErrors: formError.hasErrors,
              fieldErrors: formError.fieldErrors,
              generalError: formError.generalError
            },
            network: {
              isOnline,
              networkError: networkError
            }
          }, null, 2)}
        </pre>
      </div>
    </div>
  )
}
