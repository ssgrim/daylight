# DynamoDB cache table for API response caching
# This is optional - enable via ENABLE_CACHE_DDB environment variable

resource "aws_dynamodb_table" "cache_table" {
  count = var.enable_cache_ddb ? 1 : 0
  
  name           = "${var.app_name}-cache-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  # TTL configuration for automatic cleanup
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  tags = {
    Name        = "${var.app_name}-cache-${var.environment}"
    Environment = var.environment
    Purpose     = "API response caching"
  }
}

# IAM permissions for Lambda to access cache table
resource "aws_iam_policy" "cache_policy" {
  count = var.enable_cache_ddb ? 1 : 0
  
  name        = "${var.app_name}-cache-policy-${var.environment}"
  description = "IAM policy for DynamoDB cache access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.cache_table[0].arn
      }
    ]
  })
}

# Output cache table name for environment variables
output "cache_table_name" {
  value = var.enable_cache_ddb ? aws_dynamodb_table.cache_table[0].name : null
  description = "Name of the DynamoDB cache table"
}

output "cache_table_arn" {
  value = var.enable_cache_ddb ? aws_dynamodb_table.cache_table[0].arn : null
  description = "ARN of the DynamoDB cache table"
}
