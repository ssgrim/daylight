import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { getCircuitBreakerStatus } from '../lib/enhanced-fetch'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const circuitBreakers = getCircuitBreakerStatus()
    
    // Calculate overall health
    const allStates = Object.values(circuitBreakers).map(cb => cb.state)
    const openCount = allStates.filter(state => state === 'OPEN').length
    const halfOpenCount = allStates.filter(state => state === 'HALF_OPEN').length
    const totalCount = allStates.length
    
    const overallHealth = openCount === 0 ? 'healthy' : 
                         openCount < totalCount ? 'degraded' : 'unhealthy'
    
    const health = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      circuitBreakers,
      summary: {
        total: totalCount,
        closed: allStates.filter(state => state === 'CLOSED').length,
        open: openCount,
        halfOpen: halfOpenCount
      }
    }
    
    // Return appropriate HTTP status code based on health
    const statusCode = overallHealth === 'healthy' ? 200 : 
                      overallHealth === 'degraded' ? 200 : 503
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(overallHealth === 'healthy' ? { 'Cache-Control': 'no-cache' } : {})
      },
      body: JSON.stringify(health, null, 2)
    }
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'error',
        message: 'Failed to check circuit breaker status',
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}
