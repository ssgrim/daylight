# API Management & Rate Limiting System

## Overview

This comprehensive API management system provides enterprise-grade rate limiting, API key management, usage analytics, and developer portal capabilities. Built on top of our security framework, it offers fine-grained control over API access with real-time monitoring and automated abuse prevention.

## Features

### 🔐 API Key Management
- **Secure Key Generation**: Cryptographically secure API keys with configurable expiration
- **Scope-Based Permissions**: Fine-grained access control with custom scopes
- **IP Whitelisting**: Restrict API keys to specific IP addresses or ranges
- **Key Rotation**: Seamless API key regeneration without service interruption
- **Lifecycle Management**: Active, disabled, and expired key states

### ⚡ Advanced Rate Limiting
- **Multiple Algorithms**: Token bucket, fixed window, sliding window, and leaky bucket
- **Flexible Configuration**: Per-key, per-endpoint, and global rate limits
- **Dynamic Adjustment**: Real-time rate limit updates without restart
- **Burst Handling**: Configurable burst allowances for traffic spikes
- **Geographic Limits**: Location-based rate limiting and restrictions

### 📊 Usage Analytics & Monitoring
- **Real-Time Metrics**: Request counts, response times, error rates
- **Usage Quotas**: Monthly/daily quotas with automatic enforcement
- **Geographic Analytics**: Request distribution by country/region
- **Error Tracking**: Detailed error classification and trends
- **Custom Dashboards**: Developer and admin analytics interfaces

### 🛡️ Security & Protection
- **DDoS Protection**: Automatic threat detection and mitigation
- **Abuse Prevention**: Behavioral analysis and blocking
- **Security Monitoring**: Integration with security framework
- **Audit Logging**: Complete API access audit trail
- **Threat Intelligence**: Malicious IP and pattern detection

### 🎯 Developer Experience
- **Self-Service Portal**: Complete API key management interface
- **Interactive Documentation**: Auto-generated API documentation
- **Usage Dashboards**: Real-time usage and quota monitoring
- **Testing Tools**: Built-in API key validation endpoints
- **Support Integration**: Help desk and support ticket system

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  Rate Limiting   │────│   Analytics     │
│   Middleware    │    │     Engine       │    │    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Key       │    │    Security      │    │   Developer     │
│   Management    │    │   Monitoring     │    │    Portal       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

1. **Request Reception**: API gateway receives and validates requests
2. **Authentication**: API key validation and user identification  
3. **Authorization**: Scope and permission checking
4. **Rate Limiting**: Algorithm-based request throttling
5. **Request Processing**: Forward to application handlers
6. **Response Handling**: Add headers and collect metrics
7. **Analytics Recording**: Store usage data and update quotas

## Implementation

### API Key Types

```typescript
interface ApiKey {
  id: string;                    // Unique identifier
  keyValue: string;              // The actual API key
  name: string;                  // Human-readable name
  description?: string;          // Optional description
  userId: string;                // Owner user ID
  scopes: string[];              // Allowed operations
  allowedIps?: string[];         // IP restrictions
  rateLimits: string[];          // Applied rate limit IDs
  quotas: ApiKeyQuota[];         // Usage quotas
  status: 'active' | 'disabled' | 'expired';
  expiresAt?: string;            // Optional expiration
  metadata: Record<string, any>; // Custom metadata
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}
```

### Rate Limiting Algorithms

#### Token Bucket
```typescript
interface TokenBucketConfig {
  capacity: number;      // Maximum tokens
  refillRate: number;    // Tokens per second
  refillPeriod: number;  // Refill interval (ms)
}
```

#### Fixed Window
```typescript
interface FixedWindowConfig {
  limit: number;         // Requests per window
  windowSize: number;    // Window duration (ms)
}
```

#### Sliding Window
```typescript
interface SlidingWindowConfig {
  limit: number;         // Requests per window
  windowSize: number;    // Window duration (ms)
  precision: number;     // Sub-window count
}
```

#### Leaky Bucket
```typescript
interface LeakyBucketConfig {
  capacity: number;      // Bucket size
  leakRate: number;      // Leak rate per second
}
```

### Usage Analytics

```typescript
interface ApiUsage {
  id: string;
  timestamp: string;
  date: string;              // YYYY-MM-DD for aggregation
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  rateLimitHit: boolean;
  rateLimitRemaining: number;
  quotaUsed: Record<string, number>;
  ipAddress: string;
  userAgent: string;
  country?: string;
  region?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

## API Endpoints

### API Key Management

```http
# Create API Key
POST /api/keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My API Key",
  "description": "For my mobile app",
  "scopes": ["api:read", "api:write"],
  "allowedIps": ["192.168.1.0/24"],
  "expiresAt": "2024-12-31T23:59:59Z"
}

# List API Keys
GET /api/keys?limit=50&offset=0&status=active

