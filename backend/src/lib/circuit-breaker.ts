// Circuit breaker pattern for external API calls
interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED'
  }
  
  constructor(
    private maxFailures: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() - this.state.lastFailureTime < this.timeout) {
        if (fallback) {
          return fallback()
        }
        throw new Error('Circuit breaker is OPEN')
      }
      this.state.state = 'HALF_OPEN'
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      if (fallback) {
        return fallback()
      }
      throw error
    }
  }
  
  private onSuccess(): void {
    this.state.failures = 0
    this.state.state = 'CLOSED'
  }
  
  private onFailure(): void {
    this.state.failures++
    this.state.lastFailureTime = Date.now()
    
    if (this.state.failures >= this.maxFailures) {
      this.state.state = 'OPEN'
    }
  }
  
  getState(): CircuitBreakerState {
    return { ...this.state }
  }
}

// Global circuit breakers for different services
const weatherCircuitBreaker = new CircuitBreaker(3, 30000) // 3 failures, 30s timeout
const geocodeCircuitBreaker = new CircuitBreaker(3, 30000)
const eventsCircuitBreaker = new CircuitBreaker(5, 60000) // More lenient for events
const trafficCircuitBreaker = new CircuitBreaker(5, 60000)

export {
  CircuitBreaker,
  weatherCircuitBreaker,
  geocodeCircuitBreaker,
  eventsCircuitBreaker,
  trafficCircuitBreaker
}
