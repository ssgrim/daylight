import { useState, useEffect } from 'react'
import { ComponentErrorBoundary, useAsyncError } from './error'

interface CircuitBreakerStats {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: number
  successCount: number
  totalRequests: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  nextAttemptTime: number | null
}

interface CircuitBreakerStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  circuitBreakers: Record<string, CircuitBreakerStats>
  summary: {
    total: number
    closed: number
    open: number
    halfOpen: number
  }
}

function CircuitBreakerCard({ name, stats }: { name: string; stats: CircuitBreakerStats }) {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'CLOSED': return 'bg-green-100 text-green-800 border-green-200'
      case 'OPEN': return 'bg-red-100 text-red-800 border-red-200'
      case 'HALF_OPEN': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'CLOSED': return '🟢'
      case 'OPEN': return '🔴'
      case 'HALF_OPEN': return '🟡'
      default: return '⚪'
    }
  }

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleTimeString()
  }

  const getNextAttemptIn = () => {
    if (!stats.nextAttemptTime) return null
    const diff = stats.nextAttemptTime - Date.now()
    if (diff <= 0) return 'Ready to retry'
    return `${Math.ceil(diff / 1000)}s`
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{name}</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStateColor(stats.state)}`}>
          {getStateIcon(stats.state)} {stats.state}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Total Requests:</span>
          <div className="font-medium">{stats.totalRequests}</div>
        </div>
        <div>
          <span className="text-gray-500">Failures:</span>
          <div className="font-medium text-red-600">{stats.failureCount}</div>
        </div>
        <div>
          <span className="text-gray-500">Last Success:</span>
          <div className="font-medium text-green-600">{formatTime(stats.lastSuccessTime)}</div>
        </div>
        <div>
          <span className="text-gray-500">Last Failure:</span>
          <div className="font-medium text-red-600">{formatTime(stats.lastFailureTime)}</div>
        </div>
      </div>
      
      {stats.state === 'OPEN' && stats.nextAttemptTime && (
        <div className="mt-3 p-2 bg-orange-50 rounded text-sm">
          <span className="text-orange-700">Next retry attempt: {getNextAttemptIn()}</span>
        </div>
      )}
      
      {stats.state === 'HALF_OPEN' && (
        <div className="mt-3 p-2 bg-yellow-50 rounded text-sm">
          <span className="text-yellow-700">Testing service recovery ({stats.successCount} successes needed)</span>
        </div>
      )}
    </div>
  )
}

function StatusSummary({ summary, status }: { summary: CircuitBreakerStatus['summary']; status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'unhealthy': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'unhealthy': return '❌'
      default: return '❓'
    }
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
      <h2 className="text-lg font-semibold mb-3">System Health Overview</h2>
      
      <div className={`text-xl font-bold mb-4 ${getStatusColor(status)}`}>
        {getStatusIcon(status)} {status.toUpperCase()}
      </div>
      
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-sm text-gray-500">Total Services</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{summary.closed}</div>
          <div className="text-sm text-gray-500">Healthy</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-600">{summary.halfOpen}</div>
          <div className="text-sm text-gray-500">Recovering</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600">{summary.open}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
      </div>
    </div>
  )
}

export default function CircuitBreakerDashboard() {
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const asyncError = useAsyncError<CircuitBreakerStatus>()

  const fetchStatus = async () => {
    const base = (import.meta as any).env?.VITE_API_BASE || ''
    const response = await fetch(`${base}/circuit-breaker-health`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch circuit breaker status`)
    }
    
    return response.json()
  }

  const loadStatus = () => {
    asyncError.execute(fetchStatus)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!asyncError.loading) {
        loadStatus()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, asyncError.loading])

  const data = asyncError.data

  return (
    <ComponentErrorBoundary componentName="CircuitBreakerDashboard">
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Circuit Breaker Dashboard</h1>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
              </select>
            )}
            
            <button
              onClick={loadStatus}
              disabled={asyncError.loading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {asyncError.loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {asyncError.hasError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
            <h3 className="font-semibold text-red-800 mb-1">Failed to Load Status</h3>
            <p className="text-red-700 text-sm">{asyncError.error?.message}</p>
            <button
              onClick={loadStatus}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            <StatusSummary summary={data.summary} status={data.status} />
            
            <div className="mb-4 text-sm text-gray-500">
              Last updated: {new Date(data.timestamp).toLocaleString()}
            </div>
            
            {Object.keys(data.circuitBreakers).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data.circuitBreakers).map(([name, stats]) => (
                  <CircuitBreakerCard key={name} name={name} stats={stats as CircuitBreakerStats} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No circuit breakers configured yet. They will appear here once external API calls are made.
              </div>
            )}
          </>
        )}

        {asyncError.loading && !data && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading circuit breaker status...</p>
          </div>
        )}
      </div>
    </ComponentErrorBoundary>
  )
}
