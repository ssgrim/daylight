variable "region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-west-1"  # N. California
}

variable "mapbox_token" {
  description = "(optional) Mapbox API token for reverse geocoding"
  type        = string
  default     = ""
}

variable "geocode_provider" {
  description = "Geocode provider to use (nominatim|mapbox)"
  type        = string
  default     = "nominatim"
}

variable "weather_provider" {
  description = "Weather provider to use (open-meteo|openweathermap)"
  type        = string
  default     = "open-meteo"
}

variable "google_maps_key" {
  description = "(optional) Google Maps API key for Maps/Places usage. Set via secure CI secrets; do not commit keys here."
  type        = string
  default     = ""
}

variable "season_mode" {
  description = "Season mode for the service: 'meteorological' or 'astronomical'"
  type        = string
  default     = "meteorological"
}

variable "mapbox_secret_arn" {
  description = "(optional) ARN of a Secrets Manager secret containing the Mapbox token. If provided, Lambda will be granted permission to read it at runtime."
  type        = string
  default     = ""
}

variable "google_maps_secret_arn" {
  description = "(optional) ARN of a Secrets Manager secret containing the Google Maps API key. If provided, Lambda will be granted permission to read it at runtime."
  type        = string
  default     = ""
}

variable "events_secret_arn" {
  description = "(optional) ARN for events provider API key (e.g., Ticketmaster)."
  type = string
  default = ""
}

variable "traffic_secret_arn" {
  description = "(optional) ARN for traffic provider API key (e.g., HERE)."
  type = string
  default = ""
}

variable "mapbox_token_value" {
  description = "(optional) plaintext Mapbox token to create as a secret via Terraform (not recommended for production)."
  type = string
  default = ""
}

variable "events_api_key_value" {
  description = "(optional) plaintext events API key to create as a secret via Terraform (not recommended)."
  type = string
  default = ""
}

variable "traffic_api_key_value" {
  description = "(optional) plaintext traffic API key to create as a secret via Terraform (not recommended)."
  type = string
  default = ""
}

variable "events_ssm_parameter" {
  description = "(optional) SSM parameter name to read events API key from (SecureString). If set, code will read from SSM instead of Secrets Manager."
  type = string
  default = ""
}

variable "traffic_ssm_parameter" {
  description = "(optional) SSM parameter name to read traffic API key from (SecureString)."
  type = string
  default = ""
}

# === Auto-Scaling and Resource Limits Variables ===

variable "stage" {
  description = "Deployment stage (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Lambda Configuration
variable "lambda_reserved_concurrency" {
  description = "Reserved concurrency for Lambda functions (limits simultaneous executions)"
  type        = number
  default     = 100
}

# DynamoDB Configuration
variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode: PAY_PER_REQUEST or PROVISIONED"
  type        = string
  default     = "PAY_PER_REQUEST"
  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.dynamodb_billing_mode)
    error_message = "DynamoDB billing mode must be either PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "dynamodb_read_capacity" {
  description = "DynamoDB read capacity units (only used when billing_mode is PROVISIONED)"
  type        = number
  default     = 5
}

variable "dynamodb_write_capacity" {
  description = "DynamoDB write capacity units (only used when billing_mode is PROVISIONED)"
  type        = number
  default     = 5
}

variable "enable_dynamodb_autoscaling" {
  description = "Enable DynamoDB auto-scaling (only applicable for PROVISIONED billing mode)"
  type        = bool
  default     = true
}

variable "dynamodb_autoscaling_max_read_capacity" {
  description = "Maximum read capacity for DynamoDB auto-scaling"
  type        = number
  default     = 1000
}

variable "dynamodb_autoscaling_max_write_capacity" {
  description = "Maximum write capacity for DynamoDB auto-scaling"
  type        = number
  default     = 1000
}

variable "dynamodb_autoscaling_target_value" {
  description = "Target utilization percentage for DynamoDB auto-scaling"
  type        = number
  default     = 70
}

variable "dynamodb_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB"
  type        = bool
  default     = true
}

# API Gateway Throttling
variable "api_gateway_throttle_rate_limit" {
  description = "API Gateway steady-state request rate limit (requests per second)"
  type        = number
  default     = 1000
}

variable "api_gateway_throttle_burst_limit" {
  description = "API Gateway burst request limit"
  type        = number
  default     = 2000
}

# CloudFront Configuration
variable "cloudfront_price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "cloudfront_default_ttl" {
  description = "Default TTL for CloudFront cache (seconds) - SPA assets"
  type        = number
  default     = 86400  # 24 hours
}

variable "cloudfront_max_ttl" {
  description = "Maximum TTL for CloudFront cache (seconds) - SPA assets"
  type        = number
  default     = 31536000  # 1 year
}

variable "api_cache_default_ttl" {
  description = "Default TTL for API endpoint caching (seconds)"
  type        = number
  default     = 300  # 5 minutes
}

variable "api_cache_max_ttl" {
  description = "Maximum TTL for API endpoint caching (seconds)"
  type        = number
  default     = 3600  # 1 hour
}

# Monitoring Configuration
variable "enable_monitoring_alerts" {
  description = "Enable CloudWatch monitoring alerts"
  type        = bool
  default     = true
}

variable "enable_monitoring_dashboard" {
  description = "Enable CloudWatch dashboard"
  type        = bool
  default     = true
}

variable "cloudwatch_log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

# Alert Thresholds
variable "lambda_error_rate_threshold" {
  description = "Lambda error rate threshold for alerts"
  type        = number
  default     = 5
}

variable "lambda_duration_threshold_trips" {
  description = "Lambda duration threshold for trips function (milliseconds)"
  type        = number
  default     = 25000  # 25 seconds (timeout is 30s)
}

variable "lambda_duration_threshold_plan" {
  description = "Lambda duration threshold for plan function (milliseconds)"
  type        = number
  default     = 35000  # 35 seconds (timeout is 45s)
}

variable "dynamodb_throttle_threshold" {
  description = "DynamoDB throttle requests threshold for alerts"
  type        = number
  default     = 0
}

variable "api_gateway_error_threshold" {
  description = "API Gateway 4XX error threshold for alerts"
  type        = number
  default     = 10
}
