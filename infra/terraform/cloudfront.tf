# CloudFront caching configuration for proper origin routing and cache behavior

resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend.bucket}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  # API Gateway origin for /api/* routes
  origin {
    domain_name = replace(aws_api_gateway_rest_api.main.execution_arn, "arn:aws:execute-api:${var.region}:${data.aws_caller_identity.current.account_id}:", "")
    origin_id   = "API-Gateway"
    origin_path = "/${var.environment}"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  # Custom error responses for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300  # Short TTL for index.html
  }

  # API routes - no caching
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "API-Gateway"
    compress         = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Accept"]
      
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    
    # No caching for API routes
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
    
    # Cache control headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.api_no_cache.id
  }

  # Static assets - long TTL caching (hashed filenames)
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.bucket}"
    compress         = true

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    
    # Long TTL for hashed assets (1 year)
    min_ttl     = 31536000  # 1 year
    default_ttl = 31536000  # 1 year  
    max_ttl     = 31536000  # 1 year
    
    response_headers_policy_id = aws_cloudfront_response_headers_policy.static_assets.id
  }

  # Default behavior for index.html and other files - short TTL
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.bucket}"
    compress         = true

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    
    # Short TTL for index.html and non-hashed files
    min_ttl     = 0
    default_ttl = 300   # 5 minutes
    max_ttl     = 3600  # 1 hour
    
    response_headers_policy_id = aws_cloudfront_response_headers_policy.html_short_cache.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.app_name}-frontend-${var.environment}"
    Environment = var.environment
  }
}

# Response headers policies for different cache behaviors
resource "aws_cloudfront_response_headers_policy" "api_no_cache" {
  name    = "${var.app_name}-api-no-cache-${var.environment}"
  comment = "No cache headers for API routes"

  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "no-cache, no-store, must-revalidate"
      override = true
    }
    items {
      header   = "Pragma"
      value    = "no-cache"
      override = true
    }
    items {
      header   = "Expires"
      value    = "0"
      override = true
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "static_assets" {
  name    = "${var.app_name}-static-assets-${var.environment}"
  comment = "Long cache headers for static assets with hashed filenames"

  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "public, max-age=31536000, immutable"
      override = true
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "html_short_cache" {
  name    = "${var.app_name}-html-short-cache-${var.environment}"
  comment = "Short cache headers for HTML files"

  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "public, max-age=300, must-revalidate"
      override = true
    }
  }
}

# Origin Access Identity for S3
resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "OAI for ${var.app_name} frontend ${var.environment}"
}
