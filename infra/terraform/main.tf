terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws",    version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

provider "aws" {
  region = var.region
}

resource "random_pet" "suffix" {
  length = 2
}

# --- S3 + CloudFront for SPA ---
resource "aws_s3_bucket" "frontend" {
  # include region to avoid cross-region conflicts
  bucket        = "daylight-frontend-${var.region}-${random_pet.suffix.id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "daylight-oac-${random_pet.suffix.id}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "AllowCloudFrontRead",
      Effect    = "Allow",
      Principal = { Service = "cloudfront.amazonaws.com" },
      Action    = ["s3:GetObject"],
      Resource  = ["${aws_s3_bucket.frontend.arn}/*"],
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn } }
    }]
  })
}

# --- DynamoDB (trips) ---
resource "aws_dynamodb_table" "trips" {
  name         = "daylight_trips_${random_pet.suffix.id}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tripId"

  attribute {
    name = "tripId"
    type = "S"
  }
}

# --- Lambda IAM role & policy ---
data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "daylight_lambda_${random_pet.suffix.id}"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamo_rw" {
  name = "daylight_dynamo_rw_${random_pet.suffix.id}"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "dynamodb:PutItem","dynamodb:GetItem","dynamodb:UpdateItem",
        "dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan"
      ],
      Resource = aws_dynamodb_table.trips.arn
    }]
  })
}

# Path to built Lambda zips
variable "backend_zip_dir" {
  description = "Path to backend/dist with Lambda zip artifacts"
  type        = string
  default     = "../../backend/dist"
}

# --- Lambdas ---
resource "aws_lambda_function" "trips" {
  function_name    = "daylight_trips_${random_pet.suffix.id}"
  role             = aws_iam_role.lambda.arn
  handler          = "trips.handler"
  runtime          = "nodejs20.x"
  filename         = "${var.backend_zip_dir}/trips.zip"
  source_code_hash = filebase64sha256("${var.backend_zip_dir}/trips.zip")
  environment { variables = { TABLE_TRIPS = aws_dynamodb_table.trips.name } }
}

resource "aws_lambda_function" "plan" {
  function_name    = "daylight_plan_${random_pet.suffix.id}"
  role             = aws_iam_role.lambda.arn
  handler          = "plan.handler"
  runtime          = "nodejs20.x"
  filename         = "${var.backend_zip_dir}/plan.zip"
  source_code_hash = filebase64sha256("${var.backend_zip_dir}/plan.zip")
  environment {
    variables = {
      TABLE_TRIPS       = aws_dynamodb_table.trips.name
      GEOCODE_PROVIDER  = var.geocode_provider
      WEATHER_PROVIDER  = var.weather_provider
      MAPBOX_TOKEN      = var.mapbox_token
  GOOGLE_MAPS_KEY   = var.google_maps_key
  SEASON_MODE       = var.season_mode
      MAPBOX_SECRET_ARN = var.mapbox_secret_arn
      GOOGLE_MAPS_SECRET_ARN = var.google_maps_secret_arn
  EVENTS_SECRET_ARN = var.events_secret_arn
  TRAFFIC_SECRET_ARN = var.traffic_secret_arn
      EVENTS_SSM_PARAMETER = var.events_ssm_parameter
      TRAFFIC_SSM_PARAMETER = var.traffic_ssm_parameter
    }
  }
}

resource "aws_lambda_function" "health" {
  function_name    = "daylight_health_${random_pet.suffix.id}"
  role             = aws_iam_role.lambda.arn
  handler          = "health.handler"
  runtime          = "nodejs20.x"
  filename         = "${var.backend_zip_dir}/health.zip"
  source_code_hash = filebase64sha256("${var.backend_zip_dir}/health.zip")
  timeout          = 30  # Health checks may take longer due to external API calls
  environment {
    variables = {
      TABLE_TRIPS       = aws_dynamodb_table.trips.name
      GEOCODE_PROVIDER  = var.geocode_provider
      WEATHER_PROVIDER  = var.weather_provider
      MAPBOX_TOKEN      = var.mapbox_token
      GOOGLE_MAPS_KEY   = var.google_maps_key
      MAPBOX_SECRET_ARN = var.mapbox_secret_arn
      GOOGLE_MAPS_SECRET_ARN = var.google_maps_secret_arn
      EVENTS_SECRET_ARN = var.events_secret_arn
      TRAFFIC_SECRET_ARN = var.traffic_secret_arn
      EVENTS_SSM_PARAMETER = var.events_ssm_parameter
      TRAFFIC_SSM_PARAMETER = var.traffic_ssm_parameter
      APP_VERSION       = var.app_version
      NODE_ENV          = var.environment_name
    }
  }
}

