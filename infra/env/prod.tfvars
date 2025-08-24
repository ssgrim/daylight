# Production Environment Configuration

# Basic settings
project_name = "daylight"
environment  = "prod"
aws_region   = "us-west-1"
owner        = "daylight-ops-team"

# Logging
log_retention_days = 30  # Longer retention for production

# Database configuration
database_config = {
  billing_mode = "PAY_PER_REQUEST"  # Can switch to PROVISIONED if predictable load
  
  trips_table = {
    hash_key = "tripId"
    attributes = [
      {
        name = "tripId"
        type = "S"
      },
      {
        name = "userId"
        type = "S"
      },
      {
        name = "createdAt"
        type = "S"
      }
    ]
    
    # Global Secondary Index for user queries
    global_secondary_indexes = [
      {
        name         = "UserIndex"
        hash_key     = "userId"
        range_key    = "createdAt"
        projection_type = "ALL"
      }
    ]
    
    ttl_attribute = null  # No automatic cleanup in prod
    stream_enabled = true  # Enable for analytics
    stream_view_type = "NEW_AND_OLD_IMAGES"
  }
  
  enable_cache_table = true
  cache_table = {
    hash_key = "cacheKey"
    attributes = [
      {
        name = "cacheKey"
        type = "S"
      }
    ]
    ttl_attribute = "ttl"
  }
  
  enable_point_in_time_recovery       = true   # Essential for production
  enable_cache_point_in_time_recovery = false  # Cache can be rebuilt
  enable_cloudwatch_alarms           = true   # Monitor production
}

# API configuration
api_config = {
  lambda_runtime = "nodejs20.x"
  
  lambda_functions = {
    trips = {
      handler     = "trips.handler"
      zip_file    = "../../backend/dist/trips.zip"
      timeout     = 60     # Longer timeout for production
      memory_size = 1024   # More memory for production load
    }
    plan = {
      handler     = "plan.handler"
      zip_file    = "../../backend/dist/plan.zip"
      timeout     = 60
      memory_size = 1024
    }
    health = {
      handler     = "health.handler"
      zip_file    = "../../backend/dist/health.zip"
      timeout     = 10
      memory_size = 128
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
    get_trips = {
      method        = "GET"
      path         = "/trips"
      function_name = "trips"
    }
    put_trips = {
      method        = "PUT"
      path         = "/trips/{id}"
      function_name = "trips"
    }
    delete_trips = {
      method        = "DELETE"
      path         = "/trips/{id}"
      function_name = "trips"
    }
    health_check = {
      method        = "GET"
      path         = "/health"
      function_name = "health"
    }
  }
  
  environment_variables = {
    NODE_ENV     = "production"
    LOG_LEVEL    = "info"
    CACHE_TTL    = "3600"  # 1 hour in production
  }
  
  enable_external_api_access = true
  
  cors_configuration = {
    allow_credentials = false
    allow_headers     = ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-API-Key"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = [
      "https://daylight.app", 
      "https://www.daylight.app",
      "https://staging.daylight.app",
      # Add CloudFront distribution domain when available
      # "https://d1234567890abc.cloudfront.net"
    ]
    max_age          = 86400
  }
  
  throttling_burst_limit = 10000  # Higher limits for production
  throttling_rate_limit  = 5000
  detailed_metrics_enabled = true
  
  # CloudWatch alarms (strict monitoring in production)
  enable_cloudwatch_alarms = true
  error_rate_threshold     = 5  # Lower threshold for production
}

# Frontend configuration
frontend_config = {
  force_destroy     = false  # Protect production data
  enable_versioning = true   # Keep versions in production
  
  price_class = "PriceClass_All"  # Global distribution for production
  
  cache_behaviors = {
    default = {
      default_ttl = 300     # 5 minutes for HTML
      max_ttl     = 3600    # 1 hour max
    }
    assets = {
      path_pattern = "/assets/*"
      default_ttl  = 31536000  # 1 year for assets
      max_ttl      = 31536000  # 1 year max
    }
    api = {
      path_pattern = "/api/*"
      default_ttl  = 0      # No caching for API
      max_ttl      = 0
    }
  }
  
  ssl_certificate = {
    use_default_certificate = false
    # acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
    ssl_support_method = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  
  geo_restriction = {
    restriction_type = "none"  # or "whitelist"/"blacklist" if needed
    locations        = []      # ["US", "CA", "GB"] etc.
  }
  
  enable_cloudfront_logs = true  # Enable logging in production
}

# Optional components for production
create_secrets_manager       = true   # Store API keys securely
create_application_log_group = true   # Centralized logging
create_alarm_topic          = true   # Monitor production

# Production monitoring
# alarm_email = "alerts@daylight.app"  # Uncomment and set email
