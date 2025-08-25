# Enhanced Secrets Management Infrastructure
# Provides comprehensive secrets management with KMS encryption, rotation, and monitoring

# KMS key for secrets encryption
resource "aws_kms_key" "secrets_key" {
  description             = "KMS key for Daylight secrets encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Secrets Manager"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:GenerateDataKeyWithoutPlaintext",
          "kms:ReEncryptFrom",
          "kms:ReEncryptTo"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda for rotation"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "daylight-secrets-key"
    Environment = var.environment
    Service     = "daylight"
    Purpose     = "secrets-encryption"
  }
}

resource "aws_kms_alias" "secrets_key_alias" {
  name          = "alias/daylight-secrets-${var.environment}"
  target_key_id = aws_kms_key.secrets_key.key_id
}

# IAM role for secret rotation Lambda
resource "aws_iam_role" "secret_rotation_role" {
  name = "daylight-secret-rotation-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "daylight-secret-rotation-role"
    Environment = var.environment
    Service     = "daylight"
  }
}

# IAM policy for secret rotation
resource "aws_iam_role_policy" "secret_rotation_policy" {
  name = "daylight-secret-rotation-policy"
  role = aws_iam_role.secret_rotation_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:daylight/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.secrets_key.arn
      }
    ]
  })
}

# Attach basic execution role to Lambda
resource "aws_iam_role_policy_attachment" "secret_rotation_basic" {
  role       = aws_iam_role.secret_rotation_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function for secret rotation
resource "aws_lambda_function" "secret_rotation" {
  filename         = "secret-rotation.zip"
  function_name    = "daylight-secret-rotation-${var.environment}"
  role            = aws_iam_role.secret_rotation_role.arn
  handler         = "secret-rotation.handler"
  runtime         = "nodejs18.x"
  timeout         = 60

  environment {
    variables = {
      NODE_ENV   = var.environment
      AWS_REGION = data.aws_region.current.name
      KMS_KEY_ID = aws_kms_key.secrets_key.key_id
    }
  }

  tags = {
    Name        = "daylight-secret-rotation"
    Environment = var.environment
    Service     = "daylight"
    Purpose     = "secret-rotation"
  }

  depends_on = [
    aws_iam_role_policy_attachment.secret_rotation_basic,
    aws_cloudwatch_log_group.secret_rotation_logs
  ]
}

# CloudWatch log group for rotation Lambda
resource "aws_cloudwatch_log_group" "secret_rotation_logs" {
  name              = "/aws/lambda/daylight-secret-rotation-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "daylight-secret-rotation-logs"
    Environment = var.environment
    Service     = "daylight"
  }
}

# Lambda permission for Secrets Manager to invoke rotation function
resource "aws_lambda_permission" "allow_secrets_manager" {
  statement_id  = "AllowSecretsManagerInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.secret_rotation.function_name
  principal     = "secretsmanager.amazonaws.com"
}

# Enhanced Mapbox secret with rotation
resource "aws_secretsmanager_secret" "mapbox_api_key" {
  name                    = "daylight/mapbox-api-key-${var.environment}"
  description             = "Mapbox API key for Daylight application with automatic rotation"
  kms_key_id             = aws_kms_key.secrets_key.key_id
  recovery_window_in_days = 7

  replica {
    region     = var.backup_region
    kms_key_id = aws_kms_key.secrets_key.key_id
  }

  tags = {
    Name        = "daylight-mapbox-secret"
    Environment = var.environment
    Service     = "daylight"
    SecretType  = "api-key"
    Rotatable   = "true"
  }
}

