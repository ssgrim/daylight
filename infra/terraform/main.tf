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
  price_class         = var.cloudfront_price_class

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  # Add API Gateway as second origin for API caching
  origin {
    domain_name = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
    origin_id   = "api-gateway"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior for SPA assets
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.spa_cache_policy.id

    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # Cache behavior for API endpoints (short TTL for dynamic content)
  ordered_cache_behavior {
    path_pattern           = "/plan"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "api-gateway"
    viewer_protocol_policy = "https-only"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.api_cache_policy.id

    # Forward headers needed for CORS
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api_origin_request.id
  }

  ordered_cache_behavior {
    path_pattern           = "/trips"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "api-gateway"
    viewer_protocol_policy = "https-only"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.api_cache_policy.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api_origin_request.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "daylight-cdn"
    Environment = var.stage
    Project     = "daylight"
  }
}

# Cache Policy for SPA (long TTL for static assets)
resource "aws_cloudfront_cache_policy" "spa_cache_policy" {
  name        = "daylight-spa-cache-${random_pet.suffix.id}"
  comment     = "Cache policy for SPA static assets"
  default_ttl = var.cloudfront_default_ttl
  max_ttl     = var.cloudfront_max_ttl
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# Cache Policy for API (short TTL for dynamic content)
resource "aws_cloudfront_cache_policy" "api_cache_policy" {
  name        = "daylight-api-cache-${random_pet.suffix.id}"
  comment     = "Cache policy for API endpoints"
  default_ttl = var.api_cache_default_ttl
  max_ttl     = var.api_cache_max_ttl
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "all"
    }

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "Content-Type", "x-api-key"]
      }
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# Origin Request Policy for API
resource "aws_cloudfront_origin_request_policy" "api_origin_request" {
  name    = "daylight-api-origin-${random_pet.suffix.id}"
  comment = "Origin request policy for API Gateway"

  cookies_config {
    cookie_behavior = "none"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Accept",
        "Accept-Language",
        "Authorization",
        "Content-Type",
        "Origin",
        "Referer",
        "User-Agent",
        "x-api-key"
      ]
    }
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# Security Headers Policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "daylight-security-headers-${random_pet.suffix.id}"
  comment = "Security headers for Daylight application"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
    }
  }

  custom_headers_config {
    items {
      header   = "X-Content-Security-Policy"
      value    = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.mapbox.com https://events.mapbox.com"
      override = true
    }
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
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "tripId"

  # Only configure read/write capacity for PROVISIONED mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "tripId"
    type = "S"
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.dynamodb_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "daylight-trips-table"
    Environment = var.stage
    Project     = "daylight"
  }
}

# DynamoDB Auto Scaling (only for PROVISIONED billing mode)
resource "aws_appautoscaling_target" "dynamodb_read_target" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_dynamodb_autoscaling ? 1 : 0
  max_capacity       = var.dynamodb_autoscaling_max_read_capacity
  min_capacity       = var.dynamodb_read_capacity
  resource_id        = "table/${aws_dynamodb_table.trips.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "dynamodb_read_policy" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_dynamodb_autoscaling ? 1 : 0
  name               = "DynamoDBReadCapacityUtilization:${aws_appautoscaling_target.dynamodb_read_target[0].resource_id}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value       = var.dynamodb_autoscaling_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }
}

resource "aws_appautoscaling_target" "dynamodb_write_target" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_dynamodb_autoscaling ? 1 : 0
  max_capacity       = var.dynamodb_autoscaling_max_write_capacity
  min_capacity       = var.dynamodb_write_capacity
  resource_id        = "table/${aws_dynamodb_table.trips.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "dynamodb_write_policy" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_dynamodb_autoscaling ? 1 : 0
  name               = "DynamoDBWriteCapacityUtilization:${aws_appautoscaling_target.dynamodb_write_target[0].resource_id}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_write_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_write_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_write_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value       = var.dynamodb_autoscaling_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
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
  timeout          = 30
  memory_size      = 512
  reserved_concurrent_executions = var.lambda_reserved_concurrency
  environment { variables = { TABLE_TRIPS = aws_dynamodb_table.trips.name } }

  tags = {
    Name        = "daylight-trips-lambda"
    Environment = var.stage
    Project     = "daylight"
  }
}

