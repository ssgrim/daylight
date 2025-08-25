/**
 * API Client Utility
 * Centralized API communication with error handling
 */

import { ErrorUtils, ErrorContext, UserFriendlyError } from './error-handler'

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5174'
  : process.env.REACT_APP_API_URL || ''

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 10000
    } = options

    const url = `${this.baseUrl}${endpoint}`

    // Setup request headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    }

    // Get auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`
    }

    // Setup request configuration
    const config: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout)
    }

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        await ErrorUtils.handleFetchError(response)
      }

      // Handle different content types
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      } else {
        return await response.text() as T
      }

    } catch (error: any) {
      // Handle network errors, timeouts, etc.
      if (error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error - unable to connect to server')
      }

      throw error
    }
  }

  // Trip-related API methods
  trips = {
    list: () => this.request<any[]>('/api/trips'),
    get: (id: string) => this.request<any>(`/api/trips/${id}`),
    create: (data: any) => this.request<any>('/api/trips', {
      method: 'POST',
      body: data
    }),
    update: (id: string, data: any) => this.request<any>(`/api/trips/${id}`, {
      method: 'PUT',
      body: data
    }),
    delete: (id: string) => this.request<any>(`/api/trips/${id}`, {
      method: 'DELETE'
    })
  }

  // Anchor-related API methods
  anchors = {
    list: () => this.request<any[]>('/api/anchors'),
    get: (id: string) => this.request<any>(`/api/anchors/${id}`),
    create: (data: any) => this.request<any>('/api/anchors', {
      method: 'POST',
      body: data
    }),
    update: (id: string, data: any) => this.request<any>(`/api/anchors/${id}`, {
      method: 'PUT',
      body: data
    }),
    delete: (id: string) => this.request<any>(`/api/anchors/${id}`, {
      method: 'DELETE'
    })
  }

  // Plan-related API methods
  plans = {
    list: () => this.request<any[]>('/api/plans'),
    get: (id: string) => this.request<any>(`/api/plans/${id}`),
    create: (data: any) => this.request<any>('/api/plans', {
      method: 'POST',
      body: data
    }),
    update: (id: string, data: any) => this.request<any>(`/api/plans/${id}`, {
      method: 'PUT',
      body: data
    }),
    delete: (id: string) => this.request<any>(`/api/plans/${id}`, {
      method: 'DELETE'
    })
  }

  // Health check
  health = {
    check: () => this.request<{ status: string }>('/api/health')
  }
}

// Create and export API client instance
export const api = new ApiClient(API_BASE_URL)

/**
 * Handle API errors with user-friendly messaging
 */
export function handleApiError(error: any, context?: ErrorContext): UserFriendlyError {
  return ErrorUtils.handleApiError(error, context)
}

/**
 * Utility for handling form submission with API calls
 */
export async function submitForm<T>(
  apiCall: () => Promise<T>,
  options: {
    onSuccess?: (result: T) => void
    onError?: (error: UserFriendlyError) => void
    context?: ErrorContext
  } = {}
): Promise<void> {
  try {
    const result = await apiCall()
    options.onSuccess?.(result)
  } catch (error) {
    const userError = handleApiError(error, options.context)
    options.onError?.(userError)
    throw userError
  }
}

export default api