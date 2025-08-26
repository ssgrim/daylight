# OpenSearch cluster for search infrastructure
# Issue #112: Search Infrastructure & Geospatial Indexing

# OpenSearch Service Domain
resource "aws_opensearch_domain" "search" {
  domain_name    = "daylight-search-${random_pet.suffix.id}"
  engine_version = "OpenSearch_2.11"

  cluster_config {
    instance_type            = var.search_instance_type
    instance_count           = var.search_instance_count
    dedicated_master_enabled = var.search_instance_count > 2
    dedicated_master_type    = var.search_instance_count > 2 ? var.search_master_instance_type : null
    dedicated_master_count   = var.search_instance_count > 2 ? 3 : null
    zone_awareness_enabled   = var.search_instance_count > 1

    dynamic "zone_awareness_config" {
      for_each = var.search_instance_count > 1 ? [1] : []
      content {
        availability_zone_count = min(var.search_instance_count, 3)
      }
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.search_volume_size
    throughput  = 125
    iops        = 3000
  }

  # Enable encryption
  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  # Enhanced security options
  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = false
    master_user_options {
      master_user_arn = aws_iam_role.search_master.arn
    }
  }

  # VPC configuration for production security
  dynamic "vpc_options" {
    for_each = var.enable_vpc_search ? [1] : []
    content {
      subnet_ids         = [aws_subnet.search[0].id, aws_subnet.search[1].id]
      security_group_ids = [aws_security_group.search[0].id]
    }
  }

  # Access policy - restrict to our application
  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.lambda.arn,
            aws_iam_role.search_master.arn
          ]
        }
        Action   = ["es:*"]
        Resource = "arn:aws:es:${var.region}:*:domain/daylight-search-${random_pet.suffix.id}/*"
      }
    ]
  })

  # Enable logging
  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.search_index.arn
    log_type                 = "INDEX_SLOW_LOGS"
    enabled                  = true
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.search_search.arn
    log_type                 = "SEARCH_SLOW_LOGS"
    enabled                  = true
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.search_error.arn
    log_type                 = "ES_APPLICATION_LOGS"
    enabled                  = true
  }

  tags = {
    Domain    = "search"
    Component = "search-infrastructure"
    Issue     = "112"
  }

  depends_on = [
    aws_iam_service_linked_role.opensearch
  ]
}

# IAM service linked role for OpenSearch
resource "aws_iam_service_linked_role" "opensearch" {
  aws_service_name = "opensearchserverless.amazonaws.com"
  custom_suffix    = random_pet.suffix.id
}

# Master role for OpenSearch
resource "aws_iam_role" "search_master" {
  name = "daylight_search_master_${random_pet.suffix.id}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
      }
    ]
  })
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# CloudWatch log groups for OpenSearch
resource "aws_cloudwatch_log_group" "search_index" {
  name              = "/aws/opensearch/domains/daylight-search-${random_pet.suffix.id}/index-slow"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "search_search" {
  name              = "/aws/opensearch/domains/daylight-search-${random_pet.suffix.id}/search-slow"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "search_error" {
  name              = "/aws/opensearch/domains/daylight-search-${random_pet.suffix.id}/error"
  retention_in_days = 14
}

# VPC resources for secure OpenSearch (optional)
resource "aws_vpc" "search" {
  count      = var.enable_vpc_search ? 1 : 0
  cidr_block = "10.0.0.0/16"

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "daylight-search-vpc-${random_pet.suffix.id}"
  }
}

resource "aws_subnet" "search" {
  count = var.enable_vpc_search ? 2 : 0

  vpc_id            = aws_vpc.search[0].id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "daylight-search-subnet-${count.index + 1}-${random_pet.suffix.id}"
  }
}

resource "aws_internet_gateway" "search" {
  count  = var.enable_vpc_search ? 1 : 0
  vpc_id = aws_vpc.search[0].id

  tags = {
    Name = "daylight-search-igw-${random_pet.suffix.id}"
  }
}

resource "aws_route_table" "search" {
  count  = var.enable_vpc_search ? 1 : 0
  vpc_id = aws_vpc.search[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.search[0].id
  }

  tags = {
    Name = "daylight-search-rt-${random_pet.suffix.id}"
  }
}

