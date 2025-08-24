# Lambda + API Gateway Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "lambda_runtime" {
  description = "Runtime for Lambda functions"
  type        = string
  default     = "nodejs20.x"
}

variable "lambda_functions" {
  description = "Map of Lambda functions to create"
  type = map(object({
    handler               = string
    zip_file             = string
    timeout              = optional(number, 30)
    memory_size          = optional(number, 512)
    environment_variables = optional(map(string), {})
  }))
}

variable "api_routes" {
  description = "Map of API Gateway routes"
  type = map(object({
    method                = string
    path                 = string
    function_name        = string
    authorization_type   = optional(string, "NONE")
    authorizer_id       = optional(string, null)
    timeout_milliseconds = optional(number, 30000)
  }))
}

variable "environment_variables" {
  description = "Common environment variables for all Lambda functions"
  type        = map(string)
  default     = {}
}

variable "dynamodb_table_arn" {
  description = "ARN of DynamoDB table for Lambda access"
  type        = string
  default     = null
}

variable "dynamodb_table_name" {
  description = "Name of DynamoDB table for Lambda environment variable"
  type        = string
  default     = null
}

variable "enable_external_api_access" {
  description = "Enable IAM permissions for external API access via Secrets Manager"
  type        = bool
  default     = false
}

variable "cors_configuration" {
  description = "CORS configuration for API Gateway"
  type = object({
    allow_credentials = optional(bool, false)
    allow_headers     = optional(list(string), ["*"])
    allow_methods     = optional(list(string), ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    allow_origins     = optional(list(string), ["*"])
    expose_headers    = optional(list(string), [])
    max_age          = optional(number, 86400)
  })
  default = {}
}

variable "api_stage_name" {
  description = "Name of the API Gateway stage"
  type        = string
  default     = "$default"
}

variable "api_auto_deploy" {
  description = "Enable auto-deployment for API Gateway stage"
  type        = bool
  default     = true
}

variable "throttling_burst_limit" {
  description = "API Gateway throttling burst limit"
  type        = number
  default     = 5000
}

variable "throttling_rate_limit" {
  description = "API Gateway throttling rate limit"
  type        = number
  default     = 2000
}

variable "detailed_metrics_enabled" {
  description = "Enable detailed metrics for API Gateway"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for API Gateway and Lambda"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  type        = string
  default     = null
}

variable "error_rate_threshold" {
  description = "Error rate threshold for 5xx alarms (percentage)"
  type        = number
  default     = 5
}

variable "error_rate_evaluation_periods" {
  description = "Number of evaluation periods for error rate alarms"
  type        = number
  default     = 2
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking"
  type        = string
  default     = null
  sensitive   = true
}

variable "git_sha" {
  description = "Git commit SHA for release tagging"
  type        = string
  default     = null
}

# API Protection Configuration
variable "enable_waf" {
  description = "Enable AWS WAF protection for API Gateway"
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  description = "Rate limit per IP address (requests per 5-minute window)"
  type        = number
  default     = 2000
}

variable "waf_rate_limit_action" {
  description = "Action to take when rate limit is exceeded (BLOCK or COUNT)"
  type        = string
  default     = "BLOCK"
  validation {
    condition     = contains(["BLOCK", "COUNT"], var.waf_rate_limit_action)
    error_message = "WAF rate limit action must be either BLOCK or COUNT."
  }
}
