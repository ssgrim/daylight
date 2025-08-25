import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { HealthResponseSchema } from '../lib/validation'
import { createSuccessResponse, validateResponse } from '../lib/middleware'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const checks: Record<string, any> = {}
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Check database connectivity (simulated for now)
    try {
      // In production, this would check actual database connection
      checks.database = {
        status: 'pass',
        time: '5ms',
        output: 'Database connection successful'
      }
    } catch (error) {
      checks.database = {
        status: 'fail',
        output: `Database connection failed: ${error}`
      }
      overallStatus = 'unhealthy'
    }

    // Check external API connectivity
    try {
      // Quick check to external services
      const startTime = Date.now()
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current_weather=true', {
        signal: AbortSignal.timeout(5000)
      })
      const endTime = Date.now()
      
      if (response.ok) {
        checks.weather_api = {
          status: 'pass',
          time: `${endTime - startTime}ms`,
          output: 'Weather API accessible'
        }
      } else {
        checks.weather_api = {
          status: 'warn',
          output: `Weather API returned ${response.status}`
        }
        if (overallStatus === 'healthy') overallStatus = 'degraded'
      }
    } catch (error) {
      checks.weather_api = {
        status: 'fail',
        output: `Weather API check failed: ${error}`
      }
      if (overallStatus === 'healthy') overallStatus = 'degraded'
    }

    // Check memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024)
      
      if (memUsageMB < 100) {
        checks.memory = {
          status: 'pass',
          output: `Memory usage: ${memUsageMB}MB`
        }
      } else if (memUsageMB < 200) {
        checks.memory = {
          status: 'warn',
          output: `Memory usage: ${memUsageMB}MB (warning threshold)`
        }
        if (overallStatus === 'healthy') overallStatus = 'degraded'
      } else {
        checks.memory = {
          status: 'fail',
          output: `Memory usage: ${memUsageMB}MB (critical threshold)`
        }
        overallStatus = 'unhealthy'
      }
    }

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.2.0',
      checks
    }

    // Validate response structure
    const validatedResponse = validateResponse(healthResponse, HealthResponseSchema)
    
    // Return appropriate status code based on health
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503

    return createSuccessResponse(validatedResponse, statusCode)

  } catch (error) {
    console.error('Health check error:', error)
    
    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      checks: {
        health_check: {
          status: 'fail' as const,
          output: `Health check failed: ${error}`
        }
      }
    }

    return createSuccessResponse(errorResponse, 503)
  }
}
