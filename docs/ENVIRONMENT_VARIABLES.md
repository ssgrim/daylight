# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in the Daylight application.

## Overview

Daylight uses environment variables for configuration across different environments (development, staging, production) and components (frontend, backend, infrastructure).

## Variable Categories

### 🎯 Frontend Variables (React/Vite)

These variables are used by the React frontend application and are prefixed with `VITE_` to be accessible in the browser.

| Variable | Environment | Required | Default | Description | Example |
|----------|-------------|----------|---------|-------------|---------|
| `VITE_API_BASE` | All | ✅ | None | Base URL for API calls | `https://api.example.com` |
| `VITE_MAPBOX_TOKEN` | All | ❌ | None | Mapbox GL JS access token | `pk.eyJ1...` |
| `VITE_SENTRY_DSN` | All | ❌ | None | Sentry error tracking DSN | `https://...@sentry.io/...` |
| `VITE_ENVIRONMENT` | All | ❌ | `development` | Current environment name | `production` |
| `VITE_ENABLE_DEBUG` | Dev | ❌ | `false` | Enable debug logging | `true` |
| `VITE_ENABLE_MOCK_DATA` | Dev | ❌ | `false` | Use mock data instead of API | `true` |
| `VITE_APP_NAME` | All | ❌ | `Daylight` | Application display name | `Daylight` |
| `VITE_APP_VERSION` | All | ❌ | `0.2.0` | Application version | `1.0.0` |

#### Frontend Configuration Files

**Development**: `frontend/.env.local`
```bash
VITE_API_BASE=http://localhost:3000/api
VITE_MAPBOX_TOKEN=pk.your_development_token
VITE_ENABLE_DEBUG=true
VITE_ENVIRONMENT=development
```

**Production**: `frontend/.env.production`
```bash
VITE_API_BASE=https://api.yourdomain.com
VITE_MAPBOX_TOKEN=pk.your_production_token
VITE_ENABLE_DEBUG=false
VITE_ENVIRONMENT=production
VITE_SENTRY_DSN=https://your_sentry_dsn@sentry.io/project
```

### ⚡ Backend Variables (Lambda Functions)

These variables are set in the Lambda function environment and injected by Terraform.

| Variable | Function | Required | Default | Description | Source |
|----------|----------|----------|---------|-------------|--------|
| `TABLE_TRIPS` | All | ✅ | None | DynamoDB trips table name | Terraform |
| `TABLE_CACHE` | Plan | ❌ | None | DynamoDB cache table name | Terraform |
| `GOOGLE_PLACES_API_KEY` | Plan | ✅ | None | Google Places API key | Secrets Manager |
| `PLACES_PROVIDER` | Plan | ❌ | `google-places` | Default place search provider | Terraform |
| `ENABLE_PROVIDER_FAILOVER` | Plan | ❌ | `false` | Enable automatic provider failover | Terraform |
| `PROVIDER_TIMEOUT` | Plan | ❌ | `8000` | Provider request timeout (ms) | Terraform |
| `NODE_ENV` | All | ✅ | `development` | Node.js environment | Terraform |
| `LOG_LEVEL` | All | ❌ | `info` | Logging verbosity level | Terraform |
| `CACHE_TTL` | Plan | ❌ | `3600` | Cache TTL in seconds | Terraform |
| `AWS_REGION` | All | ✅ | None | AWS region | AWS Runtime |
| `AWS_LAMBDA_FUNCTION_NAME` | All | ✅ | None | Function name | AWS Runtime |

#### Backend Environment Examples

**Development**:
```bash
TABLE_TRIPS=daylight-dev-trips
TABLE_CACHE=daylight-dev-cache
NODE_ENV=development
LOG_LEVEL=debug
CACHE_TTL=300
PLACES_PROVIDER=google-places
ENABLE_PROVIDER_FAILOVER=false
PROVIDER_TIMEOUT=5000
```

**Production**:
```bash
TABLE_TRIPS=daylight-prod-trips
TABLE_CACHE=daylight-prod-cache
NODE_ENV=production
LOG_LEVEL=info
CACHE_TTL=3600
PLACES_PROVIDER=google-places
ENABLE_PROVIDER_FAILOVER=true
PROVIDER_TIMEOUT=8000
```

### 🔌 Provider Configuration Variables

