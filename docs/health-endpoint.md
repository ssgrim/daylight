# Health Endpoint Implementation

This document describes the implementation of the `/api/health` endpoint for monitoring and liveness checks.

## Overview

The health endpoint provides a simple liveness check for the Daylight API, meeting the following requirements:
- Returns `{ok: true, ts: <timestamp>}` on GET `/api/health`
- Exempt from Places API calls and external dependencies
- Monitored with CloudWatch alarms for 5xx error spikes

## Implementation

### Health Handler

**File**: `backend/src/handlers/health.ts`

```typescript
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

/**
 * Health check endpoint for monitoring and load balancer health checks.
 * This endpoint is intentionally exempt from Places API calls and external dependencies
 * to provide a reliable liveness check.
 */
export const handler: APIGatewayProxyHandlerV2 = async () => {
  const timestamp = new Date().toISOString()
  
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({
      ok: true,
      ts: timestamp
    })
  }
}
```

### Response Format

**Successful Response (200)**:
```json
{
  "ok": true,
  "ts": "2025-08-24T19:56:23.456Z"
}
```

**Headers**:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,OPTIONS`
- `Cache-Control: no-cache, no-store, must-revalidate`

## Infrastructure Configuration

### Lambda Function

The health handler is deployed as a separate Lambda function with optimized settings:

```hcl
health = {
  handler     = "health.handler"
  zip_file    = "../../backend/dist/health.zip"
  timeout     = 10      # Short timeout for quick response
  memory_size = 128     # Minimal memory for simple operation
}
```

### API Gateway Route

```hcl
health_check = {
  method        = "GET"
  path         = "/health"
  function_name = "health"
}
```

### CloudWatch Alarms

Multiple alarms monitor the health endpoint and overall API health:

#### API Gateway 5xx Errors
- **Metric**: `5XXError` from AWS/ApiGatewayV2
- **Threshold**: 10 errors within 5 minutes (2 evaluation periods)
- **Purpose**: Detect API Gateway level issues

#### Lambda Function Errors
- **Metric**: `Errors` from AWS/Lambda
- **Threshold**: 5 errors within 5 minutes (2 evaluation periods)
- **Purpose**: Detect function-level issues for each Lambda

#### Lambda Function Duration
- **Metric**: `Duration` from AWS/Lambda
- **Threshold**: 80% of function timeout
- **Purpose**: Detect performance degradation

## Environment-Specific Configuration

### Development
- Error threshold: 10 (higher tolerance for testing)
- Alarms enabled for testing
- SNS notifications to development team

### Production
- Error threshold: 5 (strict monitoring)
- Alarms enabled with immediate alerts
- SNS notifications to operations team

## Usage Examples

### Basic Health Check
```bash
curl https://api.daylight.app/health
```

### Response Validation
```bash
curl -s https://api.daylight.app/health | jq '.ok'
# Should return: true
```

### Load Balancer Health Check
Most load balancers can use this endpoint with:
- **Path**: `/health`
- **Expected Status**: 200
- **Expected Body Contains**: `"ok":true`

## Monitoring and Alerting

### CloudWatch Metrics

The health endpoint generates standard Lambda and API Gateway metrics:

- **AWS/Lambda**:
  - `Duration`: Response time
  - `Errors`: Function failures
  - `Invocations`: Total requests
  - `Throttles`: Rate limiting events

- **AWS/ApiGatewayV2**:
  - `Count`: Total requests
  - `IntegrationLatency`: Backend processing time
  - `Latency`: Total response time
  - `4XXError`: Client errors
  - `5XXError`: Server errors

### Alarm Actions

When alarms trigger, they can:
1. Send SNS notifications to email/SMS
2. Trigger auto-scaling actions
3. Create support tickets
4. Execute custom Lambda functions for remediation

### Dashboard Integration

The health endpoint metrics can be integrated into CloudWatch dashboards:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGatewayV2", "5XXError", "ApiId", "YOUR_API_ID"],
          ["AWS/Lambda", "Errors", "FunctionName", "daylight-health-dev"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-west-1",
        "title": "Health Endpoint Errors"
      }
    }
  ]
}
```

## Testing

### Manual Testing
```bash
# Test basic functionality
curl -i https://api.daylight.app/health

# Verify response format
curl -s https://api.daylight.app/health | python -m json.tool

# Test CORS headers
curl -H "Origin: https://myapp.com" https://api.daylight.app/health
```

### Automated Testing
```bash
#!/bin/bash
# Health check script for monitoring

ENDPOINT="https://api.daylight.app/health"
RESPONSE=$(curl -s -w "%{http_code}" "$ENDPOINT")
HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" -eq 200 ]; then
  if echo "$BODY" | grep -q '"ok":true'; then
    echo "Health check passed"
    exit 0
  else
    echo "Health check failed: invalid response body"
    exit 1
  fi
else
  echo "Health check failed: HTTP $HTTP_CODE"
  exit 1
fi
```

## Security Considerations

1. **No Authentication Required**: The health endpoint is publicly accessible for monitoring purposes
2. **No Sensitive Data**: Only returns status and timestamp
3. **Rate Limiting**: Subject to API Gateway throttling limits
4. **CORS Enabled**: Allows cross-origin requests for dashboard integration

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**: Lambda function is failing to start
   - Check Lambda logs in CloudWatch
   - Verify deployment package is valid

2. **503 Service Unavailable**: Lambda is being throttled
   - Check concurrent execution limits
   - Review throttling metrics

3. **504 Gateway Timeout**: Lambda is taking too long
   - Should not happen with 10s timeout for simple health check
   - Check for unexpected delays in function

### Debugging Commands

```bash
# Check Lambda logs
aws logs tail /aws/lambda/daylight-health-dev --follow

# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGatewayV2 \
  --metric-name 5XXError \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --start-time 2025-08-24T19:00:00Z \
  --end-time 2025-08-24T20:00:00Z \
  --period 300 \
  --statistics Sum

# Test from within AWS
aws lambda invoke \
  --function-name daylight-health-dev \
  --payload '{"requestContext":{"http":{"method":"GET"}}}' \
  /tmp/response.json
```

## Future Enhancements

1. **Enhanced Health Checks**: Add database connectivity tests
2. **Version Information**: Include API version in response
3. **Dependency Checks**: Optionally test external service availability
4. **Metrics Endpoint**: Separate endpoint for detailed metrics
5. **Regional Health**: Multi-region health status aggregation

## Related Documentation

- [Infrastructure Plan/Apply Guide](terraform-plan-apply.md)
- [Infrastructure Migration Guide](infrastructure-migration.md)
- [API Gateway Configuration](../infra/modules/lambda-api/README.md)
- [CloudWatch Monitoring Setup](cloudwatch-monitoring.md)
