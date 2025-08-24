# Database Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "billing_mode" {
  description = "DynamoDB billing mode"
  type        = string
  default     = "PAY_PER_REQUEST"
  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.billing_mode)
    error_message = "Billing mode must be either PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "trips_table" {
  description = "Configuration for the trips table"
  type = object({
    hash_key      = optional(string, "tripId")
    range_key     = optional(string, null)
    read_capacity = optional(number, 5)
    write_capacity = optional(number, 5)
    
    attributes = list(object({
      name = string
      type = string
    }))
    
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
  })
  
  default = {
    attributes = [
      {
        name = "tripId"
        type = "S"
      }
    ]
  }
}

variable "enable_cache_table" {
  description = "Enable creation of cache table"
  type        = bool
  default     = false
}

variable "cache_table" {
  description = "Configuration for the cache table"
  type = object({
    hash_key      = optional(string, "cacheKey")
    range_key     = optional(string, null)
    read_capacity = optional(number, 5)
    write_capacity = optional(number, 5)
    
    attributes = list(object({
      name = string
      type = string
    }))
    
    ttl_attribute = optional(string, "ttl")
  })
  
  default = {
    attributes = [
      {
        name = "cacheKey"
        type = "S"
      }
    ]
  }
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for trips table"
  type        = bool
  default     = true
}

variable "enable_cache_point_in_time_recovery" {
  description = "Enable point-in-time recovery for cache table"
  type        = bool
  default     = false
}

variable "encryption_configuration" {
  description = "Server-side encryption configuration"
  type = object({
    enabled    = optional(bool, true)
    kms_key_id = optional(string, null)
  })
  default = {}
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for DynamoDB tables"
  type        = bool
  default     = false
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = null
}
