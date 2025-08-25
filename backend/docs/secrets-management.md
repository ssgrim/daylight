# Enhanced Secrets Management and Rotation

This document describes the comprehensive secrets management system implemented for the Daylight application, including automatic rotation, enhanced security, and monitoring capabilities.

## Overview

The enhanced secrets management system provides:

- **Automatic Secret Rotation**: Configurable rotation schedules with Lambda-based rotation functions
- **Enhanced Security**: KMS encryption, cross-region replication, and secure access patterns
- **Centralized Management**: Unified interface for both AWS Secrets Manager and SSM Parameter Store
- **Health Monitoring**: Integration with application health checks and CloudWatch alerts
- **Backward Compatibility**: Seamless migration from existing secrets implementation

## Architecture

### Components

1. **Enhanced Secrets Library** (`secrets-enhanced.ts`)
   - Advanced caching with TTL and validation
   - Retry logic with exponential backoff
   - Metadata tracking and health validation
   - Support for multiple secret types (API keys, tokens, passwords)

2. **Secret Rotation Lambda** (`secret-rotation.ts`)
   - Implements AWS Secrets Manager rotation lifecycle
   - Support for API key, token, and password rotation
   - Connectivity testing for external services
   - Configurable rotation intervals

3. **Infrastructure** (`modules/secrets/main.tf`)
   - KMS key for encryption with automatic rotation
   - Secrets Manager secrets with cross-region replication
   - IAM roles with least-privilege access
   - CloudWatch monitoring and alerting

4. **Health Monitoring** (`secrets-health.ts`)
   - Integration with main health check endpoint
   - Secrets accessibility validation
   - Cache performance monitoring
   - Rotation status tracking

## Configuration

### Environment Variables

```bash
# Core Configuration
SECRETS_KMS_KEY_ID=arn:aws:kms:region:account:key/key-id
NODE_ENV=development|production
AWS_REGION=us-west-1

# Secret Rotation
ENABLE_SECRET_ROTATION=true|false
ROTATION_INTERVAL_DAYS=30

# Backup Configuration
BACKUP_REGION=us-east-1
```

### Terraform Variables

```hcl
# Enable automatic rotation
enable_secret_rotation = true

# Backup region for secret replication
backup_region = "us-east-1"

# API Keys (stored securely in Secrets Manager)
mapbox_api_key = "pk.ey..."
google_maps_api_key = "AIza..."
events_api_token = "token..."
traffic_api_token = "token..."

# Database credentials
database_username = "daylight-app"
database_password = "secure-password"
```

## Usage

### Basic Secret Retrieval

```javascript
import { getSecretValue } from '../lib/secrets.mjs'

// Get secret from Secrets Manager
const apiKey = await getSecretValue('daylight/mapbox-api-key-dev')

// Get parameter from SSM
const config = await getSecretValue('/daylight/dev/config', { fromSSM: true })
```

### Enhanced Secret Management

```typescript
import { SecretsManager } from '../lib/secrets-enhanced.js'

const secretsManager = new SecretsManager()

// Create secret with rotation
const secretArn = await secretsManager.createOrUpdateSecret(
  'my-api-key',
  'secret-value',
  {
    description: 'API key for external service',
    enableRotation: true,
    rotationInterval: 30,
    tags: { Service: 'api-integration' }
  }
)

// Validate secret health
const health = await secretsManager.validateSecretHealth(secretArn)
console.log(health.isHealthy)

// List all secrets
const secrets = await secretsManager.listSecrets()
```

### Batch Operations

```javascript
import { getMultipleSecrets } from '../lib/secrets-enhanced.js'

const secrets = await getMultipleSecrets([
  { key: 'mapbox', secretArnOrName: 'daylight/mapbox-api-key-dev' },
  { key: 'google', secretArnOrName: 'daylight/google-maps-api-key-dev' },
  { key: 'config', secretArnOrName: '/daylight/dev/config', options: { fromSSM: true } }
])

// Access as: secrets.mapbox, secrets.google, secrets.config
```

## Secret Rotation

### Rotation Process

The automatic rotation follows AWS Secrets Manager's four-step process:

1. **createSecret**: Generate new secret value
2. **setSecret**: Configure service with new secret
3. **testSecret**: Validate new secret functionality
4. **finishSecret**: Promote new secret to current

### Supported Secret Types

#### API Keys
- Mapbox API keys with geocoding validation
- Google Maps API keys with service testing
- Generic API keys with format validation

#### Tokens
- JWT tokens with expiration handling
- OAuth tokens with refresh capability
- Service-specific tokens

#### Passwords
- Database passwords with character requirements
- Service account passwords
- Application passwords