resource "aws_lambda_function" "plan" {
  function_name    = "daylight_plan_${random_pet.suffix.id}"
  role             = aws_iam_role.lambda.arn
  handler          = "plan.handler"
  runtime          = "nodejs20.x"
  filename         = "${var.backend_zip_dir}/plan.zip"
  source_code_hash = filebase64sha256("${var.backend_zip_dir}/plan.zip")
  timeout          = 45
  memory_size      = 1024
  reserved_concurrent_executions = var.lambda_reserved_concurrency
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

  tags = {
    Name        = "daylight-plan-lambda"
    Environment = var.stage
    Project     = "daylight"
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

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # API Gateway throttling configuration
  throttle_config {
    rate_limit  = var.api_gateway_throttle_rate_limit
    burst_limit = var.api_gateway_throttle_burst_limit
  }

  # Access logging
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$requestId"
      requestTime    = "$requestTime"
      httpMethod     = "$httpMethod"
      routeKey       = "$routeKey"
      status         = "$status"
      error          = "$error"
      responseLength = "$responseLength"
      responseTime   = "$responseTime"
      ip             = "$ip"
      userAgent      = "$userAgent"
    })
  }

  tags = {
    Name        = "daylight-api-stage"
    Environment = var.stage
    Project     = "daylight"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/daylight_${random_pet.suffix.id}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name        = "daylight-api-logs"
    Environment = var.stage
    Project     = "daylight"
  }
}

# --- Outputs ---
output "frontend_bucket" { value = aws_s3_bucket.frontend.bucket }
output "cdn_domain"      { value = aws_cloudfront_distribution.cdn.domain_name }
output "api_base_url"    { value = aws_apigatewayv2_api.api.api_endpoint }

# --- CloudWatch Monitoring and Alarms ---

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "trips_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.trips.function_name}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name        = "daylight-trips-lambda-logs"
    Environment = var.stage
    Project     = "daylight"
  }
}

resource "aws_cloudwatch_log_group" "plan_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.plan.function_name}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name        = "daylight-plan-lambda-logs"
    Environment = var.stage
    Project     = "daylight"
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  count = var.enable_monitoring_alerts ? 1 : 0
  name  = "daylight-alerts-${random_pet.suffix.id}"

  tags = {
    Name        = "daylight-alerts"
    Environment = var.stage
    Project     = "daylight"
  }
}

# Lambda Error Rate Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate_trips" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-trips-lambda-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.lambda_error_rate_threshold
  alarm_description   = "This metric monitors trips lambda error rate"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.trips.function_name
  }

  tags = {
    Name        = "daylight-trips-error-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_error_rate_plan" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-plan-lambda-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.lambda_error_rate_threshold
  alarm_description   = "This metric monitors plan lambda error rate"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.plan.function_name
  }

  tags = {
    Name        = "daylight-plan-error-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

# Lambda Duration Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_duration_trips" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-trips-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = var.lambda_duration_threshold_trips
  alarm_description   = "This metric monitors trips lambda execution duration"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.trips.function_name
  }

  tags = {
    Name        = "daylight-trips-duration-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_plan" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-plan-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = var.lambda_duration_threshold_plan
  alarm_description   = "This metric monitors plan lambda execution duration"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    FunctionName = aws_lambda_function.plan.function_name
  }

  tags = {
    Name        = "daylight-plan-duration-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

# DynamoDB Throttling Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-dynamodb-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.dynamodb_throttle_threshold
  alarm_description   = "This metric monitors DynamoDB throttled requests"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    TableName = aws_dynamodb_table.trips.name
  }

  tags = {
    Name        = "daylight-dynamodb-throttle-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

# API Gateway 4XX Error Rate Alarm
resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx_errors" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.api_gateway_error_threshold
  alarm_description   = "This metric monitors API Gateway 4XX errors"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ApiName = aws_apigatewayv2_api.api.name
  }

  tags = {
    Name        = "daylight-api-4xx-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

# API Gateway 5XX Error Rate Alarm
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_errors" {
  count               = var.enable_monitoring_alerts ? 1 : 0
  alarm_name          = "daylight-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "This metric monitors API Gateway 5XX errors"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ApiName = aws_apigatewayv2_api.api.name
  }

  tags = {
    Name        = "daylight-api-5xx-alarm"
    Environment = var.stage
    Project     = "daylight"
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "daylight_dashboard" {
  count          = var.enable_monitoring_dashboard ? 1 : 0
  dashboard_name = "Daylight-${var.stage}-${random_pet.suffix.id}"

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
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.trips.function_name],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.plan.function_name],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."]
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
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.trips.name],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ThrottledRequests", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "DynamoDB Performance"
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
            ["AWS/ApiGateway", "Count", "ApiName", aws_apigatewayv2_api.api.name],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."],
            [".", "Latency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "API Gateway Performance"
          period  = 300
        }
      }
    ]
  })
}
