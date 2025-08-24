# Daylight Infrastructure Variables

# Basic Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "daylight"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-1"
}

variable "owner" {
  description = "Owner/team responsible for the infrastructure"
  type        = string
  default     = "daylight-team"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

# Database Configuration
variable "database_config" {
  description = "Database configuration"
  type = object({
    billing_mode = optional(string, "PAY_PER_REQUEST")
    
    trips_table = optional(object({
      hash_key      = optional(string, "tripId")
      range_key     = optional(string, null)
      read_capacity = optional(number, 5)
      write_capacity = optional(number, 5)
      
      attributes = optional(list(object({
        name = string
        type = string
      })), [
        {
          name = "tripId"
          type = "S"
        }
      ])
      
      global_secondary_indexes = optional(list(object({
        name               = string
        hash_key          = string
        range_key         = optional(string, null)
        projection_type   = optional(string, "ALL")
        read_capacity     = optional(number, 5)
        write_capacity    = optional(number, 5)
      })), [])
      
      local_secondary_indexes = optional(list(object({
        name            = string
        range_key       = string
        projection_type = optional(string, "ALL")
      })), [])
      
      ttl_attribute      = optional(string, null)
      stream_enabled     = optional(bool, false)
      stream_view_type   = optional(string, "NEW_AND_OLD_IMAGES")
    }), {})
    
    enable_cache_table = optional(bool, false)
    cache_table = optional(object({
      hash_key      = optional(string, "cacheKey")
      range_key     = optional(string, null)
      read_capacity = optional(number, 5)
      write_capacity = optional(number, 5)
      
      attributes = optional(list(object({
        name = string
        type = string
      })), [
        {
          name = "cacheKey"
          type = "S"
        }
      ])
      
      ttl_attribute = optional(string, "ttl")
    }), {})
    
    enable_point_in_time_recovery       = optional(bool, true)
    enable_cache_point_in_time_recovery = optional(bool, false)
    
    encryption_configuration = optional(object({
      enabled    = optional(bool, true)
      kms_key_id = optional(string, null)
    }), {})
    
    enable_cloudwatch_alarms = optional(bool, false)
  })
  default = {}
}

# API Configuration
variable "api_config" {
  description = "API configuration"
  type = object({
    lambda_runtime = optional(string, "nodejs20.x")
    
    lambda_functions = map(object({
      handler               = string
      zip_file             = string
      timeout              = optional(number, 30)
      memory_size          = optional(number, 512)
      environment_variables = optional(map(string), {})
    }))
    
    api_routes = map(object({
      method                = string
      path                 = string
      function_name        = string
      authorization_type   = optional(string, "NONE")
      authorizer_id       = optional(string, null)
      timeout_milliseconds = optional(number, 30000)
    }))
    
    environment_variables = optional(map(string), {})
    enable_external_api_access = optional(bool, false)
    
    cors_configuration = optional(object({
      allow_credentials = optional(bool, false)
      allow_headers     = optional(list(string), ["*"])
      allow_methods     = optional(list(string), ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
      allow_origins     = optional(list(string), ["*"])
      expose_headers    = optional(list(string), [])
      max_age          = optional(number, 86400)
    }), {})
    
    api_stage_name           = optional(string, "$default")
    api_auto_deploy          = optional(bool, true)
    throttling_burst_limit   = optional(number, 5000)
    throttling_rate_limit    = optional(number, 2000)
    detailed_metrics_enabled = optional(bool, true)
    
    # CloudWatch alarms configuration
    enable_cloudwatch_alarms = optional(bool, true)
    error_rate_threshold     = optional(number, 5)
  })
  
  # Default configuration for Daylight application
  default = {
    lambda_functions = {
      trips = {
        handler  = "trips.handler"
        zip_file = "../../backend/dist/trips.zip"
      }
      plan = {
        handler  = "plan.handler"
        zip_file = "../../backend/dist/plan.zip"
      }
    }
    
    api_routes = {
      get_plan = {
        method        = "GET"
        path         = "/plan"
        function_name = "plan"
      }
      post_trips = {
        method        = "POST"
        path         = "/trips"
        function_name = "trips"
      }
    }
  }
}

# Frontend Configuration
variable "frontend_config" {
  description = "Frontend configuration"
  type = object({
    bucket_name       = optional(string, null)
    force_destroy     = optional(bool, false)
    enable_versioning = optional(bool, true)
    
    encryption_configuration = optional(object({
      sse_algorithm      = optional(string, "AES256")
      kms_master_key_id  = optional(string, null)
      bucket_key_enabled = optional(bool, true)
    }), {})
    
    enable_ipv6          = optional(bool, true)
    default_root_object  = optional(string, "index.html")
    price_class          = optional(string, "PriceClass_100")
    
    cache_behaviors = optional(object({
      default = optional(object({
        allowed_methods            = optional(list(string), ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"])
        cached_methods            = optional(list(string), ["GET", "HEAD"])
        forward_query_string      = optional(bool, false)
        forward_cookies           = optional(string, "none")
        viewer_protocol_policy    = optional(string, "redirect-to-https")
        min_ttl                   = optional(number, 0)
        default_ttl               = optional(number, 300)
        max_ttl                   = optional(number, 31536000)
        compress                  = optional(bool, true)
      }), {})
      assets = optional(object({
        path_pattern              = optional(string, "/assets/*")
        allowed_methods           = optional(list(string), ["GET", "HEAD", "OPTIONS"])
        cached_methods            = optional(list(string), ["GET", "HEAD"])
        forward_query_string      = optional(bool, false)
        forward_cookies           = optional(string, "none")
        viewer_protocol_policy    = optional(string, "redirect-to-https")
        min_ttl                   = optional(number, 31536000)
        default_ttl               = optional(number, 31536000)
        max_ttl                   = optional(number, 31536000)
        compress                  = optional(bool, true)
      }), {})
      api = optional(object({
        path_pattern              = optional(string, "/api/*")
        allowed_methods           = optional(list(string), ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"])
        cached_methods            = optional(list(string), ["GET", "HEAD"])
        forward_query_string      = optional(bool, true)
        forward_headers           = optional(list(string), ["Authorization", "Content-Type", "Accept"])
        forward_cookies           = optional(string, "none")
        viewer_protocol_policy    = optional(string, "redirect-to-https")
        min_ttl                   = optional(number, 0)
        default_ttl               = optional(number, 0)
        max_ttl                   = optional(number, 0)
        compress                  = optional(bool, true)
      }), {})
    }), {})
    
    ssl_certificate = optional(object({
      use_default_certificate  = optional(bool, true)
      acm_certificate_arn     = optional(string, null)
      ssl_support_method      = optional(string, "sni-only")
      minimum_protocol_version = optional(string, "TLSv1.2_2021")
    }), {})
    
    geo_restriction = optional(object({
      restriction_type = optional(string, "none")
      locations        = optional(list(string), [])
    }), {})
    
    custom_error_responses = optional(list(object({
      error_code            = number
      response_code         = number
      response_page_path    = string
      error_caching_min_ttl = optional(number, 10)
    })), [
      {
        error_code         = 404
        response_code      = 200
        response_page_path = "/index.html"
      },
      {
        error_code         = 403
        response_code      = 200
        response_page_path = "/index.html"
      }
    ])
    
    web_acl_id             = optional(string, null)
    enable_cloudfront_logs = optional(bool, false)
  })
  default = {}
}

# Optional Components
variable "create_secrets_manager" {
  description = "Create Secrets Manager for API keys"
  type        = bool
  default     = false
}

variable "google_places_api_key" {
  description = "Google Places API key (stored in Secrets Manager)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "mapbox_access_token" {
  description = "Mapbox access token (stored in Secrets Manager)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "create_application_log_group" {
  description = "Create application-specific CloudWatch log group"
  type        = bool
  default     = false
}

variable "create_alarm_topic" {
  description = "Create SNS topic for alarms"
  type        = bool
  default     = false
}

variable "alarm_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = null
}

variable "alarm_sns_topic_arn" {
  description = "Existing SNS topic ARN for alarms"
  type        = string
  default     = null
}

# Error Tracking Configuration
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

variable "slack_webhook_url" {
  description = "Slack webhook URL for alarm notifications"
  type        = string
  default     = null
  sensitive   = true
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