# Get API Key Details
GET /api/keys/{id}

# Update API Key
PUT /api/keys/{id}
{
  "name": "Updated Name",
  "status": "disabled"
}

# Delete API Key
DELETE /api/keys/{id}

# Regenerate API Key
POST /api/keys/{id}/regenerate
```

### Usage Analytics

```http
# Get API Key Usage
GET /api/keys/{id}/usage?startDate=2024-01-01&endDate=2024-01-31&granularity=daily

# Get User Analytics
GET /api/analytics/user?startDate=2024-01-01&endDate=2024-01-31

# Get Usage Quota
GET /api/analytics/quota
```

### Rate Limit Management

```http
# Get Rate Limits
GET /api/rate-limits

# Update Rate Limit
PUT /api/rate-limits/{id}
{
  "enabled": false,
  "limit": 1000
}
```

### Admin APIs

```http
# System Analytics (Admin)
GET /api/admin/analytics?startDate=2024-01-01&endDate=2024-01-31

# All API Keys (Admin)
GET /api/admin/keys?limit=100&userId=user123

# Create Rate Limit (Admin)
POST /api/admin/rate-limits
{
  "name": "Premium Tier",
  "algorithm": "token_bucket",
  "config": {
    "capacity": 1000,
    "refillRate": 10,
    "refillPeriod": 1000
  }
}
```

## Security Features

### Request Validation
- **Size Limits**: Configurable request/response size limits
- **Method Validation**: Allowed HTTP methods per endpoint
- **Content-Type**: Required content types validation
- **Header Validation**: Required and forbidden headers

### DDoS Protection
- **IP-Based Limiting**: Aggressive rate limiting for unknown IPs
- **Pattern Detection**: Suspicious request pattern analysis
- **Automatic Blocking**: Temporary IP bans for abuse
- **Whitelist Support**: Trusted IP whitelist bypass

### Security Monitoring
- **Attack Detection**: SQL injection, XSS, path traversal attempts
- **Behavioral Analysis**: Unusual usage pattern detection
- **Threat Intelligence**: Integration with threat feeds
- **Incident Response**: Automated security event handling

## Usage Examples

### Basic API Key Authentication

```javascript
// Using API key in header
fetch('/api/data', {
  headers: {
    'X-API-Key': 'your-api-key-here',
    'Content-Type': 'application/json'
  }
});

// Using API key in Authorization header
fetch('/api/data', {
  headers: {
    'Authorization': 'Bearer your-api-key-here',
    'Content-Type': 'application/json'
  }
});

