// Enhanced fetch wrapper with circuit breaker pattern
import { CircuitBreaker, createExternalApiBreaker, CircuitBreakerError, CircuitState } from './circuit-breaker'

export interface FetchWithCircuitBreakerOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  circuitBreakerName?: string
  fallbackData?: any
  enableCircuitBreaker?: boolean
}

export interface FetchResult<T = any> {
  data: T
  status: number
  headers: Headers
  fromFallback: boolean
  circuitState?: CircuitState
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: Response
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

// Enhanced fetch function with circuit breaker
export async function fetchWithCircuitBreaker<T = any>(
  url: string,
  options: FetchWithCircuitBreakerOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = 8000,
    retries = 2,
    retryDelay = 1000,
    circuitBreakerName = extractServiceName(url),
    fallbackData,
    enableCircuitBreaker = true,
    ...fetchOptions
  } = options

  // Create the fetch operation
  const fetchOperation = async (): Promise<FetchResult<T>> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      })

      if (!response.ok) {
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response
        )
      }

      const data = await response.json()
      return {
        data,
        status: response.status,
        headers: response.headers,
        fromFallback: false
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Fallback function
  const fallback = fallbackData ? async (): Promise<FetchResult<T>> => {
    console.warn(`Using fallback data for ${url}`)
    return {
      data: fallbackData,
      status: 200,
      headers: new Headers(),
      fromFallback: true
    }
  } : undefined

  if (!enableCircuitBreaker) {
    // Execute without circuit breaker but with retries
    return await executeWithRetries(fetchOperation, retries, retryDelay, fallback)
  }

  // Get or create circuit breaker
  const circuitBreaker = createExternalApiBreaker(circuitBreakerName, {
    timeout: timeout + 1000, // Circuit breaker timeout should be higher than fetch timeout
    name: circuitBreakerName
  })

  try {
    const result = await circuitBreaker.execute(
      () => executeWithRetries(fetchOperation, retries, retryDelay),
      fallback
    )
    
    return {
      ...result,
      circuitState: circuitBreaker.getStats().state
    }
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      console.warn(`Circuit breaker ${circuitBreakerName} is ${error.circuitState}`)
      
      // If we have fallback data and no fallback function was provided, use it
      if (fallbackData && !fallback) {
        return {
          data: fallbackData,
          status: 503,
          headers: new Headers(),
          fromFallback: true,
          circuitState: error.circuitState
        }
      }
    }
    
    throw error
  }
}

// Execute operation with retries
async function executeWithRetries<T>(
  operation: () => Promise<T>,
  retries: number,
  retryDelay: number,
  fallback?: () => Promise<T>
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === retries) {
        // Last attempt failed, try fallback if available
        if (fallback) {
          try {
            return await fallback()
          } catch (fallbackError) {
            // Fallback also failed, throw original error
            throw lastError
          }
        }
        throw lastError
      }
      
      // Wait before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw lastError!
}

// Extract service name from URL for circuit breaker naming
function extractServiceName(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    
    // Map known services to friendly names
    const serviceMap: Record<string, string> = {
      'api.open-meteo.com': 'weather-service',
      'nominatim.openstreetmap.org': 'geocoding-service',
      'api.mapbox.com': 'mapbox-service',
      'app.ticketmaster.com': 'events-service',
      'traffic.ls.hereapi.com': 'traffic-service'
    }
    
    return serviceMap[hostname] || hostname.replace(/\./g, '-')
  } catch {
    return 'unknown-service'
  }
}

// Specialized functions for different types of external APIs
export async function fetchWeatherData(lat: number, lng: number): Promise<FetchResult> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=UTC`
  
  return fetchWithCircuitBreaker(url, {
    circuitBreakerName: 'weather-service',
    timeout: 5000,
    retries: 2,
    fallbackData: {
      current_weather: {
        temperature: 20,
        windspeed: 10,
        weathercode: 0
      }
    }
  })
}

export async function fetchGeocodingData(lat: number, lng: number): Promise<FetchResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
  
  return fetchWithCircuitBreaker(url, {
    circuitBreakerName: 'geocoding-service',
    timeout: 6000,
    headers: {
      'User-Agent': 'daylight/0.1 (+https://example.com)'
    },
    fallbackData: {
      display_name: 'Location unavailable'
    }
  })
}

export async function fetchEventsData(lat: number, lng: number, apiKey: string): Promise<FetchResult> {
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?latlong=${lat},${lng}&radius=10&apikey=${apiKey}`
  
  return fetchWithCircuitBreaker(url, {
    circuitBreakerName: 'events-service',
    timeout: 8000,
    retries: 1, // Events are less critical, don't retry as much
    fallbackData: {
      _embedded: {
        events: []
      }
    }
  })
}

export async function fetchTrafficData(lat: number, lng: number, apiKey: string): Promise<FetchResult> {
  const url = `https://traffic.ls.hereapi.com/traffic/6.2/flow.json?prox=${lat},${lng},5000&apiKey=${apiKey}`
  
  return fetchWithCircuitBreaker(url, {
    circuitBreakerName: 'traffic-service',
    timeout: 7000,
    retries: 1,
    fallbackData: {
      RWS: [{
        RW: [{
          FIS: [{
            FI: [{
              CF: [{
                CN: 0.5 // 50% congestion as fallback
              }]
            }]
          }]
        }]
      }]
    }
  })
}

// Circuit breaker status endpoint for monitoring
export function getCircuitBreakerStatus(): Record<string, any> {
  const { CircuitBreakerRegistry } = require('./circuit-breaker')
  const registry = CircuitBreakerRegistry.getInstance()
  return registry.getAllStats()
}

// Reset circuit breakers (useful for testing or manual recovery)
export function resetCircuitBreakers(serviceName?: string): void {
  const { CircuitBreakerRegistry } = require('./circuit-breaker')
  const registry = CircuitBreakerRegistry.getInstance()
  registry.reset(serviceName)
}