// Optionally create secrets from plaintext variables (useful for quick dev only)
resource "aws_secretsmanager_secret" "mapbox_token" {
  count = var.mapbox_token_value != "" ? 1 : 0
  name  = "daylight_mapbox_token_${random_pet.suffix.id}"
}
resource "aws_secretsmanager_secret_version" "mapbox_token_version" {
  count      = var.mapbox_token_value != "" ? 1 : 0
  secret_id  = aws_secretsmanager_secret.mapbox_token[0].id
  secret_string = var.mapbox_token_value
}
output "mapbox_secret_arn_created" {
  value = aws_secretsmanager_secret.mapbox_token.*.arn
}

resource "aws_secretsmanager_secret" "events_key" {
  count = var.events_api_key_value != "" ? 1 : 0
  name  = "daylight_events_key_${random_pet.suffix.id}"
}
resource "aws_secretsmanager_secret_version" "events_key_version" {
  count      = var.events_api_key_value != "" ? 1 : 0
  secret_id  = aws_secretsmanager_secret.events_key[0].id
  secret_string = var.events_api_key_value
}
output "events_secret_arn_created" {
  value = aws_secretsmanager_secret.events_key.*.arn
}

resource "aws_secretsmanager_secret" "traffic_key" {
  count = var.traffic_api_key_value != "" ? 1 : 0
  name  = "daylight_traffic_key_${random_pet.suffix.id}"
}
resource "aws_secretsmanager_secret_version" "traffic_key_version" {
  count      = var.traffic_api_key_value != "" ? 1 : 0
  secret_id  = aws_secretsmanager_secret.traffic_key[0].id
  secret_string = var.traffic_api_key_value
}
output "traffic_secret_arn_created" {
  value = aws_secretsmanager_secret.traffic_key.*.arn
}

// If secret ARNs are provided, give the lambda permission to read them
resource "aws_iam_policy" "lambda_read_secrets" {
  count = (var.mapbox_secret_arn != "" || var.google_maps_secret_arn != "") ? 1 : 0
  name  = "daylight_lambda_read_secrets_${random_pet.suffix.id}"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["secretsmanager:GetSecretValue","ssm:GetParameter","ssm:GetParameters"],
        Resource = compact([var.mapbox_secret_arn, var.google_maps_secret_arn])
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_read_secrets_attach" {
  count      = aws_iam_policy.lambda_read_secrets.*.id == [] ? 0 : 1
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_read_secrets[0].arn
}

locals {
  mapbox_token     = var.mapbox_token
  geocode_provider = var.geocode_provider
  weather_provider = var.weather_provider
}

/* provider environment variables are wired into the plan lambda above via environment.variables */

# --- API Gateway (HTTP API) ---
resource "aws_apigatewayv2_api" "api" {
  name          = "daylight_api_${random_pet.suffix.id}"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = ["*"]
    allow_methods = ["GET","POST","OPTIONS"]
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "plan" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.plan.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_plan" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /plan"
  target    = "integrations/${aws_apigatewayv2_integration.plan.id}"
}

resource "aws_lambda_permission" "allow_apigw_plan" {
  statement_id  = "AllowAPIGatewayInvokePlan"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.plan.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/plan"
}

resource "aws_apigatewayv2_integration" "trips" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.trips.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_trips" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /trips"
  target    = "integrations/${aws_apigatewayv2_integration.trips.id}"
}

resource "aws_lambda_permission" "allow_apigw_trips" {
  statement_id  = "AllowAPIGatewayInvokeTrips"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.trips.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/trips"
}

# Health check endpoint
resource "aws_apigatewayv2_integration" "health" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.health.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_health" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.health.id}"
}

