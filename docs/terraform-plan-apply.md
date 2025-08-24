# Infrastructure as Code - Plan and Apply Guide

This document provides comprehensive guidance for planning and applying Terraform infrastructure for the Daylight application.

## Overview

The infrastructure is organized into modular components:
- **Database Module**: DynamoDB tables for trips and caching
- **Lambda/API Module**: Lambda functions with API Gateway
- **Frontend Module**: S3 + CloudFront for static hosting

## Prerequisites

### Required Tools
```bash
# Terraform (>= 1.6.0)
terraform --version

# AWS CLI (configured)
aws sts get-caller-identity

# Node.js (for building Lambda functions)
node --version
```

### AWS Permissions
Your AWS credentials must have permissions for:
- IAM (roles, policies, attachments)
- Lambda (functions, permissions)
- API Gateway (APIs, routes, integrations)
- DynamoDB (tables, indexes)
- S3 (buckets, objects, policies)
- CloudFront (distributions, origins)
- CloudWatch (log groups, alarms)
- Secrets Manager (optional)
- SNS (optional)

### Build Backend
```bash
cd backend
npm ci
npm run build
ls -la dist/  # Should show trips.zip and plan.zip
```

## Directory Structure

```
infra/
├── terraform/
│   ├── main-modular.tf         # Main configuration using modules
│   ├── variables-modular.tf    # Variable definitions
│   ├── outputs-modular.tf      # Output definitions
│   └── modules/
│       ├── database/           # DynamoDB module
│       ├── lambda-api/         # Lambda + API Gateway module
│       └── frontend/           # S3 + CloudFront module
├── env/
│   ├── dev.tfvars             # Development configuration
│   └── prod.tfvars            # Production configuration
└── docs/
    └── terraform-plan-apply.md  # This file
```

## Environment Configuration

### Development (`dev.tfvars`)
- **Billing**: Pay-per-request (cost-effective)
- **Caching**: Enabled for testing
- **Monitoring**: Minimal (no alarms)
- **CloudFront**: Basic distribution
- **Retention**: 7 days for logs
- **Security**: Relaxed CORS, force destroy enabled

### Production (`prod.tfvars`)
- **Billing**: Pay-per-request (can upgrade to provisioned)
- **Caching**: Enabled with longer TTL
- **Monitoring**: Full alarms and metrics
- **CloudFront**: Global distribution with custom SSL
- **Retention**: 30 days for logs
- **Security**: Strict CORS, point-in-time recovery

## Planning Infrastructure

### 1. Initialize Terraform
```bash
cd infra/terraform
terraform init
```

### 2. Validate Configuration
```bash
# Check syntax
terraform validate

# Format code
terraform fmt -recursive
```

### 3. Plan for Development
```bash
# Plan using modular configuration
terraform plan -var-file="../env/dev.tfvars" -out=plan-dev.tfplan

# Review the plan
terraform show plan-dev.tfplan
```

### 4. Plan for Production
```bash
terraform plan -var-file="../env/prod.tfvars" -out=plan-prod.tfplan
terraform show plan-prod.tfplan
```

## Understanding the Plan

### Resource Creation Order
1. **Random Pet**: Suffix for unique naming
2. **DynamoDB Tables**: Data storage
3. **IAM Roles/Policies**: Lambda execution permissions
4. **Lambda Functions**: Backend logic
5. **API Gateway**: HTTP API and routes
6. **S3 Bucket**: Frontend hosting
7. **CloudFront**: CDN distribution
8. **Optional**: Secrets Manager, SNS topics

### Key Resources by Module

#### Database Module
- `aws_dynamodb_table.trips`: Main data table
- `aws_dynamodb_table.cache`: Caching table (optional)
- `aws_cloudwatch_metric_alarm.*`: Monitoring (optional)

#### Lambda/API Module
- `aws_iam_role.lambda_execution_role`: Lambda permissions
- `aws_lambda_function.*`: Function deployments
- `aws_apigatewayv2_api.api`: HTTP API
- `aws_apigatewayv2_route.*`: API routes
- `aws_lambda_permission.*`: API Gateway invoke permissions

#### Frontend Module
- `aws_s3_bucket.frontend`: Static hosting
- `aws_cloudfront_distribution.frontend`: CDN
- `aws_cloudfront_origin_access_control.frontend`: S3 access
- `aws_s3_bucket_policy.frontend`: Bucket permissions

## Applying Infrastructure

### 1. Apply Development Environment
```bash
# Apply the planned changes
terraform apply plan-dev.tfplan

# Or apply directly (less safe)
terraform apply -var-file="../env/dev.tfvars"
```

### 2. Verify Deployment
```bash
# Check outputs
terraform output

# Test API endpoint
curl $(terraform output -raw api_base_url)/health

# Check frontend
curl -I $(terraform output -raw website_url)
```

### 3. Apply Production Environment
```bash
# Use workspace for production (recommended)
terraform workspace new prod
terraform apply -var-file="../env/prod.tfvars"

# Or use different state file
terraform apply -var-file="../env/prod.tfvars" -state=terraform-prod.tfstate
```

## State Management

### Local State (Development)
```bash
# Default behavior - state stored locally
ls terraform.tfstate*
```