These variables control the pluggable provider system for place search functionality.

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `PLACES_PROVIDER` | ❌ | `google-places` | Default provider to use | `google-places`, `mock` |
| `ENABLE_PROVIDER_FAILOVER` | ❌ | `false` | Enable automatic failover | `true` |
| `PROVIDER_TIMEOUT` | ❌ | `8000` | Request timeout in milliseconds | `8000` |
| `GOOGLE_PLACES_API_KEY` | ❌* | None | Google Places API key | `AIza...` |
| `GOOGLE_PLACES_TIMEOUT` | ❌ | `8000` | Google Places timeout override | `10000` |
| `MOCK_PROVIDER_FAIL_RATE` | ❌ | `0` | Mock provider failure rate (0-1) | `0.1` |
| `MOCK_PROVIDER_DELAY` | ❌ | `100` | Mock provider response delay (ms) | `500` |

**Required if provider is used*

#### Provider Configuration Examples

**Google Places Only (Production)**:
```bash
PLACES_PROVIDER=google-places
GOOGLE_PLACES_API_KEY=AIzaSyC...
ENABLE_PROVIDER_FAILOVER=false
PROVIDER_TIMEOUT=8000
```

**Multi-Provider with Failover (Development)**:
```bash
PLACES_PROVIDER=google-places
ENABLE_PROVIDER_FAILOVER=true
GOOGLE_PLACES_API_KEY=AIzaSyC...
PROVIDER_TIMEOUT=5000
```

**Mock Provider (Testing)**:
```bash
PLACES_PROVIDER=mock
MOCK_PROVIDER_FAIL_RATE=0.1
MOCK_PROVIDER_DELAY=200
ENABLE_PROVIDER_FAILOVER=false
```

### 🏗️ Infrastructure Variables (Terraform)

These variables configure the AWS infrastructure deployment.

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `project_name` | ✅ | `daylight` | Project name for resource naming | `daylight` |
| `environment` | ✅ | `dev` | Environment name | `dev`, `staging`, `prod` |
| `aws_region` | ✅ | `us-west-1` | AWS deployment region | `us-west-1` |
| `owner` | ❌ | `daylight-team` | Team/owner for resource tagging | `your-team` |
| `google_places_api_key` | ✅ | None | Google Places API key | `AIza...` |
| `mapbox_access_token` | ❌ | None | Mapbox access token | `pk.eyJ...` |
| `alarm_email` | ❌ | None | Email for CloudWatch alarms | `alerts@example.com` |
| `log_retention_days` | ❌ | `14` | CloudWatch log retention | `30` |

#### Terraform Configuration Files

**Development**: `infra/env/dev.tfvars`
```hcl
project_name = "daylight"
environment  = "dev"
aws_region   = "us-west-1"
google_places_api_key = "your_dev_api_key"
log_retention_days = 7
```

**Production**: `infra/env/prod.tfvars`
```hcl
project_name = "daylight"
environment  = "prod"
aws_region   = "us-west-1"
google_places_api_key = "your_prod_api_key"
mapbox_access_token = "pk.your_prod_token"
alarm_email = "alerts@yourdomain.com"
log_retention_days = 30
```

## Environment-Specific Configurations

### Development Environment

**Characteristics**:
- Lower resource limits
- Verbose logging
- Shorter cache TTLs
- Permissive CORS
- Cost optimization

**Key Settings**:
```bash
# Frontend
VITE_ENABLE_DEBUG=true
VITE_ENABLE_MOCK_DATA=true

# Backend
LOG_LEVEL=debug
CACHE_TTL=300

# Infrastructure
log_retention_days = 7
throttling_rate_limit = 500
```

### Staging Environment

**Characteristics**:
- Production-like configuration
- Moderate resource limits
- Testing optimizations
- Restricted access

**Key Settings**:
```bash
# Frontend
VITE_ENABLE_DEBUG=false
VITE_ENVIRONMENT=staging

# Backend
LOG_LEVEL=info
CACHE_TTL=1800

# Infrastructure
log_retention_days = 14
throttling_rate_limit = 1500
```

### Production Environment

**Characteristics**:
- High performance
- Security hardened
- Monitoring enabled
- Full redundancy

