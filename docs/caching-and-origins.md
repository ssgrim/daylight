# Caching and Origins Configuration

This document explains the complete caching and routing configuration for the Daylight application, covering both development and production environments.

## Architecture Overview

```
User → CloudFront → S3 (static assets) + API Gateway (API routes)
     ↓
     Cache behaviors:
     - /assets/* → S3 (1 year cache)
     - /api/*    → API Gateway (no cache)
     - /*        → S3 (5 min cache)
```

## CloudFront Cache Behaviors

### 1. Static Assets (`/assets/*`)
- **Target**: S3 bucket
- **TTL**: 1 year (31,536,000 seconds)
- **Cache-Control**: `public, max-age=31536000, immutable`
- **Compression**: Enabled
- **Purpose**: Long-term caching for hashed filenames (CSS, JS, images)

### 2. API Routes (`/api/*`)
- **Target**: API Gateway
- **TTL**: 0 seconds (no caching)
- **Headers forwarded**: Authorization, Content-Type, Accept
- **Query strings**: Forwarded
- **Purpose**: Dynamic API responses, never cached

### 3. Default (HTML and other files)
- **Target**: S3 bucket
- **TTL**: 5 minutes (300 seconds)
- **Cache-Control**: `public, max-age=300, must-revalidate`
- **Purpose**: Short-term caching for HTML and configuration files

## Special Files

### `env.json`
- **Cache-Control**: `no-cache, no-store, must-revalidate`
- **Purpose**: Runtime configuration that should never be cached
- **Location**: `/env.json`
- **Contains**: API base URL, environment info, build metadata

### `index.html`
- **Cache-Control**: `public, max-age=300, must-revalidate`
- **Purpose**: Main SPA entry point with short cache for updates
- **Error handling**: 404/403 errors redirect to index.html for SPA routing

## Development Setup

### Vite Configuration
```typescript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'YOUR_API_GATEWAY_URL',
        changeOrigin: true,
        secure: true
      }
    }
  }
}
```

### Local Development
- **Frontend**: `npm run dev` (Vite dev server on port 5173)
- **Proxy**: `/api/*` routes proxied to API Gateway
- **Hot reload**: Enabled for fast development

## Production Deployment

### Infrastructure (Terraform)
```bash
cd infra/terraform
terraform init
terraform plan -var-file="../env/dev.tfvars"
terraform apply -var-file="../env/dev.tfvars"
```

### Build and Deploy
```bash
# Complete deployment
./scripts/deploy-complete.sh dev

# Manual steps
npm run build                           # Build frontend
aws s3 sync dist/ s3://bucket-name/     # Upload to S3
./scripts/invalidate-cache.sh DIST_ID   # Invalidate cache
```

### Environment Variables
```bash
# Required for deployment
export DAYLIGHT_DEV_BUCKET="daylight-frontend-dev"
export DAYLIGHT_DEV_DISTRIBUTION_ID="E1234567890ABC"
export DAYLIGHT_DEV_API_BASE="https://abc123.execute-api.us-west-1.amazonaws.com"

export DAYLIGHT_PROD_BUCKET="daylight-frontend-prod"
export DAYLIGHT_PROD_DISTRIBUTION_ID="E0987654321XYZ"
export DAYLIGHT_PROD_API_BASE="https://xyz789.execute-api.us-west-1.amazonaws.com"
```

## Cache Invalidation Strategy

### Automatic Invalidation
- **When**: On every deployment
- **Files**: `/index.html`, `/env.json`, `/*`
- **Cost**: ~$0.005 per invalidation

### Manual Invalidation
```bash
# Invalidate specific files
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/index.html" "/env.json"

# Invalidate everything (expensive!)
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### No Invalidation Needed
- **Static assets** (`/assets/*`): Hashed filenames auto-invalidate
- **API routes** (`/api/*`): Not cached, always fresh

## Performance Optimization

### Frontend Optimizations
- **Asset hashing**: Enables long-term caching
- **Code splitting**: Reduces initial bundle size
- **Compression**: Gzip enabled on CloudFront
- **HTTP/2**: Enabled by default on CloudFront

### Backend Optimizations
- **Multi-layer caching**: LRU (in-memory) + DynamoDB (persistent)
- **Cache headers**: Proper TTL and validation headers
- **Compression**: API Gateway handles response compression

### CDN Optimizations
- **Geographic distribution**: CloudFront edge locations
- **SSL termination**: At CloudFront edge
- **Origin shields**: Reduces origin load (optional)

## Monitoring and Debugging

### CloudFront Metrics
- **Cache hit ratio**: Should be >80% for static assets
- **Origin latency**: Monitor API Gateway response times
- **Error rates**: 4xx/5xx errors by path pattern

### Useful AWS CLI Commands
```bash
# Check distribution status
aws cloudfront get-distribution --id E1234567890ABC

# List invalidations
aws cloudfront list-invalidations --distribution-id E1234567890ABC

# Get cache statistics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=E1234567890ABC
```

### Debug Cache Issues
1. **Check response headers**: Look for `X-Cache` and `Age` headers
2. **Test with curl**: `curl -I https://your-domain.com/path`
3. **CloudFront logs**: Enable access logging for detailed analysis
4. **Browser dev tools**: Network tab shows cache status

## Security Headers

### Applied Headers
- **Strict-Transport-Security**: Force HTTPS for 1 year
- **X-Content-Type-Options**: Prevent MIME sniffing
- **X-Frame-Options**: Prevent clickjacking
- **Referrer-Policy**: Control referrer information
- **X-Version**: Custom header with app version

### Content Security Policy (CSP)
Consider adding CSP headers for additional security:
```typescript
// In your app
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

## Cost Optimization

### CloudFront Pricing
- **Data transfer**: $0.085/GB for first 10TB (US/Europe)
- **Requests**: $0.0075/10,000 HTTP requests
- **Invalidations**: $0.005 per path in invalidation request

### S3 Pricing
- **Storage**: $0.023/GB/month (Standard)
- **Requests**: $0.0004/1,000 PUT requests, $0.0004/10,000 GET requests

### Optimization Tips
1. **Use PriceClass_100**: Limits to US, Canada, Europe only
2. **Minimize invalidations**: Use hashed filenames when possible
3. **Optimize images**: Use WebP format, proper compression
4. **Enable compression**: Reduces data transfer costs

## Troubleshooting

### Common Issues
1. **504 Gateway Timeout**: Check API Gateway timeout settings
2. **403 Forbidden**: Verify S3 bucket policy and OAC configuration
3. **Cache not working**: Check cache-control headers and behaviors
4. **CORS errors**: Ensure API Gateway has proper CORS configuration

### Health Checks
```bash
# Test frontend
curl -I https://your-domain.com/

# Test API through CloudFront
curl -I https://your-domain.com/api/health

# Test direct API Gateway
curl -I https://api-id.execute-api.region.amazonaws.com/api/health
```

### Emergency Procedures
1. **Immediate cache clear**: Use invalidation with `/*` path
2. **Rollback deployment**: Redeploy previous version to S3
3. **Disable CloudFront**: Update DNS to point directly to S3 (if configured)
4. **API issues**: Check Lambda logs in CloudWatch
