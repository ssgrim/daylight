import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import Plan from './pages/Plan'
import { AuthProvider, AuthPage, ProtectedRoute } from './components/auth'

// Get API base URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-api-gateway-url.amazonaws.com'

const router = createBrowserRouter([
  { path: '/', element: <Root /> },
  { 
    path: '/plan', 
    element: (
      <ProtectedRoute>
        <Plan />
      </ProtectedRoute>
    ) 
  },
  { 
    path: '/login', 
    element: <AuthPage initialState="login" /> 
  },
  { 
    path: '/signup', 
    element: <AuthPage initialState="signup" /> 
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
)
