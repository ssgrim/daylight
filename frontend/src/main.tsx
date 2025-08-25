import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import Plan from './pages/Plan'
import Auth from './pages/Auth'
import ProtectedRoute from './components/ProtectedRoute'

const router = createBrowserRouter([
  { path: '/', element: <Root /> },
  { path: '/auth', element: <Auth /> },
  { 
    path: '/plan', 
    element: (
      <ProtectedRoute requiredRole="viewer">
        <Plan />
      </ProtectedRoute>
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
