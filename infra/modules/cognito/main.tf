# AWS Cognito User Pool and Identity Pool for JWT Authentication
# Provides comprehensive user authentication with JWT tokens

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name                     = "daylight-users-${var.environment}"
  deletion_protection      = var.environment == "production" ? "ACTIVE" : "INACTIVE"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  # Username configuration
  username_configuration {
    case_sensitive = false
  }

  # Verification message template
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Daylight verification code"
    email_message        = "Your Daylight verification code is {####}"
  }

  # Admin create user config
  admin_create_user_config {
    allow_admin_create_user_only = false
    invite_message_template {
      email_subject = "Welcome to Daylight!"
      email_message = "Hello {username}, you have been invited to join Daylight. Your temporary password is {####}"
      sms_message   = "Hello {username}, your Daylight temporary password is {####}"
    }
  }

  # Custom attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "picture"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 2048
    }
  }

  tags = {
    Name        = "daylight-user-pool"
    Environment = var.environment
    Service     = "daylight"
    Purpose     = "authentication"
  }
}

# Cognito User Pool Client (Web)
resource "aws_cognito_user_pool_client" "web_client" {
  name         = "daylight-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth settings
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["phone", "email", "openid", "profile", "aws.cognito.signin.user.admin"]
  
  # Callback URLs
  callback_urls = [
    "http://localhost:5173/auth/callback",
    "https://${var.domain_name}/auth/callback"
  ]
  
  logout_urls = [
    "http://localhost:5173/auth/logout",
    "https://${var.domain_name}/auth/logout"
  ]

  # Client settings
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation             = true
  enable_propagate_additional_user_context_data = false

  # Supported identity providers
  supported_identity_providers = ["COGNITO"]

  # Token validity
  access_token_validity  = 60    # 1 hour
  id_token_validity     = 60    # 1 hour
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "name",
    "picture",
    "preferred_username",
    "updated_at"
  ]

  write_attributes = [
    "email",
    "name",
    "picture",
    "preferred_username",
    "updated_at"
  ]

  # Explicit auth flows
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}

# Cognito User Pool Client (Mobile/API)
resource "aws_cognito_user_pool_client" "mobile_client" {
  name         = "daylight-mobile-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth settings
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["phone", "email", "openid", "profile", "aws.cognito.signin.user.admin"]

  # Client settings
  generate_secret                      = true
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation             = true
  enable_propagate_additional_user_context_data = false

  # Supported identity providers
  supported_identity_providers = ["COGNITO"]

  # Token validity
  access_token_validity  = 60    # 1 hour
  id_token_validity     = 60    # 1 hour
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "name",
    "picture",
    "preferred_username",
    "updated_at"
  ]

  write_attributes = [
    "email",
    "name",
    "picture",
    "preferred_username",
    "updated_at"
  ]

  # Explicit auth flows
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "daylight-auth-${var.environment}-${random_string.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "random_string" "domain_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Cognito Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "daylight_identity_${var.environment}"
  allow_unauthenticated_identities = false
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web_client.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.mobile_client.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = {
    Name        = "daylight-identity-pool"
    Environment = var.environment
    Service     = "daylight"
    Purpose     = "authentication"
  }
}

# IAM role for authenticated users
resource "aws_iam_role" "authenticated_role" {
  name = "daylight-cognito-authenticated-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "daylight-cognito-authenticated-role"
    Environment = var.environment
    Service     = "daylight"
  }
}

# IAM policy for authenticated users
resource "aws_iam_role_policy" "authenticated_policy" {
  name = "daylight-cognito-authenticated-policy"
  role = aws_iam_role.authenticated_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${aws_api_gateway_rest_api.main.execution_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.main.arn,
          "${aws_dynamodb_table.main.arn}/index/*"
        ]
        Condition = {
          "ForAllValues:StringEquals" = {
            "dynamodb:LeadingKeys" = ["$${cognito-identity.amazonaws.com:sub}"]
          }
        }
      }
    ]
  })
}

# IAM role for unauthenticated users (minimal permissions)
resource "aws_iam_role" "unauthenticated_role" {
  name = "daylight-cognito-unauthenticated-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "daylight-cognito-unauthenticated-role"
    Environment = var.environment
    Service     = "daylight"
  }
}

# IAM policy for unauthenticated users (read-only access)
resource "aws_iam_role_policy" "unauthenticated_policy" {
  name = "daylight-cognito-unauthenticated-policy"
  role = aws_iam_role.unauthenticated_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${aws_api_gateway_rest_api.main.execution_arn}/*/GET/*"
        ]
      }
    ]
  })
}

# Attach roles to identity pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated"   = aws_iam_role.authenticated_role.arn
    "unauthenticated" = aws_iam_role.unauthenticated_role.arn
  }

  role_mapping {
    identity_provider         = "${aws_cognito_user_pool.main.endpoint}:${aws_cognito_user_pool_client.web_client.id}"
    ambiguous_role_resolution = "AuthenticatedRole"
    type                      = "Token"
  }

  role_mapping {
    identity_provider         = "${aws_cognito_user_pool.main.endpoint}:${aws_cognito_user_pool_client.mobile_client.id}"
    ambiguous_role_resolution = "AuthenticatedRole"
    type                      = "Token"
  }
}

# Store Cognito configuration in SSM for application use
resource "aws_ssm_parameter" "cognito_config" {
  name = "/daylight/${var.environment}/cognito/config"
  type = "String"
  value = jsonencode({
    userPoolId        = aws_cognito_user_pool.main.id
    userPoolClientId  = aws_cognito_user_pool_client.web_client.id
    identityPoolId    = aws_cognito_identity_pool.main.id
    region            = data.aws_region.current.name
    domain            = aws_cognito_user_pool_domain.main.domain
    redirectSignIn    = "https://${var.domain_name}/auth/callback"
    redirectSignOut   = "https://${var.domain_name}/auth/logout"
  })

  tags = {
    Name        = "daylight-cognito-config"
    Environment = var.environment
    Service     = "daylight"
  }
}

# Variables
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "localhost:5173"
}

# Data sources
data "aws_region" "current" {}

# Outputs
output "cognito_user_pool_id" {
  description = "ID of the Cognito user pool"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "ID of the Cognito user pool client"
  value       = aws_cognito_user_pool_client.web_client.id
}

output "cognito_identity_pool_id" {
  description = "ID of the Cognito identity pool"
  value       = aws_cognito_identity_pool.main.id
}

output "cognito_domain" {
  description = "Cognito user pool domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "cognito_hosted_ui_url" {
  description = "Cognito hosted UI URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "cognito_config_ssm_parameter" {
  description = "SSM parameter containing Cognito configuration"
  value       = aws_ssm_parameter.cognito_config.name
}
