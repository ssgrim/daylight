// Circuit Breaker Pattern Implementation for External APIs
// Prevents cascading failures and provides graceful degradation

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening circuit
  recoveryTimeout: number       // Time to wait before trying again (ms)
  monitoringWindow: number      // Time window for tracking failures (ms)
  successThreshold: number      // Consecutive successes needed to close circuit
  timeout: number               // Request timeout (ms)
  name?: string                 // Circuit breaker name for logging
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  totalRequests: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  nextAttemptTime: number | null
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is recovered
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string, 
    public readonly circuitState: CircuitState,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker<T> {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private totalRequests = 0
  private lastFailureTime: number | null = null
  private lastSuccessTime: number | null = null
  private nextAttemptTime: number | null = null
  private failures: number[] = [] // Timestamps of failures for sliding window
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  async execute<R>(operation: () => Promise<R>, fallback?: () => Promise<R>): Promise<R> {
    this.totalRequests++
    
    // Clean old failures outside monitoring window
    this.cleanOldFailures()
    
    // Check if circuit should be opened
    if (this.state === CircuitState.CLOSED && this.shouldOpenCircuit()) {
      this.openCircuit()
    }
    
    // If circuit is open, check if we should attempt recovery
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.state = CircuitState.HALF_OPEN
        this.successCount = 0
      } else {
        // Circuit is open, fail fast
        const error = new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.config.name}. Next attempt in ${Math.ceil((this.nextAttemptTime! - Date.now()) / 1000)}s`,
          this.state,
          this.getStats()
        )
        
        if (fallback) {
          try {
            return await fallback()
          } catch (fallbackError) {
            // If fallback also fails, throw the original circuit breaker error
            throw error
          }
        }
        
        throw error
      }
    }
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation)
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      
      // If we have a fallback, try it
      if (fallback) {
        try {
          return await fallback()
        } catch (fallbackError) {
          // If fallback fails, throw the original error
          throw error
        }
      }
      
      throw error
    }
  }

  private async executeWithTimeout<R>(operation: () => Promise<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer))
    })
  }

  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindow
    this.failures = this.failures.filter(timestamp => timestamp > cutoff)
  }

  private shouldOpenCircuit(): boolean {
    return this.failures.length >= this.config.failureThreshold
  }

  private shouldAttemptRecovery(): boolean {
    if (this.nextAttemptTime === null) return false
    return Date.now() >= this.nextAttemptTime
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
    this.logStateChange(`Circuit opened after ${this.failures.length} failures`)
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now()
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.config.successThreshold) {
        this.closeCircuit()
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    const now = Date.now()
    this.lastFailureTime = now
    this.failureCount++
    this.failures.push(now)
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery attempt, reopen circuit
      this.openCircuit()
    }
  }

  private closeCircuit(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.failures = []
    this.nextAttemptTime = null
    this.logStateChange('Circuit closed - service recovered')
  }

  private logStateChange(message: string): void {
    console.log(`[CircuitBreaker:${this.config.name}] ${message}`)
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.totalRequests = 0
    this.failures = []
    this.lastFailureTime = null
    this.lastSuccessTime = null
    this.nextAttemptTime = null
  }

  // Force state changes for testing
  forceOpen(): void {
    this.state = CircuitState.OPEN
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
  }

  forceClose(): void {
    this.closeCircuit()
  }
}

// Circuit Breaker Registry for managing multiple circuit breakers
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry
  private breakers = new Map<string, CircuitBreaker<any>>()

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry()
    }
    return CircuitBreakerRegistry.instance
  }

  getOrCreate<T>(name: string, config: Partial<CircuitBreakerConfig> = {}): CircuitBreaker<T> {
    if (!this.breakers.has(name)) {
      const finalConfig: CircuitBreakerConfig = {
        name,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringWindow: 300000,
        successThreshold: 3,
        timeout: 5000,
        ...config
      }
      this.breakers.set(name, new CircuitBreaker<T>(finalConfig))
    }
    return this.breakers.get(name)!
  }

  get(name: string): CircuitBreaker<any> | undefined {
    return this.breakers.get(name)
  }

  getAll(): Map<string, CircuitBreaker<any>> {
    return new Map(this.breakers)
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats()
    })
    return stats
  }

  reset(name?: string): void {
    if (name) {
      this.breakers.get(name)?.reset()
    } else {
      this.breakers.forEach(breaker => {
        breaker.reset()
      })
    }
  }
}

// Utility function to create a circuit breaker with defaults for external APIs
export function createExternalApiBreaker(
  name: string, 
  overrides: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker<any> {
  const registry = CircuitBreakerRegistry.getInstance()
  return registry.getOrCreate(name, {
    failureThreshold: 3,      // Open after 3 failures
    recoveryTimeout: 30000,   // Try again after 30 seconds
    monitoringWindow: 120000, // Track failures over 2 minutes
    successThreshold: 2,      // Close after 2 successful attempts
    timeout: 8000,           // 8 second timeout for external APIs
    ...overrides
  })
}
