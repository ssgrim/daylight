# CORS Configuration Restriction - Security Enhancement

## Overview
This implementation addresses **Issue #83: Restrict CORS Configuration** by replacing the overly permissive `Access-Control-Allow-Origin: *` configuration with environment-specific domain restrictions.

## Changes Made

### 1. Backend Lambda Handlers

#### New CORS Utility (`backend/src/lib/cors.ts`)
- **Environment-aware CORS configuration**: Automatically configures allowed origins based on `NODE_ENV`
- **Domain validation**: Validates request origins against allowlists
- **Consistent headers**: Standardizes CORS headers across all handlers
- **Security by default**: Restrictive configuration with explicit allowlists

#### Updated Handlers
All Lambda handlers have been updated to use the new CORS utility:
- `health.ts` - Health check endpoint
- `places.ts` - Places search functionality  
- `plan.ts` - Trip planning endpoint
- `rateLimit.ts` - Rate limiting handler

**Before:**
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
}
```

**After:**
```typescript
headers: addCorsHeaders({
  'Content-Type': 'application/json'
}, origin)
```

### 2. Terraform Infrastructure

#### Updated CORS Configuration in API Gateway

**Development Environment (`infra/env/dev.tfvars`):**
```hcl
cors_configuration = {
  allow_credentials = false
  allow_headers     = ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-API-Key"]
  allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_origins     = [
    "http://localhost:3000",      # React dev server
    "http://localhost:5173",      # Vite dev server
    "http://127.0.0.1:3000", 
    "http://127.0.0.1:5173",
    "https://kda4nly79c.execute-api.us-west-1.amazonaws.com" # Current API Gateway
  ]
  max_age          = 86400
}
```

**Production Environment (`infra/env/prod.tfvars`):**
```hcl
cors_configuration = {
  allow_credentials = false
  allow_headers     = ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-API-Key"]
  allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_origins     = [
    "https://daylight.app", 
    "https://www.daylight.app",
    "https://staging.daylight.app"
  ]
  max_age          = 86400
}
```

### 3. Environment-Specific Configuration

The CORS utility automatically configures allowed origins based on the environment:

| Environment | Allowed Origins |
|------------|-----------------|
| `development` | `localhost:3000`, `localhost:5173`, `127.0.0.1:3000`, `127.0.0.1:5173` |
| `staging` | `staging.daylight.app`, CloudFront domains |
| `production` | `daylight.app`, `www.daylight.app`, CloudFront domains |

### 4. Dynamic Origin Support

The implementation supports dynamic configuration through environment variables:
- `ALLOWED_ORIGINS`: Comma-separated list of additional allowed origins
- `CLOUDFRONT_DOMAIN`: CloudFront distribution domain to automatically allow

## Security Improvements

### ✅ **Fixed Security Issues:**

1. **Wildcard Origin Removed**: No more `Access-Control-Allow-Origin: *`
2. **Domain Validation**: All origins are validated against explicit allowlists
3. **Environment Isolation**: Development and production have separate, appropriate configurations
4. **Header Restrictions**: Limited to necessary headers only
5. **Method Restrictions**: Only required HTTP methods are allowed

### 🛡️ **Security Benefits:**

- **Prevents CSRF Attacks**: Restricts cross-origin requests to trusted domains
- **Reduces Attack Surface**: Limits potential for malicious cross-origin requests
- **Environment Separation**: Development tools can't access production APIs
- **Audit Trail**: Clear documentation of allowed origins per environment

## Deployment Instructions

### 1. Deploy Backend Changes

```bash
# Build the backend with new CORS utility
cd backend
npm run build

# Deploy Lambda functions
# (Your deployment process here)
```

### 2. Update Terraform Configuration

```bash
# Apply the updated CORS configuration
cd infra
terraform plan -var-file="env/dev.tfvars"
terraform apply -var-file="env/dev.tfvars"
```

### 3. Environment Variables

Set the following environment variables in your Lambda functions:

```bash
# For development
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# For production  
NODE_ENV=production
CLOUDFRONT_DOMAIN=d1234567890abc.cloudfront.net
ALLOWED_ORIGINS=https://yourdomain.com
```

## Testing

### 1. Verify CORS Headers

```bash
# Test from allowed origin (should work)
curl -H "Origin: https://daylight.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-api-gateway-url/health

# Test from disallowed origin (should be blocked)
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://your-api-gateway-url/health
```

### 2. Browser Testing

1. Open browser developer tools
2. Navigate to your frontend application
3. Make API requests
4. Verify CORS headers in Network tab:
   - `Access-Control-Allow-Origin` should match your domain (not `*`)
   - No CORS errors in console

## Configuration Management

### Adding New Domains

**For Development:**
```hcl
# Add to infra/env/dev.tfvars
allow_origins = [
  "http://localhost:3000",
  "http://localhost:5173", 
  "http://your-new-dev-domain.com"  # Add here
]
```

**For Production:**
```hcl
# Add to infra/env/prod.tfvars  
allow_origins = [
  "https://daylight.app",
  "https://www.daylight.app",
  "https://your-new-domain.com"  # Add here
]
```

### CloudFront Integration

When CloudFront is deployed, add the distribution domain:

```bash
# Set environment variable
CLOUDFRONT_DOMAIN=d1234567890abc.cloudfront.net

# Or add directly to Terraform
allow_origins = [
  "https://daylight.app",
  "https://d1234567890abc.cloudfront.net"
]
```

## Monitoring

### CORS Error Detection

Monitor for CORS-related errors:

```javascript
// Frontend error handling
window.addEventListener('error', (event) => {
  if (event.message.includes('CORS')) {
    console.error('CORS Error:', event);
    // Send to monitoring service
  }
});
```

### API Gateway Metrics

Monitor API Gateway metrics for:
- Increased 4xx errors (potential CORS blocks)
- OPTIONS request patterns
- Origin header analysis in CloudWatch Logs

## Troubleshooting

### Common Issues

1. **CORS Error in Browser**: Check that your frontend domain is in the allowlist
2. **API Gateway 403**: Verify Terraform CORS configuration is applied
3. **Lambda CORS Missing**: Ensure handlers use `addCorsHeaders()` function

### Debug Mode

Enable CORS debugging by setting:
```bash
DEBUG_CORS=true
LOG_LEVEL=debug
```

## Next Steps

This implementation completes **Issue #83**. Consider these follow-up security enhancements:

1. **Issue #82**: Implement JWT Authentication 
2. **Issue #84**: Add comprehensive input validation
3. **Issue #85**: Enhance secrets management

## Security Compliance

✅ **OWASP Compliance**: Addresses Cross-Origin Resource Sharing misconfigurations  
✅ **SOC 2**: Improves access controls and security boundaries  
✅ **Industry Best Practices**: Follows Mozilla and OWASP CORS guidelines

---

**Issue #83 Status**: ✅ **COMPLETE**  
**Security Risk**: 🔴 **HIGH** → 🟢 **MITIGATED**  
**Next Priority**: Issue #82 - JWT Authentication
