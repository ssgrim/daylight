# Lambda + API Gateway Module
# This module creates Lambda functions with API Gateway HTTP API integration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for Lambda execution role policy
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

# IAM role for Lambda functions
resource "aws_iam_role" "lambda_execution_role" {
  name_prefix        = "${var.project_name}-lambda-${var.environment}-"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Name        = "${var.project_name}-lambda-execution-role-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# Basic Lambda execution policy attachment
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for DynamoDB access
resource "aws_iam_policy" "lambda_dynamodb_policy" {
  count       = var.dynamodb_table_arn != null ? 1 : 0
  name_prefix = "${var.project_name}-lambda-dynamodb-${var.environment}-"
  description = "IAM policy for Lambda functions to access DynamoDB"

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
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-dynamodb-policy-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# Attach DynamoDB policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  count      = var.dynamodb_table_arn != null ? 1 : 0
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_policy[0].arn
}

# Custom policy for external API access (Google Places, etc.)
resource "aws_iam_policy" "lambda_external_api_policy" {
  count       = var.enable_external_api_access ? 1 : 0
  name_prefix = "${var.project_name}-lambda-external-api-${var.environment}-"
  description = "IAM policy for Lambda functions to access external APIs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/${var.environment}/*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-external-api-policy-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# Attach external API policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_external_api" {
  count      = var.enable_external_api_access ? 1 : 0
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_external_api_policy[0].arn
}

# Lambda functions
resource "aws_lambda_function" "functions" {
  for_each = var.lambda_functions

  function_name    = "${var.project_name}-${each.key}-${var.environment}"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = each.value.handler
  runtime         = var.lambda_runtime
  timeout         = each.value.timeout
  memory_size     = each.value.memory_size
  
  filename         = each.value.zip_file
  source_code_hash = filebase64sha256(each.value.zip_file)

  environment {
    variables = merge(
      var.environment_variables,
      each.value.environment_variables,
      var.dynamodb_table_name != null ? {
        DYNAMODB_TABLE_NAME = var.dynamodb_table_name
      } : {},
      var.sentry_dsn != null ? {
        SENTRY_DSN = var.sentry_dsn
        SENTRY_RELEASE = var.git_sha != null ? "${var.project_name}@${var.git_sha}" : "${var.project_name}@${var.environment}"
      } : {}
    )
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.lambda_logs
  ]

  tags = {
    Name        = "${var.project_name}-${each.key}-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
    Function    = each.key
  }
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = var.lambda_functions

  name              = "/aws/lambda/${var.project_name}-${each.key}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-${each.key}-logs-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
    Function    = each.key
  }
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
  description   = "HTTP API for ${var.project_name} ${var.environment} environment"

  cors_configuration {
    allow_credentials = var.cors_configuration.allow_credentials
    allow_headers     = var.cors_configuration.allow_headers
    allow_methods     = var.cors_configuration.allow_methods
    allow_origins     = var.cors_configuration.allow_origins
    expose_headers    = var.cors_configuration.expose_headers
    max_age          = var.cors_configuration.max_age
  }

  tags = {
    Name        = "${var.project_name}-api-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# API Gateway integrations
resource "aws_apigatewayv2_integration" "lambda_integrations" {
  for_each = var.api_routes

  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions[each.value.function_name].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = each.value.timeout_milliseconds

  description = "Integration for ${each.value.function_name} function"
}

# API Gateway routes
resource "aws_apigatewayv2_route" "api_routes" {
  for_each = var.api_routes

  api_id    = aws_apigatewayv2_api.api.id
  route_key = "${each.value.method} ${each.value.path}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integrations[each.key].id}"

  authorization_type = each.value.authorization_type
  authorizer_id     = each.value.authorizer_id
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "api_gateway_invoke" {
  for_each = var.api_routes

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.value.function_name].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# API Gateway stage
resource "aws_apigatewayv2_stage" "api_stage" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.api_stage_name
  auto_deploy = var.api_auto_deploy

  default_route_settings {
    throttling_burst_limit   = var.throttling_burst_limit
    throttling_rate_limit    = var.throttling_rate_limit
    detailed_metrics_enabled = var.detailed_metrics_enabled
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip            = "$context.identity.sourceIp"
      requestTime   = "$context.requestTime"
      httpMethod    = "$context.httpMethod"
      routeKey      = "$context.routeKey"
      status        = "$context.status"
      protocol      = "$context.protocol"
      responseLength = "$context.responseLength"
      responseTime  = "$context.responseTime"
      error         = "$context.error.message"
      errorDetails  = "$context.error.messageString"
    })
  }

  tags = {
    Name        = "${var.project_name}-api-stage-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${var.project_name}-api-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-api-logs-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# Data sources for current AWS context
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# AWS WAF Web ACL for API protection (optional)
resource "aws_wafv2_web_acl" "api_protection" {
  count = var.enable_waf ? 1 : 0

  name        = "${var.project_name}-api-protection-${var.environment}"
  description = "WAF rules for API Gateway protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule per IP
  rule {
    name     = "RateLimitPerIP"
    priority = 1

    action {
      dynamic "block" {
        for_each = var.waf_rate_limit_action == "BLOCK" ? [1] : []
        content {}
      }
      dynamic "count" {
        for_each = var.waf_rate_limit_action == "COUNT" ? [1] : []
        content {}
      }
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}_RateLimitPerIP_${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}_CommonRuleSet_${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}_KnownBadInputs_${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Anonymous IP List
  rule {
    name     = "AWSManagedRulesAnonymousIpList"
    priority = 4

    override_action {
      count {}  # Count mode for anonymous IPs (less aggressive)
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}_AnonymousIpList_${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  tags = {
    Name        = "${var.project_name}-api-protection-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# Associate WAF Web ACL with API Gateway
resource "aws_wafv2_web_acl_association" "api_gateway" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_apigatewayv2_stage.api_stage.arn
  web_acl_arn  = aws_wafv2_web_acl.api_protection[0].arn
}

# CloudWatch Log Group for WAF
resource "aws_cloudwatch_log_group" "waf_logs" {
  count = var.enable_waf ? 1 : 0

  name              = "/aws/wafv2/${var.project_name}-api-protection-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-waf-logs-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "api_protection" {
  count = var.enable_waf ? 1 : 0

  resource_arn            = aws_wafv2_web_acl.api_protection[0].arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs[0].arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# CloudWatch alarms for API Gateway 5xx errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  count = var.enable_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-api-5xx-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_rate_evaluation_periods
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGatewayV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors 5xx errors for API Gateway"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ApiId = aws_apigatewayv2_api.api.id
    Stage = aws_apigatewayv2_stage.api_stage.name
  }

  tags = {
    Name        = "${var.project_name}-api-5xx-errors-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
  }
}

# CloudWatch alarms for Lambda function errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.enable_cloudwatch_alarms ? var.lambda_functions : {}

  alarm_name          = "${var.project_name}-lambda-${each.key}-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_rate_evaluation_periods
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors errors for Lambda function ${each.key}"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = {
    Name        = "${var.project_name}-lambda-${each.key}-errors-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
    Function    = each.key
  }
}

# CloudWatch alarms for Lambda function duration
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = var.enable_cloudwatch_alarms ? var.lambda_functions : {}

  alarm_name          = "${var.project_name}-lambda-${each.key}-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_rate_evaluation_periods
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = each.value.timeout * 1000 * 0.8  # 80% of timeout
  alarm_description   = "This metric monitors duration for Lambda function ${each.key}"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = {
    Name        = "${var.project_name}-lambda-${each.key}-duration-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
    Function    = each.key
  }
}

# CloudWatch Log Metric Filters for Error Tracking
resource "aws_cloudwatch_log_metric_filter" "lambda_error_count" {
  for_each = var.enable_cloudwatch_alarms ? var.lambda_functions : {}

  name           = "${var.project_name}-lambda-${each.key}-error-count-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs[each.key].name
  
  pattern = "[timestamp, requestId, \"ERROR\"] | [timestamp, requestId, \"Exception\"] | [timestamp, requestId, \"error\"]"
  
  metric_transformation {
    name      = "${var.project_name}_lambda_${each.key}_error_count"
    namespace = "Daylight/Lambda"
    value     = "1"
    
    default_value = 0
  }
}

# CloudWatch Log Metric Filters for P95 Latency
resource "aws_cloudwatch_log_metric_filter" "lambda_latency_p95" {
  for_each = var.enable_cloudwatch_alarms ? var.lambda_functions : {}

  name           = "${var.project_name}-lambda-${each.key}-latency-p95-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs[each.key].name
  
  # Pattern to extract duration from Lambda REPORT lines
  pattern = "[timestamp, requestId, \"REPORT\", requestDuration=\"Duration:\", duration, durationUnit=\"ms\", ...]"
  
  metric_transformation {
    name      = "${var.project_name}_lambda_${each.key}_duration_ms"
    namespace = "Daylight/Lambda"
    value     = "$duration"
    
    default_value = 0
  }
}

# CloudWatch Alarms for Custom Error Count Metrics
resource "aws_cloudwatch_metric_alarm" "lambda_custom_error_count" {
  for_each = var.enable_cloudwatch_alarms ? var.lambda_functions : {}

  alarm_name          = "${var.project_name}-lambda-${each.key}-custom-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_rate_evaluation_periods
  metric_name         = "${var.project_name}_lambda_${each.key}_error_count"
  namespace           = "Daylight/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "Custom error count for Lambda function ${each.key} based on log analysis"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Name        = "${var.project_name}-lambda-${each.key}-custom-errors-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
    Function    = each.key
  }
}

# CloudWatch Alarms for P95 Latency
resource "aws_cloudwatch_metric_alarm" "lambda_latency_p95" {
  for_each = var.enable_cloudwatch_alarms ? var.lambda_functions : {}

  alarm_name          = "${var.project_name}-lambda-${each.key}-latency-p95-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_rate_evaluation_periods
  metric_name         = "${var.project_name}_lambda_${each.key}_duration_ms"
  namespace           = "Daylight/Lambda"
  period              = "300"
  statistic           = "Average"  # Using average as a proxy for P95 in this simple setup
  threshold           = each.value.timeout * 1000 * 0.6  # 60% of timeout as P95 threshold
  alarm_description   = "P95 latency alarm for Lambda function ${each.key}"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Name        = "${var.project_name}-lambda-${each.key}-latency-p95-${var.environment}"
    Environment = var.environment
    Module      = "lambda-api"
    Function    = each.key
  }
}
