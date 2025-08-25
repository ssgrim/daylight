/**
 * Comprehensive Health Check Handler
 * 
 * Provides detailed health status for the Daylight application including:
 * - Basic service availability
 * - Database connectivity 
 * - External service dependencies
 * - System resource utilization
 * - Performance metrics
 * - Secrets management system
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { getSecretsHealthSummary } from './secrets-health.js'

// Simple CORS helper function
function addCorsHeaders(response: any, event: any) {
  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    }
  }
}

// Health check types
interface HealthCheck {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  message?: string
  details?: Record<string, any>
  lastChecked: string
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  environment: string
  uptime: number
  checks: HealthCheck[]
  summary: {
    total: number
    healthy: number
    unhealthy: number
    degraded: number
  }
}

// Cache health check results briefly to avoid excessive API calls
const healthCache = new Map<string, { result: HealthCheck; expires: number }>()
const CACHE_TTL = 30000 // 30 seconds

/**
 * Cached health check execution
 */
async function cachedHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): Promise<HealthCheck> {
  const now = Date.now()
  const cached = healthCache.get(name)
  
  if (cached && cached.expires > now) {
    return cached.result
  }

  try {
    const result = await checkFn()
    healthCache.set(name, { result, expires: now + CACHE_TTL })
    return result
  } catch (error) {
    const errorResult: HealthCheck = {
      name,
      status: 'unhealthy',
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
    healthCache.set(name, { result: errorResult, expires: now + CACHE_TTL })
    return errorResult
  }
}

/**
 * Check DynamoDB connectivity
 */
async function checkDynamoDB(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Import DynamoDB client lazily to avoid startup overhead
    const { DynamoDBClient, DescribeTableCommand } = await import('@aws-sdk/client-dynamodb')
    
    const tableName = process.env.TABLE_TRIPS || process.env.TRIPS_TABLE
    if (!tableName) {
      return {
        name: 'dynamodb',
        status: 'degraded',
        message: 'No table name configured',
        lastChecked: new Date().toISOString()
      }
    }

    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-1'
    })

    const command = new DescribeTableCommand({ TableName: tableName })
    const response = await client.send(command)
    
    const responseTime = Date.now() - startTime
    const isHealthy = response.Table?.TableStatus === 'ACTIVE'

    return {
      name: 'dynamodb',
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      message: isHealthy ? 'Table active and accessible' : `Table status: ${response.Table?.TableStatus}`,
      details: {
        tableName,
        tableStatus: response.Table?.TableStatus,
        itemCount: response.Table?.ItemCount,
        provisionedThroughput: response.Table?.ProvisionedThroughput
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: 'dynamodb',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
  }
}

/**
 * Check external weather service connectivity
 */