**Key Settings**:
```bash
# Frontend
VITE_ENABLE_DEBUG=false
VITE_SENTRY_DSN=https://your_prod_dsn

# Backend
LOG_LEVEL=warn
CACHE_TTL=3600

# Infrastructure
log_retention_days = 30
enable_cloudwatch_alarms = true
enable_waf = true
```

## Security Considerations

### Sensitive Variables

These variables contain secrets and should be handled carefully:

| Variable | Storage Method | Rotation |
|----------|----------------|----------|
| `GOOGLE_PLACES_API_KEY` | AWS Secrets Manager | Manual |
| `VITE_MAPBOX_TOKEN` | Environment file | Manual |
| `VITE_SENTRY_DSN` | Environment file | On compromise |

### Best Practices

1. **Never commit secrets** to version control
2. **Use environment templates** for easy setup
3. **Rotate keys regularly** in production
4. **Use Secrets Manager** for Lambda secrets
5. **Restrict CORS origins** in production
6. **Enable monitoring** for all environments

## Variable Sources

### Frontend Variables (Build Time)

Frontend variables are embedded at build time by Vite:

```bash
# Variables are read from (in order):
1. .env.production.local  # Production + local overrides
2. .env.local            # Local overrides (all environments)
3. .env.production       # Production environment
4. .env                  # Default values
```

### Backend Variables (Runtime)

Backend variables are set at runtime by AWS Lambda:

```bash
# Variables come from:
1. Terraform configuration  # Infrastructure-managed
2. Secrets Manager          # Secret values
3. AWS Lambda environment   # Runtime metadata
```

### Infrastructure Variables (Deploy Time)

Infrastructure variables are used during Terraform deployment:

```bash
# Variables are read from:
1. terraform.tfvars       # Environment-specific values
2. variables.tf           # Default values
3. Command line flags     # Override values
```

## Troubleshooting

### Common Issues

#### Frontend Build Errors

**Problem**: `VITE_API_BASE is not defined`

**Solution**:
```bash
# Check environment file exists
ls -la frontend/.env.local

# Verify variable is set
grep VITE_API_BASE frontend/.env.local

# Restart dev server
npm run dev
```

#### Backend Function Errors

**Problem**: `TABLE_TRIPS is not defined`

**Solution**:
```bash
# Check Terraform outputs
terraform output

# Verify Lambda environment
aws lambda get-function-configuration \
  --function-name daylight-dev-trips \
  --query 'Environment.Variables'
```

#### Secrets Access Errors

**Problem**: `Unable to retrieve secret`

**Solution**:
```bash
# Check secret exists
aws secretsmanager describe-secret \
  --secret-id daylight-dev-api-keys

# Verify IAM permissions
aws iam get-role-policy \
  --role-name daylight-dev-lambda-role \
  --policy-name SecretsManagerAccess
```

### Variable Validation

Use these commands to verify your configuration:

```bash
# Frontend variables
npm run build  # Will fail if required variables missing

# Backend variables
terraform plan  # Will show variable values

# Infrastructure variables
terraform validate  # Will check syntax and requirements
```

## Environment Setup Checklist

### Development Setup

- [ ] Copy `env.dev.json.template` to `env.dev.json`
- [ ] Copy `frontend/env.dev.template` to `frontend/.env.local`
- [ ] Copy `infra/env/dev.tfvars.template` to `infra/env/dev.tfvars`
- [ ] Set `GOOGLE_PLACES_API_KEY` in tfvars
- [ ] Set `VITE_MAPBOX_TOKEN` in .env.local (optional)
- [ ] Configure AWS credentials
- [ ] Deploy infrastructure: `terraform apply`
- [ ] Update `VITE_API_BASE` with API Gateway URL

### Production Setup

- [ ] Copy `env.prod.json.template` to `env.prod.json`
- [ ] Copy `frontend/env.prod.template` to `frontend/.env.production`
- [ ] Copy `infra/env/prod.tfvars.template` to `infra/env/prod.tfvars`
- [ ] Set production API keys and secrets
- [ ] Configure production AWS credentials
- [ ] Set up CloudWatch alarm email
- [ ] Deploy infrastructure with production settings
- [ ] Configure domain and SSL (if custom domain)
- [ ] Test all functionality in production

---

For more information, see:
- [Onboarding Guide](./ONBOARDING.md)
- [Quick Start](./QUICK_START.md)
- [Deployment Guide](./DEPLOYMENT.md)
