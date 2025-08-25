# Auto-Scaling and Resource Limits Implementation

This document describes the comprehensive auto-scaling and resource limits implementation for the Daylight application, addressing Issue #68.

## Overview

The implementation includes five key components:
1. **Lambda Reserved Concurrency** - Limits simultaneous executions to prevent resource exhaustion
2. **DynamoDB Auto-Scaling** - Automatically adjusts capacity based on demand
3. **API Gateway Throttling** - Rate limiting to protect against traffic spikes
4. **CloudFront Caching Policies** - Optimized caching for both static and dynamic content
5. **Resource Utilization Monitoring** - CloudWatch alerts and dashboards for proactive monitoring

## Components

### 1. Lambda Reserved Concurrency

**Configuration:**
- **Development**: 50 concurrent executions
- **Production**: 500 concurrent executions
- **Timeouts**: 30s for trips, 45s for plan handlers
- **Memory**: 512MB for trips, 1024MB for plan

**Benefits:**
- Prevents Lambda functions from consuming all account concurrency
- Ensures predictable performance under load
- Cost control by limiting maximum simultaneous executions

### 2. DynamoDB Auto-Scaling

**Development Environment:**
- Uses PAY_PER_REQUEST billing (cost-effective for low/variable traffic)
- Point-in-time recovery disabled to reduce costs

**Production Environment:**
- Uses PROVISIONED billing with auto-scaling
- Base capacity: 10 RCU/WCU
- Scales up to: 2000 RCU/WCU
- Target utilization: 70%
- Point-in-time recovery enabled

**Benefits:**
- Automatically handles traffic spikes
- Cost-efficient scaling based on actual demand
- Prevents throttling during high-traffic periods

### 3. API Gateway Throttling

**Rate Limits:**
- **Development**: 100 req/sec steady, 200 req/sec burst
- **Production**: 2000 req/sec steady, 5000 req/sec burst

**Features:**
- Per-stage throttling configuration
- Burst protection for sudden traffic spikes
- Automatic 429 responses when limits exceeded

### 4. CloudFront Caching Policies

**Static Assets (SPA):**
- Default TTL: 24 hours (1 hour in dev)
- Max TTL: 1 year (24 hours in dev)
- Cached methods: GET, HEAD, OPTIONS
- Compression enabled

**API Endpoints:**
- Default TTL: 5 minutes (1 minute in dev)
- Max TTL: 1 hour (5 minutes in dev)
- Cache based on query parameters and select headers
- CORS-aware caching

**Security Headers:**
- HSTS with 2-year max age
- Content-Type-Options: nosniff
- Frame-Options: DENY
- CSP with restricted sources

### 5. Resource Utilization Monitoring

**CloudWatch Alarms:**
- Lambda error rates and duration
- DynamoDB throttling
- API Gateway 4XX/5XX errors
- Automatic SNS notifications

**Dashboard Metrics:**
- Lambda performance (duration, errors, invocations)
- DynamoDB capacity consumption
- API Gateway request patterns
- Real-time monitoring and historical trends

## Environment Configuration

### Development (`infra/env/dev.tfvars`)
- Lower resource limits for cost optimization
- Shorter cache TTLs for faster development iteration
- Reduced monitoring retention periods
- PAY_PER_REQUEST DynamoDB billing

### Production (`infra/env/prod.tfvars`)
- Higher resource limits for production traffic
- Longer cache TTLs for better performance
- Extended monitoring retention
- PROVISIONED DynamoDB with auto-scaling
- Stricter security policies

## Deployment

1. **Choose Environment**: Select appropriate `.tfvars` file
2. **Configure Variables**: Adjust limits based on expected traffic
3. **Deploy Infrastructure**: `terraform apply -var-file=env/{environment}.tfvars`
4. **Monitor**: Use CloudWatch dashboard to track performance

## Files Modified

### Infrastructure
- `infra/terraform/main.tf` - Core auto-scaling configuration
- `infra/terraform/variables.tf` - Configurable scaling parameters
- `infra/env/dev.tfvars` - Development environment settings
- `infra/env/prod.tfvars` - Production environment settings

### Application
- `backend/src/lib/cors.ts` - CORS security implementation
- `backend/src/handlers/plan.ts` - Updated with CORS headers

This implementation provides a robust foundation for handling traffic growth while maintaining performance and controlling costs.
