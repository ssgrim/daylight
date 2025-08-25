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
  # SPA routing: serve index.html for 404s
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
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

  # Enable point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  # Enable server-side encryption at rest
  server_side_encryption {
    enabled = true
  }

  # Enable deletion protection (disable for dev environments)
  deletion_protection_enabled = var.enable_deletion_protection

  tags = {
    Name        = "daylight-trips-${var.env}"
    Environment = var.env
    Backup      = "enabled"
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
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = var.allowed_origins
    max_age       = 86400
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

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  
  default_route_settings {
    throttling_rate_limit  = var.api_rate_limit
    throttling_burst_limit = var.api_burst_limit
  }
  
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      error          = "$context.error.message"
      integrationError = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/daylight_${random_pet.suffix.id}"
  retention_in_days = 14
}

# --- CloudWatch Monitoring & Alerting ---

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "plan_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.plan.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "trips_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.trips.function_name}"
  retention_in_days = 14
}

# SNS Topic for alerts (optional - only create if email provided)
resource "aws_sns_topic" "alerts" {
  count = var.alert_email != "" ? 1 : 0
  name  = "daylight-alerts-${random_pet.suffix.id}"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Lambda Error Rate Alarms
resource "aws_cloudwatch_metric_alarm" "plan_lambda_errors" {
  count               = var.alert_email != "" ? 1 : 0
  alarm_name          = "daylight-plan-lambda-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors plan lambda errors"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.plan.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "trips_lambda_errors" {
  count               = var.alert_email != "" ? 1 : 0
  alarm_name          = "daylight-trips-lambda-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors trips lambda errors"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.trips.function_name
  }
}

# Lambda Duration Alarms
resource "aws_cloudwatch_metric_alarm" "plan_lambda_duration" {
  count               = var.alert_email != "" ? 1 : 0
  alarm_name          = "daylight-plan-lambda-duration-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "25000"  # 25 seconds
  alarm_description   = "This metric monitors plan lambda duration"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.plan.function_name
  }
}

# API Gateway 4XX/5XX Error Alarms
resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  count               = var.alert_email != "" ? 1 : 0
  alarm_name          = "daylight-api-4xx-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "20"
  alarm_description   = "This metric monitors API Gateway 4XX errors"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ApiName = aws_apigatewayv2_api.api.name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  count               = var.alert_email != "" ? 1 : 0
  alarm_name          = "daylight-api-5xx-errors-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors API Gateway 5XX errors"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ApiName = aws_apigatewayv2_api.api.name
  }
}

# DynamoDB Throttle Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  count               = var.alert_email != "" ? 1 : 0
  alarm_name          = "daylight-dynamodb-throttles-${random_pet.suffix.id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserRequestThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB throttle events"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    TableName = aws_dynamodb_table.trips.name
  }
}

# --- Outputs ---
output "frontend_bucket" { value = aws_s3_bucket.frontend.bucket }
output "cdn_domain"      { value = aws_cloudfront_distribution.cdn.domain_name }
output "api_base_url"    { value = aws_apigatewayv2_api.api.api_endpoint }
