# Development Environment Configuration
# Auto-Scaling and Resource Limits for Daylight Application

region = "us-west-1"
stage  = "dev"

# Lambda Configuration
lambda_reserved_concurrency = 50  # Lower for dev environment

# DynamoDB Configuration - Use PAY_PER_REQUEST for dev (cost-effective)
dynamodb_billing_mode           = "PAY_PER_REQUEST"
dynamodb_point_in_time_recovery = false  # Disable for dev to save costs
enable_dynamodb_autoscaling     = false  # Not applicable for PAY_PER_REQUEST

# API Gateway Throttling - Lower limits for dev
api_gateway_throttle_rate_limit  = 100   # 100 requests/second
api_gateway_throttle_burst_limit = 200   # 200 burst requests

# CloudFront Configuration
cloudfront_price_class    = "PriceClass_100"
cloudfront_default_ttl    = 3600    # 1 hour for dev (shorter for testing)
cloudfront_max_ttl        = 86400   # 24 hours max
api_cache_default_ttl     = 60      # 1 minute (very short for dev)
api_cache_max_ttl         = 300     # 5 minutes max

# Monitoring Configuration
enable_monitoring_alerts    = true
enable_monitoring_dashboard = true
cloudwatch_log_retention_days = 7  # Shorter retention for dev

# Alert Thresholds - More lenient for dev
lambda_error_rate_threshold      = 10
lambda_duration_threshold_trips  = 25000  # 25 seconds
lambda_duration_threshold_plan   = 35000  # 35 seconds
dynamodb_throttle_threshold      = 5
api_gateway_error_threshold      = 20

# Provider Configuration (optional - can be set via environment variables)
geocode_provider = "nominatim"
weather_provider = "open-meteo"
season_mode      = "meteorological"

# CORS Configuration
cors_configuration = {
  allow_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ]
}
