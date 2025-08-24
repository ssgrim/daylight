/**
 * CORS Configuration Utility
 * Provides secure CORS headers based on environment and allowed origins
 */

export interface CorsConfig {
  allowCredentials?: boolean;
  allowHeaders?: string[];
  allowMethods?: string[];
  allowOrigins?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
}

export interface CorsHeaders {
  'Access-Control-Allow-Origin'?: string;
  'Access-Control-Allow-Methods'?: string;
  'Access-Control-Allow-Headers'?: string;
  'Access-Control-Allow-Credentials'?: string;
  'Access-Control-Expose-Headers'?: string;
  'Access-Control-Max-Age'?: string;
  'Vary'?: string;
  [key: string]: string | undefined;
}

/**
 * Default CORS configuration based on environment
 */
const getDefaultCorsConfig = (): CorsConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  const commonConfig: CorsConfig = {
    allowCredentials: false,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-API-Key'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset'],
    maxAge: 86400 // 24 hours
  };

  switch (env) {
    case 'production':
      return {
        ...commonConfig,
        allowOrigins: [
          'https://daylight.app',
          'https://www.daylight.app',
          // Add CloudFront distribution URLs from environment
          ...(process.env.CLOUDFRONT_DOMAIN ? [`https://${process.env.CLOUDFRONT_DOMAIN}`] : []),
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
        ]
      };
    
    case 'staging':
      return {
        ...commonConfig,
        allowOrigins: [
          'https://staging.daylight.app',
          'https://daylight-staging.netlify.app',
          ...(process.env.CLOUDFRONT_DOMAIN ? [`https://${process.env.CLOUDFRONT_DOMAIN}`] : []),
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
        ]
      };
    
    case 'development':
    case 'dev':
      return {
        ...commonConfig,
        allowOrigins: [
          'http://localhost:3000',
          'http://localhost:5173', // Vite dev server
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
        ]
      };
    
    default:
      // Fallback for unknown environments - restrictive
      return {
        ...commonConfig,
        allowOrigins: ['http://localhost:3000']
      };
  }
};

/**
 * Check if an origin is allowed based on the CORS configuration
 */
export const isOriginAllowed = (origin: string | undefined, config?: CorsConfig): boolean => {
  if (!origin) return false;
  
  const corsConfig = config || getDefaultCorsConfig();
  
  if (!corsConfig.allowOrigins || corsConfig.allowOrigins.length === 0) {
    return false;
  }
  
  // Check for wildcard (only allow in development)
  if (corsConfig.allowOrigins.includes('*')) {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' || env === 'dev';
  }
  
  // Exact match check
  if (corsConfig.allowOrigins.includes(origin)) {
    return true;
  }
  
  // Pattern matching for subdomains (e.g., *.daylight.app)
  return corsConfig.allowOrigins.some(allowedOrigin => {
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.slice(2); // Remove *.
      return origin.endsWith(`.${domain}`) || origin === domain;
    }
    return false;
  });
};

/**
 * Generate CORS headers for HTTP responses
 */
export const getCorsHeaders = (
  requestOrigin?: string,
  requestMethod?: string,
  config?: CorsConfig
): CorsHeaders => {
  const corsConfig = config || getDefaultCorsConfig();
  const headers: CorsHeaders = {};
  
  // Determine allowed origin
  if (isOriginAllowed(requestOrigin, corsConfig)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin!;
    headers['Vary'] = 'Origin';
  } else if (corsConfig.allowOrigins?.includes('*')) {
    // Only allow * in development
    const env = process.env.NODE_ENV || 'development';
    if (env === 'development' || env === 'dev') {
      headers['Access-Control-Allow-Origin'] = '*';
    }
  }
  
  // Set other CORS headers if origin is allowed
  if (headers['Access-Control-Allow-Origin']) {
    if (corsConfig.allowMethods && corsConfig.allowMethods.length > 0) {
      headers['Access-Control-Allow-Methods'] = corsConfig.allowMethods.join(', ');
    }
    
    if (corsConfig.allowHeaders && corsConfig.allowHeaders.length > 0) {
      headers['Access-Control-Allow-Headers'] = corsConfig.allowHeaders.join(', ');
    }
    
    if (corsConfig.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
    
    if (corsConfig.exposeHeaders && corsConfig.exposeHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = corsConfig.exposeHeaders.join(', ');
    }
    
    if (corsConfig.maxAge) {
      headers['Access-Control-Max-Age'] = corsConfig.maxAge.toString();
    }
  }
  
  return headers;
};

/**
 * Handle preflight OPTIONS requests
 */
export const handlePreflightRequest = (
  event: any,
  config?: CorsConfig
): { statusCode: number; headers: CorsHeaders; body: string } => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const requestMethod = event.headers?.[`access-control-request-method`] || 
                       event.headers?.[`Access-Control-Request-Method`];
  
  const corsHeaders = getCorsHeaders(origin, requestMethod, config);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ''
  };
};

/**
 * Simple function to add CORS headers to a Lambda response
 */
export const addCorsHeaders = (
  headers: Record<string, string | number | boolean> = {},
  requestOrigin?: string,
  config?: CorsConfig
): Record<string, string | number | boolean> => {
  const corsHeaders = getCorsHeaders(requestOrigin, undefined, config);
  
  // Filter out undefined values to ensure type compatibility
  const filteredCorsHeaders: Record<string, string | number | boolean> = {};
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value !== undefined) {
      filteredCorsHeaders[key] = value;
    }
  });
  
  return {
    ...headers,
    ...filteredCorsHeaders
  };
};

/**
 * Get environment-specific CORS configuration
 */
export const getEnvironmentCorsConfig = (): CorsConfig => {
  return getDefaultCorsConfig();
};

export default {
  getCorsHeaders,
  handlePreflightRequest,
  addCorsHeaders,
  isOriginAllowed,
  getEnvironmentCorsConfig
};
