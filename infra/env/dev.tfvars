# Development Environment Configuration

# Basic settings
project_name = "daylight"
environment  = "dev"
aws_region   = "us-west-1"
owner        = "daylight-dev-team"

# Logging
log_retention_days = 7  # Shorter retention for dev

# Database configuration
database_config = {
  billing_mode = "PAY_PER_REQUEST"  # Cost-effective for dev
  
  trips_table = {
    hash_key = "tripId"
    attributes = [
      {
        name = "tripId"
        type = "S"
      }
    ]
    ttl_attribute = "expiresAt"  # Auto-cleanup in dev
  }
  
  enable_cache_table = true  # Test caching in dev
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
  
  enable_point_in_time_recovery       = false  # Not needed in dev
  enable_cache_point_in_time_recovery = false
  enable_cloudwatch_alarms           = false  # Reduce noise in dev
}

# API configuration
api_config = {
  lambda_runtime = "nodejs20.x"
  
  lambda_functions = {
    trips = {
      handler     = "trips.handler"
      zip_file    = "../../backend/dist/trips.zip"
      timeout     = 30
      memory_size = 512
    }
    plan = {
      handler     = "plan.handler"
      zip_file    = "../../backend/dist/plan.zip"
      timeout     = 30
      memory_size = 512
    }
    health = {
      handler     = "health.handler"
      zip_file    = "../../backend/dist/health.zip"
      timeout     = 10
      memory_size = 128
    }
    rateLimit = {
      handler     = "rateLimit.handler"
      zip_file    = "../../backend/dist/rateLimit.zip"
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
    health_check = {
      method        = "GET"
      path         = "/health"
      function_name = "health"
    }
  }
  
  environment_variables = {
    NODE_ENV     = "development"
    LOG_LEVEL    = "debug"
    CACHE_TTL    = "300"  # 5 minutes in dev
  }
  
  enable_external_api_access = true
  
  cors_configuration = {
    allow_credentials = false
    allow_headers     = ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-API-Key"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000", 
      "http://127.0.0.1:5173",
      "https://kda4nly79c.execute-api.us-west-1.amazonaws.com" # Current API Gateway domain
    ]
    max_age          = 86400
  }
  
  throttling_burst_limit = 1000   # Lower limits for dev
  throttling_rate_limit  = 500
  detailed_metrics_enabled = true
  
  # CloudWatch alarms (enabled for testing in dev)
  enable_cloudwatch_alarms = true
  error_rate_threshold     = 10  # Higher threshold for dev
}

# Frontend configuration
frontend_config = {
  force_destroy     = true   # Allow easy cleanup in dev
  enable_versioning = false  # Simplify dev bucket
  
  price_class = "PriceClass_100"  # Cost optimization
  
  cache_behaviors = {
    default = {
      default_ttl = 60      # Short cache in dev (1 minute)
      max_ttl     = 300     # 5 minutes max
    }
    assets = {
      path_pattern = "/assets/*"
      default_ttl  = 3600   # 1 hour for assets in dev
      max_ttl      = 86400  # 1 day max
    }
    api = {
      path_pattern = "/api/*"
      default_ttl  = 0      # No caching for API
      max_ttl      = 0
    }
  }
  
  enable_cloudfront_logs = false  # Reduce costs in dev
}

# Optional components for development
create_secrets_manager       = true   # Test secrets integration
create_application_log_group = true   # Centralized logging
create_alarm_topic          = true   # Enable alarms for testing

# API Protection (WAF)
enable_waf = true
waf_rate_limit = 1000  # Lower rate limit for dev testing
waf_rate_limit_action = "COUNT"  # Count mode for dev (non-blocking)
