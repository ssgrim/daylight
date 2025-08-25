import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import Plan from './pages/Plan'
import ErrorDemo from './pages/ErrorDemo'
import { ErrorProvider } from './components/ErrorProvider'
import { ErrorBoundary } from './components/ErrorComponents'

// Enhanced router with error boundaries
const router = createBrowserRouter([
  { 
    path: '/', 
    element: (
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    )
  },
  { 
    path: '/plan', 
    element: (
      <ErrorBoundary>
        <Plan />
      </ErrorBoundary>
    )
  },
  { 
    path: '/error-demo', 
    element: (
      <ErrorBoundary>
        <ErrorDemo />
      </ErrorBoundary>
    )
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorProvider maxErrors={3} autoDecayTime={8000}>
      <RouterProvider router={router} />
    </ErrorProvider>
  </React.StrictMode>
)
