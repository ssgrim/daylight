# Daylight Infrastructure - Modular Configuration
# This file orchestrates all infrastructure modules

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Optional: Configure remote state
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "daylight/terraform.tfstate"
  #   region = "us-west-1"
  # }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region

  # Optional: Default tags for all resources
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

# Random suffix for unique resource names
resource "random_pet" "suffix" {
  length = 2
}

# Local values for common configurations
locals {
  # Common naming convention
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Common tags
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }

  # API Gateway domain for CloudFront integration
  api_gateway_domain = replace(module.api.api_endpoint, "https://", "")
}

# Database Module
module "database" {
  source = "./modules/database"

  project_name = var.project_name
  environment  = var.environment

  # DynamoDB configuration
  billing_mode = var.database_config.billing_mode
  
  trips_table = var.database_config.trips_table
  
  enable_cache_table = var.database_config.enable_cache_table
  cache_table        = var.database_config.cache_table
  
  enable_point_in_time_recovery       = var.database_config.enable_point_in_time_recovery
  enable_cache_point_in_time_recovery = var.database_config.enable_cache_point_in_time_recovery
  
  encryption_configuration = var.database_config.encryption_configuration
  enable_cloudwatch_alarms = var.database_config.enable_cloudwatch_alarms
  alarm_sns_topic_arn     = var.alarm_sns_topic_arn
}

# Lambda + API Gateway Module
module "api" {
  source = "./modules/lambda-api"

  project_name = var.project_name
  environment  = var.environment

  # Lambda configuration
  lambda_runtime    = var.api_config.lambda_runtime
  lambda_functions  = var.api_config.lambda_functions
  api_routes       = var.api_config.api_routes
  
  # Environment variables for all Lambda functions
  environment_variables = merge(
    var.api_config.environment_variables,
    {
      TABLE_TRIPS = module.database.trips_table_name
    },
    var.database_config.enable_cache_table ? {
      TABLE_CACHE = module.database.cache_table_name
    } : {}
  )

  # DynamoDB access
  dynamodb_table_arn  = module.database.trips_table_arn
  dynamodb_table_name = module.database.trips_table_name
  
  # External API access (for Google Places, etc.)
  enable_external_api_access = var.api_config.enable_external_api_access
  
  # CORS configuration
  cors_configuration = var.api_config.cors_configuration
  
  # API Gateway settings
  api_stage_name           = var.api_config.api_stage_name
  api_auto_deploy          = var.api_config.api_auto_deploy
  throttling_burst_limit   = var.api_config.throttling_burst_limit
  throttling_rate_limit    = var.api_config.throttling_rate_limit
  detailed_metrics_enabled = var.api_config.detailed_metrics_enabled
  
  log_retention_days = var.log_retention_days
  
  # CloudWatch alarms
  enable_cloudwatch_alarms = var.api_config.enable_cloudwatch_alarms
  alarm_sns_topic_arn     = var.create_alarm_topic ? aws_sns_topic.alarms[0].arn : var.alarm_sns_topic_arn
  error_rate_threshold    = var.api_config.error_rate_threshold
  
  # Error tracking
  sentry_dsn = var.sentry_dsn
  git_sha    = var.git_sha
  
  # API Protection
  enable_waf           = var.enable_waf
  waf_rate_limit       = var.waf_rate_limit
  waf_rate_limit_action = var.waf_rate_limit_action
}

# Frontend Module
module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment

  # S3 configuration
  bucket_name       = var.frontend_config.bucket_name
  force_destroy     = var.frontend_config.force_destroy
  enable_versioning = var.frontend_config.enable_versioning
  
  encryption_configuration = var.frontend_config.encryption_configuration
  
  # CloudFront configuration
  enable_ipv6          = var.frontend_config.enable_ipv6
  default_root_object  = var.frontend_config.default_root_object
  price_class          = var.frontend_config.price_class
  
  # API Gateway integration for /api/* routes
  api_gateway_domain = local.api_gateway_domain
  
  # Cache behaviors
  cache_behaviors = var.frontend_config.cache_behaviors
  
  # SSL and security
  ssl_certificate        = var.frontend_config.ssl_certificate
  geo_restriction        = var.frontend_config.geo_restriction
  custom_error_responses = var.frontend_config.custom_error_responses
  
  # WAF integration
  web_acl_id = var.frontend_config.web_acl_id
  
  # Logging
  enable_cloudfront_logs = var.frontend_config.enable_cloudfront_logs
  log_retention_days     = var.log_retention_days
}

# Secrets Manager for external API keys (optional)
resource "aws_secretsmanager_secret" "api_keys" {
  count = var.create_secrets_manager ? 1 : 0

  name        = "${local.name_prefix}-api-keys"
  description = "API keys for external services (Google Places, etc.)"
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  count = var.create_secrets_manager ? 1 : 0

  secret_id = aws_secretsmanager_secret.api_keys[0].id
  secret_string = jsonencode({
    google_places_api_key = var.google_places_api_key
    mapbox_access_token   = var.mapbox_access_token
  })
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "application" {
  count = var.create_application_log_group ? 1 : 0

  name              = "/aws/application/${local.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# SNS Topic for alarms (optional)
resource "aws_sns_topic" "alarms" {
  count = var.create_alarm_topic ? 1 : 0

  name = "${local.name_prefix}-alarms"
  
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "alarm_email" {
  count = var.create_alarm_topic && var.alarm_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Slack integration for alarms
resource "aws_sns_topic_subscription" "alarm_slack" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# Lambda function for Slack notifications (if webhook URL provided)
data "archive_file" "slack_notifier" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/slack-notifier.zip"
  
  source {
    content = <<EOF
const https = require('https');
const url = require('url');

exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  const slackMessage = {
    text: `🚨 *$${message.AlarmName}*`,
    attachments: [{
      color: message.NewStateValue === 'ALARM' ? 'danger' : 'good',
      fields: [
        { title: 'State', value: message.NewStateValue, short: true },
        { title: 'Reason', value: message.NewStateReason, short: true },
        { title: 'Timestamp', value: message.StateChangeTime, short: true },
        { title: 'Region', value: message.Region, short: true }
      ]
    }]
  };
  
  const urlObj = url.parse(slackWebhookUrl);
  const postData = JSON.stringify(slackMessage);
  
  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      resolve({ statusCode: res.statusCode });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
};
EOF
    filename = "index.js"
  }
}

resource "aws_lambda_function" "slack_notifier" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  function_name = "${local.name_prefix}-slack-notifier"
  role         = aws_iam_role.slack_notifier[0].arn
  handler      = "index.handler"
  runtime      = "nodejs20.x"
  timeout      = 30

  filename         = data.archive_file.slack_notifier[0].output_path
  source_code_hash = data.archive_file.slack_notifier[0].output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }

  tags = local.common_tags
}

# IAM role for Slack notifier Lambda
resource "aws_iam_role" "slack_notifier" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  name_prefix = "${local.name_prefix}-slack-notifier-"
  
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

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "slack_notifier_basic" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  role       = aws_iam_role.slack_notifier[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SNS topic subscription for Lambda
resource "aws_sns_topic_subscription" "slack_lambda" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier[0].arn
}

# Permission for SNS to invoke Lambda
resource "aws_lambda_permission" "sns_slack" {
  count = var.create_alarm_topic && var.slack_webhook_url != null ? 1 : 0

  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alarms[0].arn
}
