import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import Plan from './pages/Plan'
import ErrorTestPage from './pages/ErrorTestPage'
import { 
  ErrorBoundary, 
  RouteErrorBoundary, 
  ErrorNotificationManager,
  globalErrorHandler 
} from './components/error'

// Initialize global error handler
globalErrorHandler.updateConfig({
  enableConsoleLogging: true,
  enableRemoteLogging: import.meta.env.MODE === 'production',
  enableUserNotification: true,
  remoteEndpoint: import.meta.env.VITE_ERROR_ENDPOINT
})

const router = createBrowserRouter([
  { 
    path: '/', 
    element: (
      <RouteErrorBoundary routeName="Home">
        <Root />
      </RouteErrorBoundary>
    ) 
  },
  { 
    path: '/plan', 
    element: (
      <RouteErrorBoundary routeName="Plan">
        <Plan />
      </RouteErrorBoundary>
    ) 
  },
  { 
    path: '/error-test', 
    element: (
      <RouteErrorBoundary routeName="ErrorTest">
        <ErrorTestPage />
      </RouteErrorBoundary>
    ) 
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary name="App-Root" showErrorDetails={import.meta.env.MODE === 'development'}>
      <RouterProvider router={router} />
      <ErrorNotificationManager />
    </ErrorBoundary>
  </React.StrictMode>
)
