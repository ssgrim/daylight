# Health Checks and Monitoring Implementation

## Overview

This implementation provides comprehensive health checks and monitoring for the Daylight application, including:

- **Health Check Endpoint** (`/health`) with multiple check levels
- **CloudWatch Monitoring** with custom dashboards and alarms
- **Automated Alerting** via SNS notifications
- **Synthetic Monitoring** with scheduled health checks
- **Prometheus Metrics** support for external monitoring

## Health Check Endpoint

### Basic Usage

```bash
# Basic health check (application and Lambda function only)
curl https://your-api-endpoint/health

# Full health check (includes external dependencies)
curl https://your-api-endpoint/health?level=full

# Prometheus metrics format
curl https://your-api-endpoint/health?format=prometheus
```

### Health Check Components

- **Application Health**: Core module loading validation
- **Lambda Function Health**: Memory utilization monitoring, runtime environment validation
- **DynamoDB Health**: Table connectivity and status, response time monitoring
- **External Service Health**: Weather and geocoding API connectivity with response time tracking

## CloudWatch Monitoring

### Alarms Configured

1. **Health Function Errors**: Triggers on any health check failures
2. **Health Function Duration**: Alerts if health checks take > 15 seconds
3. **Plan Function Errors**: Monitors main application errors
4. **API Gateway 4XX/5XX Errors**: Client and server error monitoring
5. **DynamoDB Performance**: Throttling and latency monitoring

### Synthetic Monitoring

- **Scheduled Health Checks**: Every 5 minutes via EventBridge
- **Full Health Validation**: Includes all external dependencies
- **Automatic Alerting**: On health check failures

## Deployment Instructions

1. **Build**: `npm run build` in backend directory
2. **Deploy**: `terraform apply` in infra/terraform directory
3. **Verify**: Test health endpoint and check CloudWatch dashboard

## Production Recommendations

- Use `/health` endpoint for load balancer health checks
- Configure alert email in terraform variables
- Tune alert thresholds based on traffic patterns
- Monitor dashboard for performance insights