async function checkWeatherService(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const provider = process.env.WEATHER_PROVIDER || 'open-meteo'
    let url: string
    let headers: Record<string, string> = {}

    if (provider === 'open-meteo') {
      // Use a simple request to check service availability
      url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current_weather=true'
    } else {
      return {
        name: 'weather_service',
        status: 'degraded',
        message: `Unsupported weather provider: ${provider}`,
        lastChecked: new Date().toISOString()
      }
    }

    const response = await fetch(url, { 
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    const responseTime = Date.now() - startTime
    const isHealthy = response.ok

    let details: Record<string, any> = {
      provider,
      statusCode: response.status
    }

    if (isHealthy && provider === 'open-meteo') {
      try {
        const data = await response.json()
        details.hasCurrentWeather = !!data.current_weather
      } catch {
        // Ignore JSON parsing errors for health check
      }
    }

    return {
      name: 'weather_service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      message: isHealthy ? `${provider} service operational` : `${provider} service unavailable`,
      details,
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: 'weather_service',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
  }
}

/**
 * Check geocoding service connectivity
 */
async function checkGeocodingService(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const provider = process.env.GEOCODE_PROVIDER || 'nominatim'
    let url: string
    let headers: Record<string, string> = {}

    if (provider === 'nominatim') {
      url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=40.7128&lon=-74.0060'
      headers['User-Agent'] = 'daylight/health-check (+https://daylight.app)'
    } else if (provider === 'mapbox') {
      const token = process.env.MAPBOX_TOKEN
      if (!token) {
        return {
          name: 'geocoding_service',
          status: 'degraded',
          message: 'Mapbox token not configured',
          lastChecked: new Date().toISOString()
        }
      }
      url = `https://api.mapbox.com/geocoding/v5/mapbox.places/-74.0060,40.7128.json?access_token=${encodeURIComponent(token)}&limit=1`
    } else {
      return {
        name: 'geocoding_service',
        status: 'degraded',
        message: `Unsupported geocoding provider: ${provider}`,
        lastChecked: new Date().toISOString()
      }
    }

    const response = await fetch(url, { 
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    const responseTime = Date.now() - startTime
    const isHealthy = response.ok

    return {
      name: 'geocoding_service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      message: isHealthy ? `${provider} service operational` : `${provider} service unavailable`,
      details: {
        provider,
        statusCode: response.status
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: 'geocoding_service',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
  }
}

/**
 * Check Lambda function health (memory, execution environment)
 */
async function checkLambdaHealth(): Promise<HealthCheck> {
  try {
    const memorySize = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME
    const runtime = process.env.AWS_EXECUTION_ENV
    
    // Get memory usage
    const memUsage = process.memoryUsage()
    const memoryUtilization = memorySize ? 
      Math.round((memUsage.heapUsed / (parseInt(memorySize) * 1024 * 1024)) * 100) : 
      undefined

    // Check if memory utilization is concerning
    const status = memoryUtilization && memoryUtilization > 85 ? 'degraded' : 'healthy'
    const message = memoryUtilization ? 
      `Memory utilization: ${memoryUtilization}%` : 
      'Function health nominal'

    return {
      name: 'lambda_function',
      status,
      message,
      details: {
        functionName,
        runtime,
        memorySize: memorySize ? `${memorySize}MB` : 'unknown',
        memoryUtilization: memoryUtilization ? `${memoryUtilization}%` : 'unknown',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: 'lambda_function',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
  }
}

/**
 * Check secrets management system health
 */
async function checkSecretsManagement(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const summary = await getSecretsHealthSummary()
    
    return {
      name: 'secrets_management',
      status: summary.status === 'pass' ? 'healthy' : summary.status === 'warn' ? 'degraded' : 'unhealthy',
      responseTime: Date.now() - startTime,
      message: summary.message,
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: 'secrets_management',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
  }
}

/**
 * Perform basic application health check
 */
async function checkApplication(): Promise<HealthCheck> {
  try {
    // Verify core application dependencies are available
    const coreModules = [
      '../lib/external',
    ]

    for (const module of coreModules) {
      try {
        await import(module)
      } catch (error) {
        return {
          name: 'application',
          status: 'unhealthy',
          message: `Failed to load core module: ${module}`,
          details: { error: String(error) },
          lastChecked: new Date().toISOString()
        }
      }
    }

    return {
      name: 'application',
      status: 'healthy',
      message: 'Core application modules loaded successfully',
      details: {
        modules: coreModules
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: 'application',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : String(error),
      lastChecked: new Date().toISOString()
    }
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const startTime = Date.now()
  
  try {
    // Determine check level based on query parameters
    const queryParams = event.queryStringParameters || {}
    const checkLevel = queryParams.level || 'basic' // basic, full, deep
    const format = queryParams.format || 'json' // json, prometheus
    
    // Always perform basic health checks
    const checks: HealthCheck[] = []
    
    // Basic application health
    checks.push(await cachedHealthCheck('application', checkApplication))
    checks.push(await cachedHealthCheck('lambda_function', checkLambdaHealth))
    
    // Full health checks include external dependencies
    if (checkLevel === 'full' || checkLevel === 'deep') {
      checks.push(await cachedHealthCheck('dynamodb', checkDynamoDB))
      checks.push(await cachedHealthCheck('weather_service', checkWeatherService))
      checks.push(await cachedHealthCheck('geocoding_service', checkGeocodingService))
      
      // Add secrets management health check
      checks.push(await cachedHealthCheck('secrets_management', checkSecretsManagement))
    }

    // Calculate overall status
    const healthyCounts = checks.reduce(
      (acc, check) => {
        acc.total++
        if (check.status === 'healthy') acc.healthy++
        else if (check.status === 'unhealthy') acc.unhealthy++
        else if (check.status === 'degraded') acc.degraded++
        return acc
      },
      { total: 0, healthy: 0, unhealthy: 0, degraded: 0 }
    )

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded'
    if (healthyCounts.unhealthy > 0) {
      overallStatus = 'unhealthy'
    } else if (healthyCounts.degraded > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME?.includes('prod') ? 'production' : 'development',
      uptime: Date.now() - startTime,
      checks,
      summary: healthyCounts
    }

    // Handle different response formats
    let responseBody: string
    let contentType: string

    if (format === 'prometheus') {
      // Prometheus metrics format
      const metrics = [
        `# HELP daylight_health_status Health status of the service (1=healthy, 0.5=degraded, 0=unhealthy)`,
        `# TYPE daylight_health_status gauge`,
        `daylight_health_status{service="daylight"} ${overallStatus === 'healthy' ? 1 : overallStatus === 'degraded' ? 0.5 : 0}`,
        '',
        `# HELP daylight_health_check_status Individual health check status`,
        `# TYPE daylight_health_check_status gauge`,
        ...checks.map(check => 
          `daylight_health_check_status{check="${check.name}"} ${check.status === 'healthy' ? 1 : check.status === 'degraded' ? 0.5 : 0}`
        ),
        '',
        `# HELP daylight_health_response_time_seconds Health check response times`,
        `# TYPE daylight_health_response_time_seconds gauge`,
        ...checks
          .filter(check => check.responseTime !== undefined)
          .map(check => `daylight_health_response_time_seconds{check="${check.name}"} ${(check.responseTime! / 1000).toFixed(3)}`),
      ].join('\n')

      responseBody = metrics
      contentType = 'text/plain; charset=utf-8'
    } else {
      responseBody = JSON.stringify(response, null, 2)
      contentType = 'application/json'
    }

    // Set appropriate HTTP status code based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

    const lambdaResponse = {
      statusCode: httpStatus,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store, no-cache, must-revalidate',
        'x-health-status': overallStatus,
        'x-response-time': `${Date.now() - startTime}ms`
      },
      body: responseBody
    }

    return addCorsHeaders(lambdaResponse, event)
  } catch (error) {
    const errorResponse = {
      statusCode: 503,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        message: 'Health check system failure'
      }, null, 2)
    }

    return addCorsHeaders(errorResponse, event)
  }
}
