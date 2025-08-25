
import { Link } from 'react-router-dom'
import { t, useLocale, type Locale } from '../i18n'
import { useAuthStore } from '../stores/authStore'
import UserMenu from '../components/UserMenu'
import { AuthService } from '../services/authService'
import { useEffect } from 'react'

export default function Root() {
  const { locale, setLocale } = useLocale()
  const { isAuthenticated, user, login, setLoading } = useAuthStore()

  // Initialize authentication on app load
  useEffect(() => {
    const initAuth = async () => {
      if (!isAuthenticated) {
        setLoading(true)
        try {
          const result = await AuthService.initializeAuth()
          if (result.success && result.user && result.token) {
            login(result.user, result.token)
          }
        } catch (error) {
          console.error('Auth initialization error:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    initAuth()
  }, [isAuthenticated, login, setLoading])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            
            <div className="flex items-center space-x-4">
              {/* Language selector */}
              <div className="flex items-center">
                <label className="mr-2 text-sm text-gray-600">Lang:</label>
                <select 
                  value={locale} 
                  onChange={e => setLocale(e.target.value as Locale)} 
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
              </div>

              {/* User menu or auth link */}
              {isAuthenticated && user ? (
                <UserMenu />
              ) : (
                <Link 
                  to="/auth" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('title')}</h2>
          <p className="text-xl text-gray-600 mb-8">{t('slogan')}</p>
          
          {isAuthenticated && user ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome back!</h3>
                <p className="text-gray-600">
                  Signed in as <strong>{user.name || user.email}</strong>
                </p>
                <p className="text-sm text-blue-600 capitalize">
                  Role: {user.user_role || 'viewer'}
                </p>
              </div>
              
              <Link 
                to="/plan" 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t('openPlanner')}
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
              <p className="text-gray-600 mb-4">
                Sign in to access your trip planner and manage your travel itineraries.
              </p>
              <Link 
                to="/auth" 
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
