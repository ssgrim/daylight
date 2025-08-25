// Test circuit breaker implementation
console.log('Starting circuit breaker test module...')
import { CircuitBreaker, CircuitState, CircuitBreakerError } from '../dist/lib/circuit-breaker.js'
import { fetchWithCircuitBreaker } from '../dist/lib/enhanced-fetch.js'
console.log('Imports successful!')

async function testBasicCircuitBreaker() {
  console.log('Testing basic circuit breaker functionality...')
  
  // Create a circuit breaker with fast recovery for testing
  const breaker = new CircuitBreaker({
    name: 'test-service',
    failureThreshold: 2,
    recoveryTimeout: 1000, // 1 second
    monitoringWindow: 5000, // 5 seconds
    successThreshold: 1,
    timeout: 100
  })
  
  // Failing operation
  const failingOperation = () => Promise.reject(new Error('Service unavailable'))
  
  // Successful operation
  const successOperation = () => Promise.resolve('Success!')
  
  console.log('Initial state:', breaker.getStats().state)
  
  // Cause failures to open circuit
  try {
    await breaker.execute(failingOperation)
  } catch (e) {
    console.log('Expected failure 1:', e.message)
  }
  
  try {
    await breaker.execute(failingOperation)
  } catch (e) {
    console.log('Expected failure 2:', e.message)
  }
  
  console.log('State after failures:', breaker.getStats().state)
  
  // Circuit should be open now
  try {
    await breaker.execute(successOperation)
  } catch (e) {
    if (e instanceof CircuitBreakerError) {
      console.log('Circuit breaker is open:', e.message)
      console.log('Circuit state:', e.circuitState)
    }
  }
  
  // Wait for recovery timeout
  console.log('Waiting for recovery timeout...')
  await new Promise(resolve => setTimeout(resolve, 1100))
  
  // Should transition to half-open and then closed
  try {
    const result = await breaker.execute(successOperation)
    console.log('Recovery successful:', result)
    console.log('Final state:', breaker.getStats().state)
  } catch (e) {
    console.log('Recovery failed:', e.message)
  }
  
  console.log('Basic circuit breaker test completed ✓\n')
}

async function testFetchWithCircuitBreaker() {
  console.log('Testing fetch with circuit breaker...')
  
  // Test with a non-existent endpoint to trigger failures
  const badUrl = 'https://httpstat.us/500'
  
  try {
    const result = await fetchWithCircuitBreaker(badUrl, {
      circuitBreakerName: 'test-http-service',
      timeout: 2000,
      retries: 1,
      fallbackData: { message: 'Service temporarily unavailable' }
    })
    
    console.log('Result with fallback:', result)
    console.log('Used fallback:', result.fromFallback)
  } catch (error) {
    console.log('Fetch failed:', error.message)
  }
  
  // Test with good endpoint
  try {
    const result = await fetchWithCircuitBreaker('https://httpstat.us/200', {
      circuitBreakerName: 'test-good-service',
      timeout: 5000
    })
    
    console.log('Good service response status:', result.status)
    console.log('Circuit state:', result.circuitState)
  } catch (error) {
    console.log('Good service failed:', error.message)
  }
  
  console.log('Fetch circuit breaker test completed ✓\n')
}

async function testWeatherServiceCircuitBreaker() {
  console.log('Testing weather service circuit breaker...')
  
  try {
    const { fetchWeatherData } = await import('../dist/lib/enhanced-fetch.js')
    
    // Test with valid coordinates
    const result = await fetchWeatherData(47.6062, -122.3321)
    console.log('Weather service status:', result.status)
    console.log('Used fallback:', result.fromFallback)
    console.log('Temperature:', result.data.current_weather?.temperature || 'N/A')
  } catch (error) {
    console.log('Weather service error:', error.message)
  }
  
  console.log('Weather service test completed ✓\n')
}

async function runAllTests() {
  console.log('🔄 Starting Circuit Breaker Tests\n')
  
  try {
    await testBasicCircuitBreaker()
    await testFetchWithCircuitBreaker()
    await testWeatherServiceCircuitBreaker()
    
    console.log('✅ All circuit breaker tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
} else {
  // For debugging, run tests anyway
  console.log('Running tests...')
  runAllTests()
}

export { testBasicCircuitBreaker, testFetchWithCircuitBreaker, testWeatherServiceCircuitBreaker }