resource "aws_route_table_association" "search" {
  count = var.enable_vpc_search ? 2 : 0

  subnet_id      = aws_subnet.search[count.index].id
  route_table_id = aws_route_table.search[0].id
}

resource "aws_security_group" "search" {
  count       = var.enable_vpc_search ? 1 : 0
  name_prefix = "daylight-search-${random_pet.suffix.id}"
  vpc_id      = aws_vpc.search[0].id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.search[0].cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "daylight-search-sg-${random_pet.suffix.id}"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Update Lambda IAM role to include OpenSearch permissions
resource "aws_iam_role_policy" "lambda_search" {
  name = "daylight_lambda_search_${random_pet.suffix.id}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "es:ESHttpPost",
          "es:ESHttpPut",
          "es:ESHttpGet",
          "es:ESHttpDelete",
          "es:ESHttpHead"
        ]
        Resource = "${aws_opensearch_domain.search.arn}/*"
      }
    ]
  })
}

# Search Lambda function for indexing and search operations
resource "aws_lambda_function" "search" {
  function_name    = "daylight_search_${random_pet.suffix.id}"
  role             = aws_iam_role.lambda.arn
  handler          = "search.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 512
  filename         = "${var.backend_zip_dir}/search.zip"
  source_code_hash = filebase64sha256("${var.backend_zip_dir}/search.zip")

  environment {
    variables = {
      OPENSEARCH_ENDPOINT = aws_opensearch_domain.search.endpoint
      OPENSEARCH_REGION   = var.region
      TABLE_TRIPS         = aws_dynamodb_table.trips.name
    }
  }

  depends_on = [aws_opensearch_domain.search]
}

# Search Admin Lambda function for administrative operations
resource "aws_lambda_function" "search_admin" {
  function_name    = "daylight_search_admin_${random_pet.suffix.id}"
  role             = aws_iam_role.lambda.arn
  handler          = "searchAdmin.handler"
  runtime          = "nodejs20.x"
  timeout          = 300  # Longer timeout for indexing operations
  memory_size      = 1024
  filename         = "${var.backend_zip_dir}/searchAdmin.zip"
  source_code_hash = filebase64sha256("${var.backend_zip_dir}/searchAdmin.zip")

  environment {
    variables = {
      OPENSEARCH_ENDPOINT = aws_opensearch_domain.search.endpoint
      OPENSEARCH_REGION   = var.region
      TABLE_TRIPS         = aws_dynamodb_table.trips.name
      SEARCH_ADMIN_TOKEN  = var.search_admin_token
    }
  }

  depends_on = [aws_opensearch_domain.search]
}

# API Gateway routes for search
resource "aws_apigatewayv2_integration" "search" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.search.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "search_get" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /search"
  target    = "integrations/${aws_apigatewayv2_integration.search.id}"
}

resource "aws_apigatewayv2_route" "search_post" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /search"
  target    = "integrations/${aws_apigatewayv2_integration.search.id}"
}

resource "aws_lambda_permission" "allow_apigw_search" {
  statement_id  = "AllowAPIGatewayInvokeSearch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.search.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/search"
}

# API Gateway integration for search admin
resource "aws_apigatewayv2_integration" "search_admin" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.search_admin.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "search_admin_get" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /search/admin"
  target    = "integrations/${aws_apigatewayv2_integration.search_admin.id}"
}

resource "aws_apigatewayv2_route" "search_admin_post" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /search/admin"
  target    = "integrations/${aws_apigatewayv2_integration.search_admin.id}"
}

resource "aws_lambda_permission" "allow_apigw_search_admin" {
  statement_id  = "AllowAPIGatewayInvokeSearchAdmin"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.search_admin.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/search/admin"
}

# Outputs for search infrastructure
output "search_endpoint" {
  description = "OpenSearch domain endpoint"
  value       = aws_opensearch_domain.search.endpoint
}

output "search_dashboard_endpoint" {
  description = "OpenSearch dashboard endpoint"
  value       = aws_opensearch_domain.search.dashboard_endpoint
}

output "search_domain_name" {
  description = "OpenSearch domain name"
  value       = aws_opensearch_domain.search.domain_name
}
