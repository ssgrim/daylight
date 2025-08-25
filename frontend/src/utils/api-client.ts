/**
 * API Client
 * Centralized API client with error handling and type safety
 */

import { useError } from '../components/ErrorProvider'

export interface ApiError extends Error {
  status?: number
  details?: any
}

export interface Trip {
  id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'completed'
  tags: string[]
  isPublic: boolean
  anchors: Array<{
    lat: number
    lng: number
    name: string
  }>
  createdAt: string
  updatedAt: string
}

export interface TripsResponse {
  items: Trip[]
  count: number
  totalCount: number
  hasNextPage: boolean
  nextCursor?: string
}

class ApiClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl = '/api', defaultHeaders = {}) {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-token',
      ...defaultHeaders
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      }
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as ApiError
        error.status = response.status
        
        try {
          const errorData = await response.json()
          error.details = errorData
        } catch {
          // Response is not JSON
        }
        
        throw error
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }
      
      return response.text() as any
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new Error('Network connection failed') as ApiError
        networkError.status = 0
        throw networkError
      }
      throw error
    }
  }

  // Trips API
  trips = {
    list: (params: Record<string, any> = {}): Promise<TripsResponse> => {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString())
        }
      })
      
      const query = searchParams.toString()
      return this.request<TripsResponse>(`/trips${query ? `?${query}` : ''}`)
    },

    get: (id: string): Promise<{ trip: Trip }> => {
      return this.request<{ trip: Trip }>(`/trips/${id}`)
    },

    create: (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ trip: Trip; tripId: string }> => {
      return this.request<{ trip: Trip; tripId: string }>(`/trips`, {
        method: 'POST',
        body: JSON.stringify(trip)
      })
    },

    update: (id: string, updates: Partial<Trip>): Promise<{ trip: Trip }> => {
      return this.request<{ trip: Trip }>(`/trips/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      })
    },

    delete: (id: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`/trips/${id}`, {
        method: 'DELETE'
      })
    },

    search: (query: string, params: Record<string, any> = {}): Promise<TripsResponse> => {
      return this.trips.list({ search: query, ...params })
    },

    suggestions: (query: string): Promise<{
      names: string[]
      tags: string[]
      descriptions: string[]
    }> => {
      return this.request<{
        names: string[]
        tags: string[]
        descriptions: string[]
      }>(`/trips/suggestions?q=${encodeURIComponent(query)}`)
    },

    stats: (): Promise<{
      total: number
      byStatus: Record<string, number>
      topTags: Array<{ tag: string; count: number }>
      recentActivity: number
    }> => {
      return this.request<{
        total: number
        byStatus: Record<string, number>
        topTags: Array<{ tag: string; count: number }>
        recentActivity: number
      }>(`/trips/stats`)
    }
  }
}

export const api = new ApiClient()

// Error handling utility
export function handleApiError(error: unknown, context?: string) {
  const { showError } = useError()
  
  if (error instanceof Error) {
    showError(error, {
      source: context || 'api',
      retryable: isRetryableError(error)
    })
  } else {
    showError(new Error('An unexpected error occurred'), {
      source: context || 'api'
    })
  }
}

function isRetryableError(error: Error): boolean {
  const apiError = error as ApiError
  
  // Network errors are retryable
  if (apiError.status === 0) return true
  
  // Server errors are retryable
  if (apiError.status && apiError.status >= 500) return true
  
  // Timeout errors are retryable
  if (error.message.includes('timeout')) return true
  
  return false
}

// React hook for API calls with error handling
export function useApiCall<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const execute = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await apiCall()
      setData(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      handleApiError(error)
    } finally {
      setLoading(false)
    }
  }, dependencies)

  React.useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch: execute }
}

// Add React import for hooks
import React from 'react'