import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import ProtectedRoute from './components/ProtectedRoute'

// Lazy load heavy components
const Plan = React.lazy(() => import('./pages/Plan'))
const Auth = React.lazy(() => import('./pages/Auth'))

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
)

const router = createBrowserRouter([
  { path: '/', element: <Root /> },
  { 
    path: '/auth', 
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <Auth />
      </Suspense>
    )
  },
  { 
    path: '/plan', 
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ProtectedRoute requiredRole="viewer">
          <Plan />
        </ProtectedRoute>
      </Suspense>
    )
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
  })
}
