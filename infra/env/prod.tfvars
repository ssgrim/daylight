# Production Environment Configuration
# Auto-Scaling and Resource Limits for Daylight Application

region = "us-west-1"
stage  = "prod"

# Lambda Configuration
lambda_reserved_concurrency = 500  # Higher for production

# DynamoDB Configuration - Use PROVISIONED with auto-scaling for production
dynamodb_billing_mode                    = "PROVISIONED"
dynamodb_read_capacity                   = 10
dynamodb_write_capacity                  = 10
enable_dynamodb_autoscaling              = true
dynamodb_autoscaling_max_read_capacity   = 2000
dynamodb_autoscaling_max_write_capacity  = 2000
dynamodb_autoscaling_target_value        = 70
dynamodb_point_in_time_recovery          = true

# API Gateway Throttling - Production limits
api_gateway_throttle_rate_limit  = 2000   # 2000 requests/second
api_gateway_throttle_burst_limit = 5000   # 5000 burst requests

# CloudFront Configuration
cloudfront_price_class    = "PriceClass_200"  # Better performance for prod
cloudfront_default_ttl    = 86400    # 24 hours
cloudfront_max_ttl        = 31536000 # 1 year
api_cache_default_ttl     = 300      # 5 minutes
api_cache_max_ttl         = 3600     # 1 hour

# Monitoring Configuration
enable_monitoring_alerts    = true
enable_monitoring_dashboard = true
cloudwatch_log_retention_days = 30  # Longer retention for production

# Alert Thresholds - Strict for production
lambda_error_rate_threshold      = 3
lambda_duration_threshold_trips  = 20000  # 20 seconds
lambda_duration_threshold_plan   = 30000  # 30 seconds
dynamodb_throttle_threshold      = 0      # Zero tolerance for throttling
api_gateway_error_threshold      = 5

# Provider Configuration
geocode_provider = "mapbox"      # Use premium providers in prod
weather_provider = "openweathermap"
season_mode      = "meteorological"

# CORS Configuration
cors_configuration = {
  allow_origins = [
    "https://daylight.app",
    "https://www.daylight.app"
  ]
}
