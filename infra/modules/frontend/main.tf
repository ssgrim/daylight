# Frontend Module (S3 + CloudFront)
# This module creates S3 bucket for static hosting with CloudFront CDN

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 bucket for frontend hosting
resource "aws_s3_bucket" "frontend" {
  bucket        = var.bucket_name != null ? var.bucket_name : "${var.project_name}-frontend-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = var.force_destroy

  tags = {
    Name        = "${var.project_name}-frontend-${var.environment}"
    Environment = var.environment
    Module      = "frontend"
    Purpose     = "Static website hosting"
  }
}

# Random suffix for bucket name if not provided
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

# S3 bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.encryption_configuration.sse_algorithm
      kms_master_key_id = var.encryption_configuration.kms_master_key_id
    }
    bucket_key_enabled = var.encryption_configuration.bucket_key_enabled
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-${var.environment}-oac"
  description                       = "OAC for ${var.project_name} frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = var.enable_ipv6
  default_root_object = var.default_root_object
  price_class         = var.price_class
  comment             = "CloudFront distribution for ${var.project_name} ${var.environment}"

  # S3 origin
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
    origin_id                = "S3-${aws_s3_bucket.frontend.bucket}"

    # Add custom headers if provided
    dynamic "custom_header" {
      for_each = var.custom_headers
      content {
        name  = custom_header.value.name
        value = custom_header.value.value
      }
    }
  }

  # API Gateway origin (if provided)
  dynamic "origin" {
    for_each = var.api_gateway_domain != null ? [1] : []
    content {
      domain_name = var.api_gateway_domain
      origin_id   = "API-${var.project_name}"
      
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Default cache behavior for static content
  default_cache_behavior {
    allowed_methods  = var.cache_behaviors.default.allowed_methods
    cached_methods   = var.cache_behaviors.default.cached_methods
    target_origin_id = "S3-${aws_s3_bucket.frontend.bucket}"

    forwarded_values {
      query_string = var.cache_behaviors.default.forward_query_string
      cookies {
        forward = var.cache_behaviors.default.forward_cookies
      }
    }

    viewer_protocol_policy     = var.cache_behaviors.default.viewer_protocol_policy
    min_ttl                    = var.cache_behaviors.default.min_ttl
    default_ttl                = var.cache_behaviors.default.default_ttl
    max_ttl                    = var.cache_behaviors.default.max_ttl
    compress                   = var.cache_behaviors.default.compress
    response_headers_policy_id = var.response_headers_policy_id
  }

  # Cache behavior for static assets
  dynamic "ordered_cache_behavior" {
    for_each = var.cache_behaviors.assets != null ? [var.cache_behaviors.assets] : []
    content {
      path_pattern     = ordered_cache_behavior.value.path_pattern
      allowed_methods  = ordered_cache_behavior.value.allowed_methods
      cached_methods   = ordered_cache_behavior.value.cached_methods
      target_origin_id = "S3-${aws_s3_bucket.frontend.bucket}"

      forwarded_values {
        query_string = ordered_cache_behavior.value.forward_query_string
        cookies {
          forward = ordered_cache_behavior.value.forward_cookies
        }
      }

      viewer_protocol_policy = ordered_cache_behavior.value.viewer_protocol_policy
      min_ttl                = ordered_cache_behavior.value.min_ttl
      default_ttl            = ordered_cache_behavior.value.default_ttl
      max_ttl                = ordered_cache_behavior.value.max_ttl
      compress               = ordered_cache_behavior.value.compress
    }
  }

  # Cache behavior for API routes
  dynamic "ordered_cache_behavior" {
    for_each = var.api_gateway_domain != null && var.cache_behaviors.api != null ? [var.cache_behaviors.api] : []
    content {
      path_pattern     = ordered_cache_behavior.value.path_pattern
      allowed_methods  = ordered_cache_behavior.value.allowed_methods
      cached_methods   = ordered_cache_behavior.value.cached_methods
      target_origin_id = "API-${var.project_name}"

      forwarded_values {
        query_string = ordered_cache_behavior.value.forward_query_string
        headers      = ordered_cache_behavior.value.forward_headers
        cookies {
          forward = ordered_cache_behavior.value.forward_cookies
        }
      }

      viewer_protocol_policy = ordered_cache_behavior.value.viewer_protocol_policy
      min_ttl                = ordered_cache_behavior.value.min_ttl
      default_ttl            = ordered_cache_behavior.value.default_ttl
      max_ttl                = ordered_cache_behavior.value.max_ttl
      compress               = ordered_cache_behavior.value.compress
    }
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction.restriction_type
      locations        = var.geo_restriction.locations
    }
  }

  # SSL certificate configuration
  viewer_certificate {
    cloudfront_default_certificate = var.ssl_certificate.use_default_certificate
    acm_certificate_arn           = var.ssl_certificate.acm_certificate_arn
    ssl_support_method            = var.ssl_certificate.ssl_support_method
    minimum_protocol_version      = var.ssl_certificate.minimum_protocol_version
  }

  # Custom error responses for SPA routing
  dynamic "custom_error_response" {
    for_each = var.custom_error_responses
    content {
      error_code         = custom_error_response.value.error_code
      response_code      = custom_error_response.value.response_code
      response_page_path = custom_error_response.value.response_page_path
      error_caching_min_ttl = custom_error_response.value.error_caching_min_ttl
    }
  }

  # Web ACL (if provided)
  web_acl_id = var.web_acl_id

  tags = {
    Name        = "${var.project_name}-frontend-${var.environment}"
    Environment = var.environment
    Module      = "frontend"
  }
}

# S3 bucket policy to allow CloudFront OAC access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_cloudfront_distribution.frontend]
}

# CloudWatch log group for CloudFront access logs (optional)
resource "aws_cloudwatch_log_group" "cloudfront_logs" {
  count             = var.enable_cloudfront_logs ? 1 : 0
  name              = "/aws/cloudfront/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-cloudfront-logs-${var.environment}"
    Environment = var.environment
    Module      = "frontend"
  }
}