resource "aws_secretsmanager_secret_version" "mapbox_api_key" {
  secret_id = aws_secretsmanager_secret.mapbox_api_key.id
  secret_string = jsonencode({
    apiKey      = var.mapbox_api_key
    description = "Mapbox API key for geocoding and mapping services"
    service     = "mapbox"
    createdAt   = timestamp()
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Optional: Enable automatic rotation for Mapbox secret
resource "aws_secretsmanager_secret_rotation" "mapbox_rotation" {
  count           = var.enable_secret_rotation ? 1 : 0
  secret_id       = aws_secretsmanager_secret.mapbox_api_key.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation.arn

  rotation_rules {
    automatically_after_days = 30
  }

  depends_on = [aws_lambda_permission.allow_secrets_manager]
}

# Enhanced Google Maps secret with rotation
resource "aws_secretsmanager_secret" "google_maps_api_key" {
  name                    = "daylight/google-maps-api-key-${var.environment}"
  description             = "Google Maps API key for Daylight application with automatic rotation"
  kms_key_id             = aws_kms_key.secrets_key.key_id
  recovery_window_in_days = 7

  replica {
    region     = var.backup_region
    kms_key_id = aws_kms_key.secrets_key.key_id
  }

  tags = {
    Name        = "daylight-google-maps-secret"
    Environment = var.environment
    Service     = "daylight"
    SecretType  = "api-key"
    Rotatable   = "true"
  }
}

resource "aws_secretsmanager_secret_version" "google_maps_api_key" {
  secret_id = aws_secretsmanager_secret.google_maps_api_key.id
  secret_string = jsonencode({
    apiKey      = var.google_maps_api_key
    description = "Google Maps API key for geocoding services"
    service     = "google-maps"
    createdAt   = timestamp()
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_rotation" "google_maps_rotation" {
  count           = var.enable_secret_rotation ? 1 : 0
  secret_id       = aws_secretsmanager_secret.google_maps_api_key.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation.arn

  rotation_rules {
    automatically_after_days = 30
  }

  depends_on = [aws_lambda_permission.allow_secrets_manager]
}

# Enhanced Events API secret
resource "aws_secretsmanager_secret" "events_api_token" {
  name                    = "daylight/events-api-token-${var.environment}"
  description             = "Events API token for Daylight application with automatic rotation"
  kms_key_id             = aws_kms_key.secrets_key.key_id
  recovery_window_in_days = 7

  tags = {
    Name        = "daylight-events-secret"
    Environment = var.environment
    Service     = "daylight"
    SecretType  = "api-token"
    Rotatable   = "true"
  }
}

resource "aws_secretsmanager_secret_version" "events_api_token" {
  secret_id = aws_secretsmanager_secret.events_api_token.id
  secret_string = jsonencode({
    token       = var.events_api_token
    description = "Events API token for retrieving event data"
    service     = "events-api"
    createdAt   = timestamp()
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Enhanced Traffic API secret
resource "aws_secretsmanager_secret" "traffic_api_token" {
  name                    = "daylight/traffic-api-token-${var.environment}"
  description             = "Traffic API token for Daylight application with automatic rotation"
  kms_key_id             = aws_kms_key.secrets_key.key_id
  recovery_window_in_days = 7

  tags = {
    Name        = "daylight-traffic-secret"
    Environment = var.environment
    Service     = "daylight"
    SecretType  = "api-token"
    Rotatable   = "true"
  }
}

resource "aws_secretsmanager_secret_version" "traffic_api_token" {
  secret_id = aws_secretsmanager_secret.traffic_api_token.id
  secret_string = jsonencode({
    token       = var.traffic_api_token
    description = "Traffic API token for traffic data"
    service     = "traffic-api"
    createdAt   = timestamp()
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Database credentials secret
resource "aws_secretsmanager_secret" "database_credentials" {
  name                    = "daylight/database-credentials-${var.environment}"
  description             = "Database credentials for Daylight application with automatic rotation"
  kms_key_id             = aws_kms_key.secrets_key.key_id
  recovery_window_in_days = 7

  tags = {
    Name        = "daylight-database-secret"
    Environment = var.environment
    Service     = "daylight"
    SecretType  = "database"
    Rotatable   = "true"
  }
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  secret_string = jsonencode({
    username    = var.database_username
    password    = var.database_password
    engine      = "dynamodb"
    host        = "dynamodb.${data.aws_region.current.name}.amazonaws.com"
    port        = 443
    dbname      = aws_dynamodb_table.main.name
    createdAt   = timestamp()
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Enhanced IAM role for Lambda API access to secrets
resource "aws_iam_role_policy" "lambda_secrets_policy" {
  name = "daylight-lambda-secrets-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.mapbox_api_key.arn,
          aws_secretsmanager_secret.google_maps_api_key.arn,
          aws_secretsmanager_secret.events_api_token.arn,
          aws_secretsmanager_secret.traffic_api_token.arn,
          aws_secretsmanager_secret.database_credentials.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.secrets_key.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/daylight/*"
      }
    ]
  })
}

# CloudWatch alarms for secret rotation monitoring
resource "aws_cloudwatch_metric_alarm" "secret_rotation_errors" {
  alarm_name          = "daylight-secret-rotation-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors secret rotation Lambda function errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.secret_rotation.function_name
  }

  tags = {
    Name        = "daylight-secret-rotation-errors"
    Environment = var.environment
    Service     = "daylight"
  }
}

resource "aws_cloudwatch_metric_alarm" "secret_rotation_duration" {
  alarm_name          = "daylight-secret-rotation-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "45000" # 45 seconds
  alarm_description   = "This metric monitors secret rotation Lambda function duration"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.secret_rotation.function_name
  }

  tags = {
    Name        = "daylight-secret-rotation-duration"
    Environment = var.environment
    Service     = "daylight"
  }
}

# SSM parameters for non-sensitive configuration
resource "aws_ssm_parameter" "secrets_config" {
  name  = "/daylight/${var.environment}/secrets/config"
  type  = "String"
  value = jsonencode({
    kmsKeyId             = aws_kms_key.secrets_key.key_id
    rotationEnabled      = var.enable_secret_rotation
    rotationIntervalDays = 30
    environment          = var.environment
    backupRegion         = var.backup_region
  })

  tags = {
    Name        = "daylight-secrets-config"
    Environment = var.environment
    Service     = "daylight"
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Variables for enhanced secrets management
variable "enable_secret_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = false
}

variable "backup_region" {
  description = "Backup region for secret replication"
  type        = string
  default     = "us-east-1"
}

variable "mapbox_api_key" {
  description = "Mapbox API key (will be stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "google_maps_api_key" {
  description = "Google Maps API key (will be stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "events_api_token" {
  description = "Events API token (will be stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "traffic_api_token" {
  description = "Traffic API token (will be stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "database_username" {
  description = "Database username"
  type        = string
  default     = "daylight-app"
}

variable "database_password" {
  description = "Database password (will be stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

# Outputs
output "secrets_kms_key_id" {
  description = "KMS key ID for secrets encryption"
  value       = aws_kms_key.secrets_key.key_id
}

output "secrets_kms_key_arn" {
  description = "KMS key ARN for secrets encryption"
  value       = aws_kms_key.secrets_key.arn
}

output "mapbox_secret_arn" {
  description = "ARN of the Mapbox API key secret"
  value       = aws_secretsmanager_secret.mapbox_api_key.arn
}

output "google_maps_secret_arn" {
  description = "ARN of the Google Maps API key secret"
  value       = aws_secretsmanager_secret.google_maps_api_key.arn
}

output "events_api_secret_arn" {
  description = "ARN of the Events API token secret"
  value       = aws_secretsmanager_secret.events_api_token.arn
}

output "traffic_api_secret_arn" {
  description = "ARN of the Traffic API token secret"
  value       = aws_secretsmanager_secret.traffic_api_token.arn
}

output "database_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.database_credentials.arn
}

output "secret_rotation_lambda_arn" {
  description = "ARN of the secret rotation Lambda function"
  value       = aws_lambda_function.secret_rotation.arn
}