resource "aws_lambda_permission" "allow_apigw_health" {
  statement_id  = "AllowAPIGatewayInvokeHealth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/health"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# --- CloudWatch Monitoring & Alerting ---

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "daylight-alerts-${random_pet.suffix.id}"
  
  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# SNS Topic subscription (email)
resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Log Groups with retention
resource "aws_cloudwatch_log_group" "lambda_health" {
  name              = "/aws/lambda/${aws_lambda_function.health.function_name}"
  retention_in_days = var.log_retention_days
  
  tags = {
    Environment = var.environment_name
    Service     = "daylight"
    Function    = "health"
  }
}

resource "aws_cloudwatch_log_group" "lambda_plan" {
  name              = "/aws/lambda/${aws_lambda_function.plan.function_name}"
  retention_in_days = var.log_retention_days
  
  tags = {
    Environment = var.environment_name
    Service     = "daylight"
    Function    = "plan"
  }
}

resource "aws_cloudwatch_log_group" "lambda_trips" {
  name              = "/aws/lambda/${aws_lambda_function.trips.function_name}"
  retention_in_days = var.log_retention_days
  
  tags = {
    Environment = var.environment_name
    Service     = "daylight"
    Function    = "trips"
  }
}

# Health Check CloudWatch Alarms

# Lambda Health Function Errors
resource "aws_cloudwatch_metric_alarm" "health_function_errors" {
  alarm_name          = "daylight-health-function-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Health check function errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.health.function_name
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# Health Check Response Time
resource "aws_cloudwatch_metric_alarm" "health_function_duration" {
  alarm_name          = "daylight-health-function-duration-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Average"
  threshold           = "15000"  # 15 seconds
  alarm_description   = "Health check function taking too long"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.health.function_name
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# Plan Function Errors
resource "aws_cloudwatch_metric_alarm" "plan_function_errors" {
  alarm_name          = "daylight-plan-function-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Plan function errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.plan.function_name
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# Plan Function High Duration
resource "aws_cloudwatch_metric_alarm" "plan_function_duration" {
  alarm_name          = "daylight-plan-function-duration-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "8000"  # 8 seconds
  alarm_description   = "Plan function taking too long"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.plan.function_name
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# API Gateway 4XX Errors
resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "daylight-api-4xx-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGatewayV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High rate of API Gateway 4XX errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.api.id
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "daylight-api-5xx-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGatewayV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "API Gateway 5XX errors detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.api.id
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# DynamoDB Throttled Requests
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "daylight-dynamodb-throttles-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "DynamoDB throttling detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.trips.name
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# DynamoDB High Read Latency
resource "aws_cloudwatch_metric_alarm" "dynamodb_read_latency" {
  alarm_name          = "daylight-dynamodb-read-latency-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SuccessfulRequestLatency"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Average"
  threshold           = "100"  # 100ms
  alarm_description   = "DynamoDB read latency is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.trips.name
    Operation = "GetItem"
  }

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

# Synthetic Health Check (EventBridge + Lambda)
resource "aws_cloudwatch_event_rule" "health_check_schedule" {
  name                = "daylight-health-check-${random_pet.suffix.id}"
  description         = "Scheduled health check"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Environment = var.environment_name
    Service     = "daylight"
  }
}

resource "aws_cloudwatch_event_target" "health_check_target" {
  rule      = aws_cloudwatch_event_rule.health_check_schedule.name
  target_id = "HealthCheckTarget"
  arn       = aws_lambda_function.health.arn

  input = jsonencode({
    queryStringParameters = {
      level = "full"
      source = "scheduled"
    }
  })
}

resource "aws_lambda_permission" "allow_eventbridge_health" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.health_check_schedule.arn
}

# Custom CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "daylight-monitoring-${random_pet.suffix.id}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.health.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."],
            [".", "Invocations", "FunctionName", aws_lambda_function.plan.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."],
            [".", "Invocations", "FunctionName", aws_lambda_function.trips.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "Lambda Functions Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApiGatewayV2", "Count", "ApiId", aws_apigatewayv2_api.api.id],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."],
            [".", "IntegrationLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "API Gateway Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.trips.name],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "SuccessfulRequestLatency", ".", ".", "Operation", "GetItem"],
            [".", "SuccessfulRequestLatency", ".", ".", "Operation", "PutItem"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "DynamoDB Performance"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 18
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/lambda/${aws_lambda_function.health.function_name}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
          region  = var.region
          title   = "Recent Health Check Errors"
        }
      }
    ]
  })
}

# --- Outputs ---
output "frontend_bucket" { value = aws_s3_bucket.frontend.bucket }
output "cdn_domain"      { value = aws_cloudfront_distribution.cdn.domain_name }
output "api_base_url"    { value = aws_apigatewayv2_api.api.api_endpoint }
output "health_endpoint" { value = "${aws_apigatewayv2_api.api.api_endpoint}/health" }
output "dashboard_url"   { value = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}" }
output "sns_topic_arn"   { value = aws_sns_topic.alerts.arn }
