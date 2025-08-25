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
}

# --- Outputs ---
output "frontend_bucket" { value = aws_s3_bucket.frontend.bucket }
output "cdn_domain"      { value = aws_cloudfront_distribution.cdn.domain_name }
output "api_base_url"    { value = aws_apigatewayv2_api.api.api_endpoint }
