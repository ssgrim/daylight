# Frontend Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket (if not provided, will be auto-generated)"
  type        = string
  default     = null
}

variable "force_destroy" {
  description = "Allow destruction of bucket with objects"
  type        = bool
  default     = false
}

variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "encryption_configuration" {
  description = "S3 bucket encryption configuration"
  type = object({
    sse_algorithm      = optional(string, "AES256")
    kms_master_key_id  = optional(string, null)
    bucket_key_enabled = optional(bool, true)
  })
  default = {}
}

variable "enable_ipv6" {
  description = "Enable IPv6 for CloudFront distribution"
  type        = bool
  default     = true
}

variable "default_root_object" {
  description = "Default root object for CloudFront distribution"
  type        = string
  default     = "index.html"
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200", 
      "PriceClass_100"
    ], var.price_class)
    error_message = "Price class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

variable "custom_headers" {
  description = "Custom headers to add to origin requests"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "api_gateway_domain" {
  description = "Domain name of API Gateway (without https://)"
  type        = string
  default     = null
}

variable "cache_behaviors" {
  description = "Cache behavior configurations"
  type = object({
    default = object({
      allowed_methods            = optional(list(string), ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"])
      cached_methods            = optional(list(string), ["GET", "HEAD"])
      forward_query_string      = optional(bool, false)
      forward_cookies           = optional(string, "none")
      viewer_protocol_policy    = optional(string, "redirect-to-https")
      min_ttl                   = optional(number, 0)
      default_ttl               = optional(number, 300)
      max_ttl                   = optional(number, 31536000)
      compress                  = optional(bool, true)
    })
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
    }), null)
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
    }), null)
  })
  default = {}
}

variable "response_headers_policy_id" {
  description = "CloudFront response headers policy ID"
  type        = string
  default     = null
}

variable "geo_restriction" {
  description = "Geographic restriction configuration"
  type = object({
    restriction_type = optional(string, "none")
    locations        = optional(list(string), [])
  })
  default = {}
}

variable "ssl_certificate" {
  description = "SSL certificate configuration"
  type = object({
    use_default_certificate  = optional(bool, true)
    acm_certificate_arn     = optional(string, null)
    ssl_support_method      = optional(string, "sni-only")
    minimum_protocol_version = optional(string, "TLSv1.2_2021")
  })
  default = {}
}

variable "custom_error_responses" {
  description = "Custom error responses for SPA routing"
  type = list(object({
    error_code            = number
    response_code         = number
    response_page_path    = string
    error_caching_min_ttl = optional(number, 10)
  }))
  default = [
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
  ]
}

variable "web_acl_id" {
  description = "AWS WAF Web ACL ID to associate with CloudFront"
  type        = string
  default     = null
}

variable "enable_cloudfront_logs" {
  description = "Enable CloudFront access logs"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}
