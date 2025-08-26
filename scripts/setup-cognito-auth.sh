#!/bin/bash

# Cognito Authentication Setup Script
# This script helps configure environment variables after Terraform deployment

set -e

echo "🚀 Cognito Authentication Setup"
echo "================================="

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed."
    echo "   Install jq: https://jqlang.github.io/jq/"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Error: AWS CLI is not configured or credentials are invalid."
    echo "   Run: aws configure"
    exit 1
fi

# Get current working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📍 Project root: $PROJECT_ROOT"

# Function to get Terraform output
get_terraform_output() {
    local output_name=$1
    local terraform_dir="$PROJECT_ROOT/infra/terraform"
    
    if [ ! -d "$terraform_dir" ]; then
        echo "❌ Error: Terraform directory not found at $terraform_dir"
        exit 1
    fi
    
    cd "$terraform_dir"
    terraform output -raw "$output_name" 2>/dev/null || echo ""
}

# Check if Terraform state exists
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform"
if [ ! -f "$TERRAFORM_DIR/terraform.tfstate" ]; then
    echo "❌ Error: Terraform state not found. Please run 'terraform apply' first."
    echo "   Navigate to: $TERRAFORM_DIR"
    exit 1
fi

echo "📋 Retrieving Cognito configuration from Terraform..."

# Get Terraform outputs
USER_POOL_ID=$(get_terraform_output "cognito_user_pool_id")
CLIENT_ID=$(get_terraform_output "cognito_client_id")
COGNITO_DOMAIN=$(get_terraform_output "cognito_domain")
AWS_REGION=$(get_terraform_output "cognito_region" || echo "us-east-1")

# Validate outputs
if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ] || [ -z "$COGNITO_DOMAIN" ]; then
    echo "❌ Error: Missing Terraform outputs. Required outputs:"
    echo "   - cognito_user_pool_id"
    echo "   - cognito_client_id" 
    echo "   - cognito_domain"
    echo ""
    echo "   These outputs are already defined in main.tf:"
    echo ""
    echo "   output \"cognito_user_pool_id\" {"
    echo "     value = aws_cognito_user_pool.users.id"
    echo "   }"
    echo ""
    echo "   output \"cognito_client_id\" {"
    echo "     value = aws_cognito_user_pool_client.web_client.id"
    echo "   }"
    echo ""
    echo "   output \"cognito_domain\" {"
    echo "     value = aws_cognito_user_pool_domain.auth_domain.domain"
    echo "   }"
    echo ""
    echo "   output \"cognito_region\" {"
    echo "     value = var.region"
    echo "   }"
    exit 1
fi

# Display configuration
echo "✅ Cognito Configuration Retrieved:"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"
echo "   Domain: $COGNITO_DOMAIN"
echo "   Region: $AWS_REGION"
echo ""

# Update frontend environment file
FRONTEND_ENV_FILE="$PROJECT_ROOT/frontend/.env.local"
echo "📝 Updating frontend environment file: $FRONTEND_ENV_FILE"

# Backup existing file if it exists
if [ -f "$FRONTEND_ENV_FILE" ]; then
    cp "$FRONTEND_ENV_FILE" "$FRONTEND_ENV_FILE.backup"
    echo "   📋 Backed up existing file to .env.local.backup"
fi

# Read existing API_BASE if present
API_BASE=""
if [ -f "$FRONTEND_ENV_FILE" ]; then
    API_BASE=$(grep "^VITE_API_BASE=" "$FRONTEND_ENV_FILE" | cut -d'=' -f2- || echo "")
fi

# Set default API_BASE if not found
if [ -z "$API_BASE" ]; then
    API_BASE="http://localhost:5174"
fi

# Write new environment file
cat > "$FRONTEND_ENV_FILE" << EOF
# API Configuration
VITE_API_BASE=$API_BASE

# AWS Cognito Configuration
VITE_AWS_REGION=$AWS_REGION
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN.auth.$AWS_REGION.amazoncognito.com
EOF

echo "✅ Frontend environment file updated successfully!"

