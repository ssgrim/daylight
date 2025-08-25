// Security middleware for AWS Lambda handlers
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

export interface SecurityHeaders {
  "Strict-Transport-Security": string;
  "X-Content-Type-Options": string;
  "X-Frame-Options": string;
  "X-XSS-Protection": string;
  "Content-Security-Policy": string;
  "Referrer-Policy": string;
  "Permissions-Policy": string;
}

export const DEFAULT_SECURITY_HEADERS: SecurityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

export interface CorsConfig {
  allowedOrigins: string[];
  allowCredentials: boolean;
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge?: number;
}

export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [], // Must be configured per environment
  allowCredentials: true,
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-API-Key",
  ],
  maxAge: 86400, // 24 hours
};

/**
 * Add security headers to Lambda response
 */
export function addSecurityHeaders(
  response: APIGatewayProxyStructuredResultV2,
  customHeaders: Partial<SecurityHeaders> = {},
): APIGatewayProxyStructuredResultV2 {
  const securityHeaders = { ...DEFAULT_SECURITY_HEADERS, ...customHeaders };

  return {
    ...response,
    headers: {
      ...response.headers,
      ...securityHeaders,
    },
  };
}

/**
 * Add CORS headers to Lambda response
 */
export function addCorsHeaders(
  response: APIGatewayProxyStructuredResultV2,
  event: APIGatewayProxyEventV2,
  config: Partial<CorsConfig> = {},
): APIGatewayProxyStructuredResultV2 {
  const corsConfig = { ...DEFAULT_CORS_CONFIG, ...config };
  const origin = event.headers?.origin || event.headers?.Origin;

  // Determine allowed origin
  let allowedOrigin = "null";
  if (origin && corsConfig.allowedOrigins.length > 0) {
    if (corsConfig.allowedOrigins.includes(origin)) {
      allowedOrigin = origin;
    }
  } else if (corsConfig.allowedOrigins.includes("*")) {
    allowedOrigin = "*";
  }

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": corsConfig.allowedMethods.join(", "),
    "Access-Control-Allow-Headers": corsConfig.allowedHeaders.join(", "),
    Vary: "Origin",
  };

  if (corsConfig.allowCredentials && allowedOrigin !== "*") {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  if (corsConfig.maxAge) {
    corsHeaders["Access-Control-Max-Age"] = corsConfig.maxAge.toString();
  }

  return {
    ...response,
    headers: {
      ...response.headers,
      ...corsHeaders,
    },
  };
}

/**
 * Rate limiting implementation using DynamoDB
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator: (event: APIGatewayProxyEventV2) => string;
}

export async function checkRateLimit(
  event: APIGatewayProxyEventV2,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; resetTime: number; remaining: number }> {
  try {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } =
      await import("@aws-sdk/lib-dynamodb");

    const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const tableName = process.env.RATE_LIMIT_TABLE || "daylight_rate_limits";

    const key = config.keyGenerator(event);
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const resetTime = windowStart + config.windowMs;

    const recordKey = `${key}:${windowStart}`;

    try {
      // Try to get existing record
      const result = await dynamodb.send(
        new GetCommand({
          TableName: tableName,
          Key: { rateLimitKey: recordKey },
        }),
      );

      if (result.Item) {
        const currentCount = result.Item.requestCount || 0;

        if (currentCount >= config.maxRequests) {
          return {
            allowed: false,
            resetTime,
            remaining: 0,
          };
        }

        // Increment counter
        await dynamodb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { rateLimitKey: recordKey },
            UpdateExpression: "SET requestCount = requestCount + :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          }),
        );

        return {
          allowed: true,
          resetTime,
          remaining: config.maxRequests - currentCount - 1,
        };
      } else {
        // Create new record
        await dynamodb.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              rateLimitKey: recordKey,
              requestCount: 1,
              ttl: Math.floor(resetTime / 1000) + 60, // TTL with buffer
            },
          }),
        );

        return {
          allowed: true,
          resetTime,
          remaining: config.maxRequests - 1,
        };
      }
    } catch (error) {
      // If rate limiting fails, allow the request (fail open)
      console.error("Rate limiting error:", error);
      return {
        allowed: true,
        resetTime,
        remaining: config.maxRequests,
      };
    }
  } catch (error) {
    // If rate limiting module fails to load, allow the request
    console.error("Rate limiting module error:", error);
    return {
      allowed: true,
      resetTime: Date.now() + config.windowMs,
      remaining: config.maxRequests,
    };
  }
}

/**
 * Input sanitization utilities
 */
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Basic XSS prevention
    return input
      .replace(/[<>'"&]/g, (char) => {
        const map: Record<string, string> = {
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "&": "&amp;",
        };
        return map[char] || char;
      })
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Comprehensive security middleware wrapper
 */
export function withSecurity(
  handler: (
    event: APIGatewayProxyEventV2,
  ) => Promise<APIGatewayProxyStructuredResultV2>,
  options: {
    cors?: Partial<CorsConfig>;
    rateLimit?: RateLimitConfig;
    sanitizeInput?: boolean;
    requireAuth?: boolean;
  } = {},
) {
  return async (
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      // Handle preflight requests
      if (event.requestContext.http.method === "OPTIONS") {
        let response: APIGatewayProxyStructuredResultV2 = {
          statusCode: 204,
          headers: { "Content-Type": "application/json" },
          body: "",
        };

        if (options.cors) {
          response = addCorsHeaders(response, event, options.cors);
        }

        return addSecurityHeaders(response);
      }

      // Rate limiting check
      if (options.rateLimit) {
        const rateLimitResult = await checkRateLimit(event, options.rateLimit);

        if (!rateLimitResult.allowed) {
          let response: APIGatewayProxyStructuredResultV2 = {
            statusCode: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": Math.ceil(
                (rateLimitResult.resetTime - Date.now()) / 1000,
              ).toString(),
              "X-RateLimit-Limit": options.rateLimit.maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            },
            body: JSON.stringify({
              error: "Rate limit exceeded",
              resetTime: rateLimitResult.resetTime,
            }),
          };

          if (options.cors) {
            response = addCorsHeaders(response, event, options.cors);
          }

          return addSecurityHeaders(response);
        }
      }

      // Sanitize input if enabled
      if (options.sanitizeInput && event.body) {
        try {
          const parsedBody = JSON.parse(event.body);
          const sanitizedBody = sanitizeInput(parsedBody);
          event.body = JSON.stringify(sanitizedBody);
        } catch {
          // If body isn't JSON, leave it as is
        }
      }

      // Call the actual handler
      let response = await handler(event);

      // Add CORS headers if configured
      if (options.cors) {
        response = addCorsHeaders(response, event, options.cors);
      }

      // Always add security headers
      return addSecurityHeaders(response);
    } catch (error) {
      console.error("Security middleware error:", error);

      let errorResponse: APIGatewayProxyStructuredResultV2 = {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Internal server error" }),
      };

      if (options.cors) {
        errorResponse = addCorsHeaders(errorResponse, event, options.cors);
      }

      return addSecurityHeaders(errorResponse);
    }
  };
}
