
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import Plan from './pages/Plan'
import NotFound from './pages/NotFound'
import { getApiBase } from './lib/apiBase'
import { initSentry, SentryErrorBoundary } from './lib/sentry'
import { logError, generateCorrelationId, getSessionCorrelationId } from './lib/errorHandling'

// Initialize Sentry before anything else
initSentry()

const router = createBrowserRouter([
  { path: '/', element: <Root /> },
  { path: '/plan', element: <Plan /> },
  { path: '*', element: <NotFound /> }, // 404 catch-all route
])

// Provide API base to app via context
export const ApiBaseContext = React.createContext<string>('');

// Enhanced error fallback component with correlation ID
function ErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  const errorStack = error instanceof Error ? error.stack : undefined
  
  // Log the error with correlation ID
  const correlationId = logError(error, {
    component: 'AppErrorBoundary',
    action: 'app_crash',
    additionalData: {
      errorBoundary: true,
      globalError: true,
    }
  });
  
  return (
    <div role="alert" className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg mx-auto text-center">
        <div className="mb-6">
          <svg 
            className="w-16 h-16 text-red-500 mx-auto mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
            />
          </svg>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Error</h1>
          <p className="text-lg text-gray-600 mb-6">
            We've encountered an unexpected error and our team has been notified.
          </p>
        </div>
        
        <div className="space-y-4 mb-6">
          <button 
            onClick={resetError}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto ml-0 sm:ml-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 transition-colors"
          >
            Reload Page
          </button>
        </div>
        
        <div className="text-sm text-gray-500 mb-4">
          <p><strong>What you can try:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Refresh the page or try again</li>
            <li>Check your internet connection</li>
            <li>Try accessing the site later</li>
            <li>Contact support if the problem continues</li>
          </ul>
        </div>
        
        <div className="p-4 bg-gray-100 rounded-lg border">
          <p className="text-xs font-mono text-gray-700 mb-1">
            <strong>Error ID:</strong> {correlationId}
          </p>
          <p className="text-xs text-gray-600">
            Please include this ID when reporting the issue.
          </p>
        </div>
        
        {import.meta.env.MODE === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 font-medium">
              Developer Details
            </summary>
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm font-semibold text-red-800 mb-2">Error Message:</p>
              <p className="text-sm text-red-700 mb-3">{errorMessage}</p>
              {errorStack && (
                <>
                  <p className="text-sm font-semibold text-red-800 mb-2">Stack Trace:</p>
                  <pre className="text-xs text-red-600 overflow-auto bg-white p-2 rounded border">
                    {errorStack}
                  </pre>
                </>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

async function main() {
  const apiBase = await getApiBase();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SentryErrorBoundary fallback={ErrorFallback}>
        <ApiBaseContext.Provider value={apiBase}>
          <RouterProvider router={router} />
        </ApiBaseContext.Provider>
      </SentryErrorBoundary>
    </React.StrictMode>
  );
}

main().catch(error => {
  console.error('Failed to initialize app:', error)
  // Show a basic error message if the app fails to start
  document.getElementById('root')!.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui;">
      <div style="text-align: center; max-width: 400px;">
        <h1 style="color: #dc2626; margin-bottom: 16px;">Failed to Load</h1>
        <p style="color: #6b7280; margin-bottom: 24px;">The application failed to start. Please try refreshing the page.</p>
        <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    </div>
  `
});