### Rotation Configuration

```terraform
# Enable rotation for a secret
resource "aws_secretsmanager_secret_rotation" "api_key_rotation" {
  secret_id           = aws_secretsmanager_secret.api_key.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation.arn

  rotation_rules {
    automatically_after_days = 30
  }
}
```

## Security Features

### Encryption
- All secrets encrypted with customer-managed KMS key
- Automatic key rotation enabled
- Cross-region backup with same encryption

### Access Control
- IAM roles with least-privilege access
- Resource-based policies for secret access
- VPC endpoint support for private access

### Audit and Monitoring
- CloudWatch logs for all secret operations
- CloudTrail integration for access auditing
- Custom metrics for rotation success/failure

## Health Monitoring

The secrets management system integrates with the application health check endpoint:

```bash
# Full health check including secrets
GET /health?level=full

# Response includes secrets status
{
  "status": "healthy",
  "checks": [
    {
      "name": "secrets_management",
      "status": "healthy",
      "message": "Secrets management system is healthy",
      "responseTime": 150
    }
  ]
}
```

### Health Check Components

1. **Secret Accessibility**: Test access to critical secrets
2. **KMS Key Status**: Verify encryption key availability
3. **Cache Performance**: Monitor cache hit rates and errors
4. **Rotation Status**: Check for overdue rotations

## Alerting

CloudWatch alarms monitor:

- Secret rotation failures
- Lambda function errors and duration
- KMS key accessibility issues
- High cache error rates

```terraform
resource "aws_cloudwatch_metric_alarm" "secret_rotation_errors" {
  alarm_name          = "daylight-secret-rotation-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

## Migration Guide

### From Basic to Enhanced Secrets

1. **Update Dependencies**:
   ```bash
   npm install @aws-sdk/client-kms
   ```

2. **Deploy Infrastructure**:
   ```bash
   terraform apply -var="enable_secret_rotation=true"
   ```

3. **Update Code** (backward compatible):
   ```javascript
   // Existing code continues to work
   const secret = await getSecretValue('arn:aws:secretsmanager:...')
   
   // Enhanced features available
   const manager = new SecretsManager()
   const health = await manager.validateSecretHealth('secret-arn')
   ```

4. **Enable Monitoring**:
   ```javascript
   // Add to health checks
   const health = await checkSecretsHealth()
   ```

## Best Practices

### Secret Naming
- Use consistent naming: `daylight/{service}-{type}-{environment}`
- Example: `daylight/mapbox-api-key-prod`

### Rotation Strategy
- Enable rotation for external API keys (30-90 days)
- Database passwords (60-90 days)
- Internal tokens (90-180 days)

### Error Handling
- Implement circuit breaker patterns for secret failures
- Use cached values during service outages
- Log rotation failures for investigation

### Security
- Never log secret values
- Use encrypted environment variables for references
- Implement secret scanning in CI/CD

## Troubleshooting

### Common Issues

1. **Secret Not Found**
   - Verify secret name and region
   - Check IAM permissions
   - Confirm KMS key access

2. **Rotation Failures**
   - Check Lambda logs: `/aws/lambda/daylight-secret-rotation`
   - Verify external service connectivity
   - Review IAM permissions for rotation role

3. **Cache Issues**
   - Monitor cache statistics via health endpoint
   - Clear cache for specific secrets if needed
   - Adjust TTL based on usage patterns

### Debugging Commands

```bash
# Check secret status
aws secretsmanager describe-secret --secret-id daylight/api-key-dev

# Test Lambda rotation function
aws lambda invoke --function-name daylight-secret-rotation \
  --payload '{"Step":"testSecret","SecretId":"arn:...","Token":"EXAMPLE"}'

# View rotation logs
aws logs tail /aws/lambda/daylight-secret-rotation --follow
```

## Monitoring Dashboard

Create CloudWatch dashboard with:

- Secret rotation success rate
- Lambda function duration and errors
- Cache hit rate and error rate
- KMS key usage and throttling

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Errors", "FunctionName", "daylight-secret-rotation"],
          ["AWS/Lambda", "Duration", "FunctionName", "daylight-secret-rotation"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-west-1",
        "title": "Secret Rotation Metrics"
      }
    }
  ]
}
```

## Performance Considerations

- **Caching**: 15-minute TTL with background validation
- **Retry Logic**: Exponential backoff with 3 attempts
- **Batch Operations**: Parallel secret retrieval
- **Health Checks**: 30-second cache for health results

The enhanced secrets management system provides enterprise-grade security and reliability while maintaining ease of use and backward compatibility.
