# Database Module (DynamoDB)
# This module creates DynamoDB tables with optional caching table

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# DynamoDB table for trips data
resource "aws_dynamodb_table" "trips" {
  name           = "${var.project_name}-trips-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = var.trips_table.hash_key
  range_key      = var.trips_table.range_key

  # Provisioned capacity (only used if billing_mode is PROVISIONED)
  read_capacity  = var.billing_mode == "PROVISIONED" ? var.trips_table.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.trips_table.write_capacity : null

  # Attributes
  dynamic "attribute" {
    for_each = var.trips_table.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # Global Secondary Indexes
  dynamic "global_secondary_index" {
    for_each = var.trips_table.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = global_secondary_index.value.range_key
      projection_type = global_secondary_index.value.projection_type
      
      # Provisioned capacity for GSI (only if billing_mode is PROVISIONED)
      read_capacity  = var.billing_mode == "PROVISIONED" ? global_secondary_index.value.read_capacity : null
      write_capacity = var.billing_mode == "PROVISIONED" ? global_secondary_index.value.write_capacity : null
    }
  }

  # Local Secondary Indexes
  dynamic "local_secondary_index" {
    for_each = var.trips_table.local_secondary_indexes
    content {
      name            = local_secondary_index.value.name
      range_key       = local_secondary_index.value.range_key
      projection_type = local_secondary_index.value.projection_type
    }
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled = var.encryption_configuration.enabled
  }

  # TTL configuration
  dynamic "ttl" {
    for_each = var.trips_table.ttl_attribute != null ? [1] : []
    content {
      attribute_name = var.trips_table.ttl_attribute
      enabled        = true
    }
  }

  # Stream configuration
  stream_enabled   = var.trips_table.stream_enabled
  stream_view_type = var.trips_table.stream_enabled ? var.trips_table.stream_view_type : null

  tags = {
    Name        = "${var.project_name}-trips-${var.environment}"
    Environment = var.environment
    Module      = "database"
    Purpose     = "Trips data storage"
  }
}

# DynamoDB table for caching (optional)
resource "aws_dynamodb_table" "cache" {
  count = var.enable_cache_table ? 1 : 0

  name           = "${var.project_name}-cache-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = var.cache_table.hash_key
  range_key      = var.cache_table.range_key

  # Provisioned capacity (only used if billing_mode is PROVISIONED)
  read_capacity  = var.billing_mode == "PROVISIONED" ? var.cache_table.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.cache_table.write_capacity : null

  # Attributes
  dynamic "attribute" {
    for_each = var.cache_table.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # TTL for cache expiration
  dynamic "ttl" {
    for_each = var.cache_table.ttl_attribute != null ? [1] : []
    content {
      attribute_name = var.cache_table.ttl_attribute
      enabled        = true
    }
  }

  # Point-in-time recovery (usually not needed for cache)
  point_in_time_recovery {
    enabled = var.enable_cache_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled = var.encryption_configuration.enabled
  }

  tags = {
    Name        = "${var.project_name}-cache-${var.environment}"
    Environment = var.environment
    Module      = "database"
    Purpose     = "API response caching"
  }
}

# CloudWatch alarms for DynamoDB tables
resource "aws_cloudwatch_metric_alarm" "trips_read_throttle" {
  count = var.enable_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-trips-read-throttle-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadThrottledEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB read throttling"

  dimensions = {
    TableName = aws_dynamodb_table.trips.name
  }

  alarm_actions = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Name        = "${var.project_name}-trips-read-throttle-alarm-${var.environment}"
    Environment = var.environment
    Module      = "database"
  }
}

resource "aws_cloudwatch_metric_alarm" "trips_write_throttle" {
  count = var.enable_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-trips-write-throttle-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteThrottledEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB write throttling"

  dimensions = {
    TableName = aws_dynamodb_table.trips.name
  }

  alarm_actions = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Name        = "${var.project_name}-trips-write-throttle-alarm-${var.environment}"
    Environment = var.environment
    Module      = "database"
  }
}
