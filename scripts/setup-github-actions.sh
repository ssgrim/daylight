#!/bin/bash
set -e

# GitHub Actions Deployment Setup Script
# This script helps set up the AWS IAM user and gets the values needed for GitHub secrets

ENVIRONMENT="${1:-dev}"
AWS_REGION="${2:-us-west-1}"
PROJECT_NAME="daylight"

echo "🚀 Setting up GitHub Actions deployment for $PROJECT_NAME ($ENVIRONMENT)"
echo "📍 Region: $AWS_REGION"
echo ""

# Create IAM user for GitHub Actions
IAM_USER_NAME="github-actions-${PROJECT_NAME}-${ENVIRONMENT}"

echo "👤 Creating IAM user: $IAM_USER_NAME"
aws iam create-user --user-name "$IAM_USER_NAME" --tags "Key=Project,Value=$PROJECT_NAME" "Key=Environment,Value=$ENVIRONMENT" "Key=Purpose,Value=GitHubActions" || {
    echo "ℹ️  User might already exist, continuing..."
}

# Attach the policy
POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/GitHubActions-${PROJECT_NAME}-${ENVIRONMENT}"

echo "📋 Creating and attaching IAM policy..."
aws iam create-policy \
    --policy-name "GitHubActions-${PROJECT_NAME}-${ENVIRONMENT}" \
    --policy-document file://docs/github-actions-iam-policy.json \
    --description "Policy for GitHub Actions deployment of $PROJECT_NAME ($ENVIRONMENT)" || {
    echo "ℹ️  Policy might already exist, continuing..."
    POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/GitHubActions-${PROJECT_NAME}-${ENVIRONMENT}"
}

aws iam attach-user-policy \
    --user-name "$IAM_USER_NAME" \
    --policy-arn "$POLICY_ARN"

# Create access key
echo "🔑 Creating access key..."
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$IAM_USER_NAME" --output json)
ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.SecretAccessKey')

echo "✅ Access key created successfully"
echo ""

# Get Terraform outputs
echo "📊 Getting Terraform outputs..."
cd infra/terraform

if [ ! -f "terraform.tfstate" ]; then
    echo "❌ Terraform state not found. Please run 'terraform apply' first."
    exit 1
fi

API_BASE_URL=$(terraform output -raw api_base_url 2>/dev/null || echo "")
S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
CLOUDFRONT_DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
WEBSITE_URL=$(terraform output -raw website_url 2>/dev/null || echo "")

cd ../..

# Extract domain from website URL
if [ -n "$WEBSITE_URL" ]; then
    DOMAIN_NAME=$(echo "$WEBSITE_URL" | sed 's|https://||')
else
    DOMAIN_NAME=""
fi

echo "✅ Terraform outputs retrieved"
echo ""

# Display all the values for GitHub secrets
echo "🎯 GitHub Secrets Configuration"
echo "======================================"
echo ""
echo "Add these secrets to your GitHub repository:"
echo "Repository Settings > Secrets and variables > Actions > New repository secret"
echo ""

echo "AWS Credentials:"
echo "----------------"
echo "AWS_ACCESS_KEY_ID: $ACCESS_KEY_ID"
echo "AWS_SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY"
echo ""

echo "Development Environment:"
echo "------------------------"
echo "DEV_API_BASE_URL: $API_BASE_URL"
echo "DEV_S3_BUCKET_NAME: $S3_BUCKET_NAME"
echo "DEV_CLOUDFRONT_DISTRIBUTION_ID: $CLOUDFRONT_DISTRIBUTION_ID"
echo "DEV_DOMAIN_NAME: $DOMAIN_NAME"
echo ""

echo "Application Secrets:"
echo "-------------------"
echo "VITE_MAPBOX_TOKEN: [YOUR_MAPBOX_TOKEN]"
echo ""

# Create a secrets file for reference
cat > github-secrets-${ENVIRONMENT}.txt << EOF
# GitHub Secrets for ${PROJECT_NAME} (${ENVIRONMENT})
# Generated on $(date)

AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY

DEV_API_BASE_URL=$API_BASE_URL
DEV_S3_BUCKET_NAME=$S3_BUCKET_NAME
DEV_CLOUDFRONT_DISTRIBUTION_ID=$CLOUDFRONT_DISTRIBUTION_ID
DEV_DOMAIN_NAME=$DOMAIN_NAME

VITE_MAPBOX_TOKEN=[YOUR_MAPBOX_TOKEN]
EOF

echo "📝 Secrets saved to: github-secrets-${ENVIRONMENT}.txt"
echo ""

# Validation
echo "🔍 Validation"
echo "=============="

if [ -z "$API_BASE_URL" ]; then
    echo "⚠️  Warning: API_BASE_URL is empty. Check Terraform outputs."
fi

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "⚠️  Warning: S3_BUCKET_NAME is empty. Check Terraform outputs."
fi

if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "⚠️  Warning: CLOUDFRONT_DISTRIBUTION_ID is empty. Check Terraform outputs."
fi

if [ -n "$API_BASE_URL" ] && [ -n "$S3_BUCKET_NAME" ] && [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "✅ All required values found!"
else
    echo "❌ Some values are missing. Please check your Terraform deployment."
fi

echo ""
echo "🔧 Next Steps"
echo "============="
echo "1. Add the secrets above to your GitHub repository"
echo "2. Get a Mapbox token from https://account.mapbox.com/"
echo "3. Push to the 'dev' branch to trigger deployment"
echo "4. Monitor the deployment in GitHub Actions"
echo ""

echo "🔗 Useful Links"
echo "==============="
echo "• GitHub Secrets: https://github.com/YOUR_USERNAME/daylight/settings/secrets/actions"
echo "• AWS Console: https://console.aws.amazon.com/"
echo "• Mapbox Tokens: https://account.mapbox.com/access-tokens/"
echo ""

echo "⚠️  Security Notes"
echo "=================="
echo "• Store the github-secrets-${ENVIRONMENT}.txt file securely"
echo "• Do not commit secrets to version control"
echo "• Rotate access keys regularly"
echo "• Delete the secrets file after adding them to GitHub"

echo ""
echo "🎉 Setup completed successfully!"
