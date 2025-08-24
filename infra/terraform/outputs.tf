# Daylight Infrastructure Outputs

# Database Outputs
output "database" {
  description = "Database module outputs"
  value = {
    trips_table_name = module.database.trips_table_name
    trips_table_arn  = module.database.trips_table_arn
    cache_table_name = module.database.cache_table_name
    cache_table_arn  = module.database.cache_table_arn
  }
}

# API Outputs
output "api" {
  description = "API module outputs"
  value = {
    api_id                    = module.api.api_id
    api_endpoint             = module.api.api_endpoint
    api_execution_arn        = module.api.api_execution_arn
    lambda_function_names    = module.api.lambda_function_names
    lambda_function_arns     = module.api.lambda_function_arns
    lambda_execution_role_arn = module.api.lambda_execution_role_arn
  }
}

# Frontend Outputs
output "frontend" {
  description = "Frontend module outputs"
  value = {
    s3_bucket_name           = module.frontend.s3_bucket_name
    s3_bucket_arn           = module.frontend.s3_bucket_arn
    cloudfront_distribution_id = module.frontend.cloudfront_distribution_id
    cloudfront_domain_name  = module.frontend.cloudfront_domain_name
    website_url             = module.frontend.website_url
  }
}

# Legacy outputs for backward compatibility
output "frontend_bucket" {
  description = "Frontend S3 bucket name (legacy)"
  value       = module.frontend.s3_bucket_name
}

output "cdn_domain" {
  description = "CloudFront domain name (legacy)"
  value       = module.frontend.cloudfront_domain_name
}

output "api_base_url" {
  description = "API Gateway endpoint (legacy)"
  value       = module.api.api_endpoint
}

output "s3_bucket_name" {
  description = "S3 bucket name for deployment scripts"
  value       = module.frontend.s3_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for deployment scripts"
  value       = module.frontend.cloudfront_distribution_id
}

output "website_url" {
  description = "Complete website URL"
  value       = module.frontend.website_url
}

# Secrets Manager outputs (if created)
output "secrets_manager_arn" {
  description = "Secrets Manager ARN for API keys"
  value       = var.create_secrets_manager ? aws_secretsmanager_secret.api_keys[0].arn : null
}

# SNS Topic outputs (if created)
output "alarm_topic_arn" {
  description = "SNS topic ARN for alarms"
  value       = var.create_alarm_topic ? aws_sns_topic.alarms[0].arn : null
}

# Deployment Information
output "deployment_info" {
  description = "Information needed for deployments"
  value = {
    # For GitHub Actions
    lambda_function_names = {
      trips = "${var.project_name}-trips-${var.environment}"
      plan  = "${var.project_name}-plan-${var.environment}"
    }
    
    # For deployment scripts
    s3_bucket               = module.frontend.s3_bucket_name
    cloudfront_distribution = module.frontend.cloudfront_distribution_id
    api_endpoint           = module.api.api_endpoint
    website_url            = module.frontend.website_url
    
    # Environment info
    environment = var.environment
    region      = var.aws_region
  }
}
