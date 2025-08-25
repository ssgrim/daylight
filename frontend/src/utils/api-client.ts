/**
 * Enhanced HTTP Client with Error Handling
 * Provides automatic error transformation and user-friendly error messages
 */

import { errorHandler, ErrorType } from './error-handler'

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
  cache?: boolean
}

export interface ApiResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Headers
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class HttpClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>
  private timeout: number

  constructor(baseURL: string = '', defaultTimeout: number = 10000) {
    this.baseURL = baseURL
    this.timeout = defaultTimeout
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Set default headers for all requests
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers }
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  /**
   * Remove authorization token
   */
  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization']
  }

  /**
   * Make HTTP request with enhanced error handling
   */
  async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.timeout,
      retries = 3,
      cache = false
    } = config

    const url = this.buildURL(endpoint)
    const requestHeaders = { ...this.defaultHeaders, ...headers }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache: cache ? 'default' : 'no-cache'
    }

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body)
      } else {
        requestOptions.body = body
      }
    }

    // Implement retry logic
    let lastError: Error
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, requestOptions, timeout)
        return await this.handleResponse<T>(response)
      } catch (error) {
        lastError = error as Error
        
        // Don't retry for certain error types
        if (this.shouldNotRetry(error)) {
          break
        }

        // Wait before retry with exponential backoff
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt - 1) * 1000)
        }
      }
    }

    // Handle the final error
    throw this.transformError(lastError!, endpoint, config)
  }

  /**
   * Convenience methods for different HTTP verbs
   */
  async get<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' })
  }

  async post<T = any>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body: data })
  }

  async put<T = any>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body: data })
  }

  async patch<T = any>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body: data })
  }

  async delete<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' })
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        try {
          const response = {
            data: JSON.parse(xhr.responseText),
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers() // XMLHttpRequest doesn't provide easy header access
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response)
          } else {
            reject(new ApiError(`Upload failed: ${xhr.statusText}`, xhr.status))
          }
        } catch (error) {
          reject(new ApiError('Failed to parse upload response', xhr.status))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new ApiError('Upload failed', xhr.status))
      })

      xhr.addEventListener('timeout', () => {
        reject(new ApiError('Upload timeout', 408))
      })

      xhr.open('POST', this.buildURL(endpoint))
      
      // Add auth header if available
      if (this.defaultHeaders['Authorization']) {
        xhr.setRequestHeader('Authorization', this.defaultHeaders['Authorization'])
      }

      xhr.timeout = this.timeout
      xhr.send(formData)
    })
  }

  /**
   * Private helper methods
   */
  private buildURL(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint
    }
    
    const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${path}`
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408)
      }
      throw error
    }
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: T

    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text() as unknown as T
      }
    } catch (error) {
      throw new ApiError('Failed to parse response', response.status, response)
    }

    if (!response.ok) {
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response,
        data
      )
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    }
  }

  private shouldNotRetry(error: any): boolean {
    // Don't retry for these conditions
    if (error instanceof ApiError) {
      const status = error.status
      return (
        status === 400 || // Bad Request
        status === 401 || // Unauthorized
        status === 403 || // Forbidden
        status === 404 || // Not Found
        status === 422    // Unprocessable Entity
      )
    }
    return false
  }

  private transformError(error: Error, endpoint: string, config: RequestConfig): Error {
    const context = {
      endpoint,
      method: config.method || 'GET',
      timestamp: new Date().toISOString()
    }

    // Transform API errors into user-friendly errors
    const userError = errorHandler.handleError(error, context)
    
    // Return enhanced error with user-friendly message
    const enhancedError = new Error(userError.message)
    enhancedError.name = error.name
    Object.assign(enhancedError, { userError, originalError: error })
    
    return enhancedError
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Create default instance
export const apiClient = new HttpClient('/api')

// Helper function for handling API errors in components
export function handleApiError(error: any): void {
  if (error?.userError) {
    // Error already processed by HttpClient
    return
  }
  
  // Process raw error
  errorHandler.handleError(error, {
    source: 'api-client',
    timestamp: new Date().toISOString()
  })
}

// Enhanced fetch function with automatic error handling
export async function safeFetch<T = any>(
  endpoint: string,
  config?: RequestConfig
): Promise<T | null> {
  try {
    const response = await apiClient.request<T>(endpoint, config)
    return response.data
  } catch (error) {
    handleApiError(error)
    return null
  }
}

// Type-safe API endpoints
export const api = {
  trips: {
    list: (params?: Record<string, any>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get(`/trips${query}`)
    },
    get: (id: string) => apiClient.get(`/trips/${id}`),
    create: (data: any) => apiClient.post('/trips', data),
    update: (id: string, data: any) => apiClient.put(`/trips/${id}`, data),
    delete: (id: string) => apiClient.delete(`/trips/${id}`)
  },
  auth: {
    login: (credentials: { email: string; password: string }) => 
      apiClient.post('/auth/login', credentials),
    logout: () => apiClient.post('/auth/logout'),
    refresh: () => apiClient.post('/auth/refresh')
  },
  user: {
    profile: () => apiClient.get('/user/profile'),
    updateProfile: (data: any) => apiClient.patch('/user/profile', data)
  }
}
