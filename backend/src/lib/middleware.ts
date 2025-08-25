/**
 * Validation Middleware and Utilities
 * Provides validation helpers and error handling for API handlers
 */

import { z } from 'zod'
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'

// Custom validation error class
export class ValidationError extends Error {
  public readonly statusCode: number
  public readonly validationErrors: ValidationIssue[]

  constructor(message: string, validationErrors: ValidationIssue[], statusCode: number = 400) {
    super(message)
    this.name = 'ValidationError'
    this.statusCode = statusCode
    this.validationErrors = validationErrors
  }
}

// Validation issue interface
export interface ValidationIssue {
  field: string
  message: string
  code: string
  received?: any
}

// Convert Zod errors to our validation issues format
export function formatZodErrors(error: z.ZodError): ValidationIssue[] {
  return error.issues.map(issue => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
    received: 'received' in issue ? issue.received : undefined
  }))
}

// Create standardized error response
export function createErrorResponse(
  error: string,
  message: string,
  statusCode: number,
  path?: string,
  validationErrors?: ValidationIssue[]
): APIGatewayProxyResultV2 {
  const errorResponse = {
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path,
    validationErrors
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    },
    body: JSON.stringify(errorResponse)
  }
}

// Create success response
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  headers: Record<string, string> = {}
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      ...headers
    },
    body: JSON.stringify(data)
  }
}

// Validate request body with schema
export function validateBody<T>(
  body: string | null | undefined,
  schema: z.ZodSchema<T>
): T {
  if (!body) {
    throw new ValidationError('Request body is required', [
      { field: 'body', message: 'Request body is required', code: 'required' }
    ])
  }

  let parsed: any
  try {
    parsed = JSON.parse(body)
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body', [
      { field: 'body', message: 'Invalid JSON format', code: 'invalid_json' }
    ])
  }

  try {
    return schema.parse(parsed)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Validation failed', formatZodErrors(error))
    }
    throw error
  }
}

// Validate query parameters with schema
export function validateQuery<T>(
  queryParams: Record<string, string | undefined> | null | undefined,
  schema: z.ZodSchema<T>
): T {
  const params = queryParams || {}
  
  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', formatZodErrors(error))
    }
    throw error
  }
}

// Validate path parameters with schema
export function validateParams<T>(
  pathParams: Record<string, string | undefined> | null | undefined,
  schema: z.ZodSchema<T>
): T {
  const params = pathParams || {}
  
  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid path parameters', formatZodErrors(error))
    }
    throw error
  }
}

// Validate response data before sending
export function validateResponse<T>(
  data: any,
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Response validation failed:', formatZodErrors(error))
      throw new Error('Internal server error: invalid response format')
    }
    throw error
  }
}

// Higher-order function to wrap handlers with validation and error handling
export function withValidation<TBody = any, TQuery = any, TParams = any>(
  handler: (event: APIGatewayProxyEventV2, body?: TBody, query?: TQuery, params?: TParams) => Promise<APIGatewayProxyResultV2>,
  options: {
    bodySchema?: z.ZodSchema<TBody>
    querySchema?: z.ZodSchema<TQuery>
    paramsSchema?: z.ZodSchema<TParams>
    requireAuth?: boolean
  } = {}
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      // Handle CORS preflight
      if (event.requestContext.http.method === 'OPTIONS') {
        return {
          statusCode: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Max-Age': '86400'
          }
        }
      }

      // Extract and validate authorization if required
      if (options.requireAuth) {
        const authHeader = event.headers?.authorization || event.headers?.Authorization
        if (!authHeader) {
          return createErrorResponse(
            'UNAUTHORIZED',
            'Authorization header is required',
            401,
            event.requestContext.http.path
          )
        }

        // Basic validation - in production, verify JWT or API key
        if (!authHeader.startsWith('Bearer ')) {
          return createErrorResponse(
            'UNAUTHORIZED',
            'Invalid authorization format. Expected: Bearer <token>',
            401,
            event.requestContext.http.path
          )
        }
      }

      // Validate request components
      let validatedBody: TBody | undefined
      let validatedQuery: TQuery | undefined
      let validatedParams: TParams | undefined

      if (options.bodySchema) {
        validatedBody = validateBody(event.body, options.bodySchema)
      }

      if (options.querySchema) {
        validatedQuery = validateQuery(event.queryStringParameters, options.querySchema)
      }

      if (options.paramsSchema) {
        validatedParams = validateParams(event.pathParameters, options.paramsSchema)
      }

      // Call the actual handler
      return await handler(event, validatedBody, validatedQuery, validatedParams)

    } catch (error) {
      console.error('Handler error:', error)

      if (error instanceof ValidationError) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          error.message,
          error.statusCode,
          event.requestContext.http.path,
          error.validationErrors
        )
      }

      // Handle other known error types
      if (error instanceof SyntaxError) {
        return createErrorResponse(
          'INVALID_JSON',
          'Invalid JSON in request body',
          400,
          event.requestContext.http.path
        )
      }

      // Generic error handling
      const statusCode = (error as any).statusCode || 500
      const message = statusCode === 500 
        ? 'Internal server error' 
        : (error as Error).message || 'Unknown error'

      return createErrorResponse(
        'INTERNAL_ERROR',
        message,
        statusCode,
        event.requestContext.http.path
      )
    }
  }
}

// Utility to validate environment variables
export function validateEnvVar(name: string, required: boolean = true): string | undefined {
  const value = process.env[name]
  
  if (required && !value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  
  return value
}

// Utility to validate and parse JSON environment variables
export function validateJsonEnvVar<T>(
  name: string, 
  schema: z.ZodSchema<T>, 
  required: boolean = true
): T | undefined {
  const value = validateEnvVar(name, required)
  
  if (!value) {
    return undefined
  }
  
  try {
    const parsed = JSON.parse(value)
    return schema.parse(parsed)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = formatZodErrors(error)
      throw new Error(`Invalid JSON in environment variable ${name}: ${issues.map(i => i.message).join(', ')}`)
    }
    
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON syntax in environment variable ${name}`)
    }
    
    throw error
  }
}

// Sanitize data for logging (remove sensitive information)
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'auth']
  const sanitized = { ...data }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key])
    }
  }

  return sanitized
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  clientId: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = clientId
  const current = rateLimitStore.get(key)

  if (!current || now > current.resetTime) {
    // New window or expired window
    const resetTime = now + windowMs
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }

  if (current.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: current.resetTime }
  }

  // Increment counter
  current.count++
  rateLimitStore.set(key, current)
  
  return { 
    allowed: true, 
    remaining: maxRequests - current.count, 
    resetTime: current.resetTime 
  }
}

// Clean up expired rate limit entries
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute
