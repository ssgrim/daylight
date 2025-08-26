import React from 'react'
import { useAuthStore } from '../stores/authStore'
import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'viewer' | 'editor' | 'owner'
}

export default function ProtectedRoute({ children, requiredRole = 'viewer' }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuthStore()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />
  }

  // Check role permissions
  const roleHierarchy = ['viewer', 'editor', 'owner']
  const userRoleIndex = roleHierarchy.indexOf(user.user_role || 'viewer')
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole)

  if (userRoleIndex < requiredRoleIndex) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You need {requiredRole} permissions to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Your current role: {user.user_role}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