# Update backend environment (if using local .env file)
BACKEND_ENV_FILE="$PROJECT_ROOT/backend/.env.local"
if [ -f "$BACKEND_ENV_FILE" ]; then
    echo "📝 Updating backend environment file: $BACKEND_ENV_FILE"
    
    # Backup existing file
    cp "$BACKEND_ENV_FILE" "$BACKEND_ENV_FILE.backup"
    echo "   📋 Backed up existing file to .env.local.backup"
    
    # Update or add Cognito variables
    grep -v "^COGNITO_\|^AWS_REGION=" "$BACKEND_ENV_FILE" > "$BACKEND_ENV_FILE.tmp" || touch "$BACKEND_ENV_FILE.tmp"
    
    cat >> "$BACKEND_ENV_FILE.tmp" << EOF

# AWS Cognito Configuration
AWS_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_CLIENT_ID=$CLIENT_ID
EOF
    
    mv "$BACKEND_ENV_FILE.tmp" "$BACKEND_ENV_FILE"
    echo "✅ Backend environment file updated successfully!"
fi

# Test Cognito configuration
echo ""
echo "🧪 Testing Cognito configuration..."

# Test User Pool access
USER_POOL_INFO=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$USER_POOL_INFO" ]; then
    USER_POOL_NAME=$(echo "$USER_POOL_INFO" | jq -r '.UserPool.Name')
    echo "✅ User Pool accessible: $USER_POOL_NAME"
else
    echo "⚠️  Warning: Cannot access User Pool. Check AWS credentials and permissions."
fi

# Test Client configuration
CLIENT_INFO=$(aws cognito-idp describe-user-pool-client --user-pool-id "$USER_POOL_ID" --client-id "$CLIENT_ID" --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$CLIENT_INFO" ]; then
    CLIENT_NAME=$(echo "$CLIENT_INFO" | jq -r '.UserPoolClient.ClientName')
    echo "✅ User Pool Client accessible: $CLIENT_NAME"
else
    echo "⚠️  Warning: Cannot access User Pool Client. Check configuration."
fi

# Verify domain
DOMAIN_INFO=$(aws cognito-idp describe-user-pool-domain --domain "$COGNITO_DOMAIN" --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$DOMAIN_INFO" ]; then
    echo "✅ Cognito Domain accessible: $COGNITO_DOMAIN"
else
    echo "⚠️  Warning: Cannot access Cognito Domain. Check domain configuration."
fi

echo ""
echo "🎉 Setup Complete!"
echo "==================="
echo ""
echo "Next Steps:"
echo "1. Build and start the frontend:"
echo "   cd $PROJECT_ROOT/frontend"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "2. Build and start the backend:"
echo "   cd $PROJECT_ROOT/backend"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "3. Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:5174"
echo ""
echo "4. Test authentication:"
echo "   - Navigate to http://localhost:5173/auth"
echo "   - Create a new account"
echo "   - Verify email confirmation flow"
echo "   - Test login and protected routes"
echo ""
echo "🔐 Authentication Features:"
echo "   - User registration with email verification"
echo "   - Secure login with JWT tokens"
echo "   - Role-based access control (viewer/editor/owner)"
echo "   - Protected API routes"
echo "   - Trip management with user permissions"
echo ""
echo "📚 Documentation:"
echo "   - Full implementation guide: docs/cognito-authentication-implementation.md"
echo "   - Architecture overview: docs/auth-security-development-setup.md"
echo ""

# Optional: Display helpful commands
echo "💡 Helpful Commands:"
echo "   # View logs in CloudWatch (if deployed)"
echo "   aws logs describe-log-groups --log-group-name-prefix '/aws/lambda/daylight'"
echo ""
echo "   # Check Cognito users"
echo "   aws cognito-idp list-users --user-pool-id $USER_POOL_ID --region $AWS_REGION"
echo ""
echo "   # Verify JWT token (decode manually at jwt.io)"
echo "   echo '<your-jwt-token>' | cut -d'.' -f2 | base64 -d | jq"
echo ""
echo "Happy coding! 🚀"