### Remote State (Production)
```hcl
# Add to main-modular.tf
terraform {
  backend "s3" {
    bucket = "daylight-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-west-1"
  }
}
```

### Workspaces
```bash
# Create environments
terraform workspace new dev
terraform workspace new prod

# Switch environments
terraform workspace select dev
terraform workspace select prod

# List environments
terraform workspace list
```

## Secrets and Permissions

### Environment Variables
```bash
# Required for Terraform
export AWS_PROFILE=daylight
export AWS_REGION=us-west-1

# Optional for secrets
export TF_VAR_google_places_api_key="your-key-here"
export TF_VAR_mapbox_access_token="your-token-here"
export TF_VAR_alarm_email="alerts@example.com"
```

### Secrets Manager Integration
```bash
# Store secrets after infrastructure creation
aws secretsmanager put-secret-value \
  --secret-id daylight-dev-api-keys \
  --secret-string '{"google_places_api_key":"your-key","mapbox_access_token":"your-token"}'
```

### IAM Policy for Terraform
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:*",
        "lambda:*",
        "apigateway:*",
        "dynamodb:*",
        "s3:*",
        "cloudfront:*",
        "cloudwatch:*",
        "logs:*",
        "secretsmanager:*",
        "sns:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### 1. Backend ZIP Files Not Found
```bash
# Error: no such file or directory: ../../backend/dist/trips.zip

# Solution: Build backend first
cd ../../backend
npm run build
cd ../infra/terraform
```

#### 2. S3 Bucket Name Conflicts
```bash
# Error: BucketAlreadyExists

# Solution: Use unique bucket names
# Edit dev.tfvars:
frontend_config = {
  bucket_name = "daylight-frontend-dev-your-suffix"
}
```

#### 3. CloudFront Distribution Takes Time
```bash
# CloudFront distributions can take 15-20 minutes to deploy
# Monitor progress:
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID
```

#### 4. API Gateway CORS Issues
```bash
# Test CORS headers
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     YOUR_API_ENDPOINT/plan
```

### Debug Commands
```bash
# Enable detailed logging
export TF_LOG=DEBUG
terraform apply -var-file="../env/dev.tfvars"

# Check AWS resources
aws dynamodb list-tables
aws lambda list-functions
aws apigatewayv2 get-apis
aws s3 ls
aws cloudfront list-distributions

# Validate configuration
terraform validate
terraform plan -var-file="../env/dev.tfvars" -detailed-exitcode
```

## Updating Infrastructure

### 1. Code Changes
```bash
# Pull latest changes
git pull origin main

# Plan changes
terraform plan -var-file="../env/dev.tfvars"

# Apply changes
terraform apply -var-file="../env/dev.tfvars"
```

### 2. Lambda Function Updates
```bash
# Rebuild backend
cd backend
npm run build

# Update Lambda functions
cd ../infra/terraform
terraform apply -replace=module.api.aws_lambda_function.functions[\"trips\"]
terraform apply -replace=module.api.aws_lambda_function.functions[\"plan\"]
```

### 3. Configuration Changes
```bash
# Edit environment file
vim ../env/dev.tfvars

# Plan and apply changes
terraform plan -var-file="../env/dev.tfvars"
terraform apply -var-file="../env/dev.tfvars"
```

## Destroying Infrastructure

### Development Environment
```bash
# Safe to destroy dev resources
terraform destroy -var-file="../env/dev.tfvars"
```

### Production Environment
```bash
# Extra confirmation for production
terraform plan -destroy -var-file="../env/prod.tfvars"
terraform destroy -var-file="../env/prod.tfvars"
```

### Selective Destruction
```bash
# Remove specific modules
terraform destroy -target=module.frontend -var-file="../env/dev.tfvars"
terraform destroy -target=module.api -var-file="../env/dev.tfvars"
terraform destroy -target=module.database -var-file="../env/dev.tfvars"
```

## Best Practices

### 1. Always Plan First
```bash
# Never apply without planning
terraform plan -var-file="../env/prod.tfvars" -out=prod.tfplan
terraform apply prod.tfplan
```

### 2. Use Version Control
```bash
# Commit tfvars changes
git add infra/env/dev.tfvars
git commit -m "Update dev environment configuration"
```

### 3. Review Changes
```bash
# Use plan files for review
terraform plan -var-file="../env/prod.tfvars" -out=prod.tfplan
terraform show -json prod.tfplan | jq .
```

### 4. Backup State
```bash
# Backup state before major changes
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d-%H%M%S)
```

### 5. Use Targeted Operations
```bash
# Update specific resources
terraform apply -target=module.api.aws_lambda_function.functions[\"trips\"] -var-file="../env/dev.tfvars"
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Terraform Plan
on:
  pull_request:
    paths: ['infra/**']

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: hashicorp/setup-terraform@v3
    - name: Terraform Plan
      run: |
        cd infra/terraform
        terraform init
        terraform plan -var-file="../env/dev.tfvars"
```

### Automated Deployment
```bash
# Use in CI/CD pipelines
terraform init -input=false
terraform plan -var-file="../env/${ENVIRONMENT}.tfvars" -out=tfplan -input=false
terraform apply -input=false tfplan
```