// Using API key in query parameter
fetch('/api/data?api_key=your-api-key-here');
```

### Rate Limit Handling

```javascript
async function apiCallWithRetry(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Rate limited
      const retryAfter = response.headers.get('Retry-After');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      
      console.log(`Rate limited. Retry after: ${retryAfter}s`);
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return apiCallWithRetry(url, options);
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

### Error Handling

```javascript
fetch('/api/data', {
  headers: { 'X-API-Key': 'invalid-key' }
})
.then(response => {
  if (!response.ok) {
    return response.json().then(error => {
      switch (error.error.code) {
        case 'INVALID_API_KEY':
          console.error('API key is invalid or expired');
          break;
        case 'INSUFFICIENT_PERMISSIONS':
          console.error('API key lacks required permissions');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          console.error('Rate limit exceeded');
          break;
        case 'QUOTA_EXCEEDED':
          console.error('Monthly quota exceeded');
          break;
        default:
          console.error('API error:', error.error.message);
      }
      throw new Error(error.error.message);
    });
  }
  return response.json();
});
```

## Configuration

### Environment Variables

```bash
# API Gateway Configuration
API_GATEWAY_ENABLED=true
API_GATEWAY_MAX_REQUEST_SIZE=1048576
API_GATEWAY_RATE_LIMITING_ENABLED=true
API_GATEWAY_ANALYTICS_ENABLED=true
API_GATEWAY_CORS_ENABLED=true

# DDoS Protection
DDOS_PROTECTION_ENABLED=true
DDOS_PROTECTION_THRESHOLD=100
DDOS_PROTECTION_WINDOW_MS=60000
DDOS_PROTECTION_WHITELIST_IPS=127.0.0.1,::1

# Database Configuration
API_GATEWAY_TABLE_NAME=api-gateway
API_GATEWAY_USAGE_TABLE_NAME=api-usage
API_GATEWAY_RATE_LIMITS_TABLE_NAME=rate-limits

# Security
API_KEY_ENCRYPTION_KEY_ID=alias/api-gateway-keys
API_KEY_LENGTH=32
API_KEY_PREFIX=dlt_

# Monitoring
METRICS_ENABLED=true
CLOUDWATCH_NAMESPACE=Daylight/ApiGateway
AUDIT_LOGGING_ENABLED=true
```

### Rate Limit Configuration

```typescript
const rateLimitConfigs = {
  // Free tier
  free: {
    algorithm: 'fixed_window',
    config: {
      limit: 1000,
      windowSize: 3600000 // 1 hour
    }
  },
  
  // Premium tier
  premium: {
    algorithm: 'token_bucket',
    config: {
      capacity: 10000,
      refillRate: 10,
      refillPeriod: 1000
    }
  },
  
  // Enterprise tier
  enterprise: {
    algorithm: 'sliding_window',
    config: {
      limit: 100000,
      windowSize: 3600000,
      precision: 12 // 5-minute sub-windows
    }
  }
};
```

## Monitoring & Observability

### Key Metrics

- **Request Volume**: Total requests per time period
- **Success Rate**: Percentage of successful requests (2xx status)
- **Response Time**: Average, P50, P95, P99 response times
- **Error Rates**: 4xx and 5xx error percentages
- **Rate Limit Hits**: Percentage of rate-limited requests
- **Quota Usage**: API key quota consumption rates
- **Active Keys**: Number of active API keys
- **Geographic Distribution**: Request distribution by location

### Alerting

```typescript
const alerts = {
  highErrorRate: {
    metric: 'error_rate',
    threshold: 0.05, // 5%
    duration: 300,   // 5 minutes
    severity: 'warning'
  },
  
  rateLimitSpike: {
    metric: 'rate_limit_hits',
    threshold: 0.1,  // 10%
    duration: 60,    // 1 minute
    severity: 'warning'
  },
  
  ddosAttack: {
    metric: 'requests_per_ip',
    threshold: 1000,
    duration: 60,
    severity: 'critical'
  }
};
```

### Dashboard Components

1. **Real-Time Overview**: Live request counts and success rates
2. **Rate Limiting**: Active limits and hit rates
3. **API Key Management**: Key counts, usage, and status
4. **Geographic Map**: Global request distribution
5. **Error Analysis**: Error types and trends
6. **Performance Metrics**: Response time distributions
7. **Security Events**: Attack attempts and blocks

## Best Practices

### API Key Security
1. **Never expose API keys** in client-side code
2. **Use HTTPS** for all API communications
3. **Rotate keys regularly** especially for production use
4. **Use minimal scopes** required for each use case
5. **Monitor usage patterns** for anomalies
6. **Implement IP restrictions** when possible

### Rate Limiting Strategy
1. **Layer rate limits** (global, per-key, per-endpoint)
2. **Use appropriate algorithms** for different use cases
3. **Provide clear error messages** with retry information
4. **Implement exponential backoff** in clients
5. **Monitor and adjust limits** based on usage patterns

### Performance Optimization
1. **Cache rate limit states** in Redis or memory
2. **Use efficient algorithms** for high-throughput scenarios
3. **Implement request queuing** for burst handling
4. **Optimize database queries** with proper indexing
5. **Monitor latency impact** of middleware

## Troubleshooting

### Common Issues

#### Rate Limit False Positives
```bash
# Check rate limit configuration
GET /api/rate-limits

# Verify API key quotas
GET /api/keys/{id}

# Review usage patterns
GET /api/keys/{id}/usage?granularity=hourly
```

#### Performance Issues
```bash
# Check middleware latency
grep "responseTime" /var/log/api-gateway.log

# Monitor database performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits

# Review rate limit algorithm efficiency
```

#### Security Alerts
```bash
# Check security events
GET /api/admin/security/events?type=attack_attempt

# Review blocked IPs
GET /api/admin/security/blocked-ips

# Analyze threat patterns
grep "security\\.attack_attempt" /var/log/audit.log
```

## Future Enhancements

### Planned Features
- **GraphQL Support**: Rate limiting for GraphQL queries
- **WebSocket Management**: Real-time connection limits
- **Machine Learning**: Predictive rate limiting and anomaly detection
- **Multi-Region**: Global rate limiting across regions
- **Custom Algorithms**: Plugin system for custom rate limiting
- **Advanced Analytics**: Predictive usage analytics

### Integration Roadmap
- **API Gateway Integration**: AWS API Gateway and others
- **CDN Integration**: CloudFlare and CloudFront
- **Monitoring Platforms**: DataDog, New Relic integration
- **Identity Providers**: SAML and OAuth2 for developer accounts
- **Billing Systems**: Usage-based billing integration

## Support

For technical support or questions about the API management system:

1. **Documentation**: Check this guide and API documentation
2. **Developer Portal**: Use the built-in help and testing tools
3. **Monitoring**: Review metrics and logs for issues
4. **Issue Tracking**: Create GitHub issues for bugs or feature requests
5. **Community**: Join our developer community forums

---

*This API management system is designed to scale with your needs while providing enterprise-grade security and monitoring capabilities.*
