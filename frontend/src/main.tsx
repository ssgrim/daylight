import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import Root from './pages/Root'
import Plan from './pages/Plan'
import { ReviewsPage } from './pages/ReviewsPage'
import { ReviewsDemo } from './pages/ReviewsDemo'

const router = createBrowserRouter([
  { path: '/', element: <Root /> },
  { path: '/plan', element: <Plan /> },
  { path: '/reviews/:locationId', element: <ReviewsPage /> },
  { path: '/reviews-demo', element: <ReviewsDemo /> },
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
