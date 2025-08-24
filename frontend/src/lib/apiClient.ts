/**
 * API Client utility with rate limit handling and error management
 */

export interface ApiError extends Error {
  status?: number;
  retryAfter?: number;
  code?: string;
}

export interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfter?: number;
  message?: string;
}

export interface ApiClientOptions {
  timeout?: number;
  retries?: number;
  baseURL?: string;
}

/**
 * Custom API Error class
 */
export class ApiClientError extends Error implements ApiError {
  status?: number;
  retryAfter?: number;
  code?: string;

  constructor(message: string, status?: number, retryAfter?: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

/**
 * Parse retry-after header value
 */
function parseRetryAfter(retryAfter: string | null): number | undefined {
  if (!retryAfter) return undefined;
  
  // Try parsing as seconds first
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds;
  }
  
  // Try parsing as HTTP date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
  }
  
  return undefined;
}

/**
 * Format time duration for display
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Enhanced fetch with rate limit handling
 */
export async function apiRequest<T = any>(
  url: string, 
  options: RequestInit = {},
  clientOptions: ApiClientOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 0,
    baseURL = ''
  } = clientOptions;
  
  const fullUrl = baseURL ? `${baseURL}${url}` : url;
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });
    
    clearTimeout(timeoutId);
    
    // Handle 429 Rate Limit
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      let errorMessage = 'Too many requests. Please try again later.';
      
      if (retryAfter) {
        errorMessage = `Rate limit exceeded. Please wait ${formatRetryAfter(retryAfter)} before trying again.`;
      }
      
      // Try to get error details from response body
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse errors for 429 responses
      }
      
      throw new ApiClientError(errorMessage, 429, retryAfter, 'RATE_LIMIT_EXCEEDED');
    }
    
    // Handle other HTTP errors
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorCode = `HTTP_${response.status}`;
      
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.code) {
          errorCode = errorData.code;
        }
      } catch {
        // Use default error message if JSON parsing fails
        errorMessage = `Request failed with status ${response.status}`;
      }
      
      throw new ApiClientError(errorMessage, response.status, undefined, errorCode);
    }
    
    // Parse successful response
    const data = await response.json();
    return data;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle AbortError (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError('Request timed out', undefined, undefined, 'TIMEOUT');
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiClientError('Network error. Please check your connection.', undefined, undefined, 'NETWORK_ERROR');
    }
    
    // Re-throw API errors
    if (error instanceof ApiClientError) {
      throw error;
    }
    
    // Handle other errors
    throw new ApiClientError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      undefined,
      undefined,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.status === 429;
}

/**
 * Extract rate limit information from an error
 */
export function getRateLimitInfo(error: unknown): RateLimitInfo {
  if (isRateLimitError(error)) {
    return {
      isRateLimited: true,
      retryAfter: error.retryAfter,
      message: error.message
    };
  }
  
  return {
    isRateLimited: false
  };
}

/**
 * Create a simple GET request function
 */
export function createApiClient(baseURL: string, defaultOptions: ApiClientOptions = {}) {
  return {
    get: <T = any>(url: string, options: RequestInit = {}) => 
      apiRequest<T>(url, { ...options, method: 'GET' }, { ...defaultOptions, baseURL }),
    
    post: <T = any>(url: string, data?: any, options: RequestInit = {}) => 
      apiRequest<T>(url, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }, { ...defaultOptions, baseURL }),
    
    put: <T = any>(url: string, data?: any, options: RequestInit = {}) => 
      apiRequest<T>(url, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      }, { ...defaultOptions, baseURL }),
    
    delete: <T = any>(url: string, options: RequestInit = {}) => 
      apiRequest<T>(url, { ...options, method: 'DELETE' }, { ...defaultOptions, baseURL })
  };
}
