#!/bin/bash
set -e

# Complete deployment script for Daylight application
# Usage: ./deploy.sh <environment> [--skip-build] [--skip-invalidate]

ENVIRONMENT="${1:-dev}"
SKIP_BUILD="${2}"
SKIP_INVALIDATE="${3}"

# Load environment-specific configuration
case "$ENVIRONMENT" in
    "dev")
        BUCKET_NAME="${DAYLIGHT_DEV_BUCKET:-daylight-frontend-dev}"
        DISTRIBUTION_ID="${DAYLIGHT_DEV_DISTRIBUTION_ID}"
        API_BASE_URL="${DAYLIGHT_DEV_API_BASE:-https://api-dev.daylight.app}"
        ;;
    "prod")
        BUCKET_NAME="${DAYLIGHT_PROD_BUCKET:-daylight-frontend-prod}"
        DISTRIBUTION_ID="${DAYLIGHT_PROD_DISTRIBUTION_ID}"
        API_BASE_URL="${DAYLIGHT_PROD_API_BASE:-https://api.daylight.app}"
        ;;
    *)
        echo "❌ Error: Invalid environment. Use 'dev' or 'prod'"
        exit 1
        ;;
esac

echo "🚀 Starting deployment to $ENVIRONMENT environment"
echo "📦 S3 Bucket: $BUCKET_NAME"
echo "🌐 CloudFront Distribution: $DISTRIBUTION_ID"
echo "🔗 API Base URL: $API_BASE_URL"
echo ""

# Validate required environment variables
if [ -z "$DISTRIBUTION_ID" ]; then
    echo "⚠️  Warning: DISTRIBUTION_ID not set. Cache invalidation will be skipped."
fi

# Build frontend (unless skipped)
if [ "$SKIP_BUILD" != "--skip-build" ]; then
    echo "🔨 Building frontend..."
    cd frontend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm ci
    fi
    
    # Build for production
    echo "🏗️  Building production bundle..."
    npm run build
    
    cd ..
    echo "✅ Frontend build completed"
else
    echo "⏭️  Skipping build (--skip-build specified)"
fi

# Update env.json with correct API base URL
echo "⚙️  Updating runtime configuration..."
cat > frontend/dist/env.json << EOF
{
  "VITE_API_BASE": "$API_BASE_URL",
  "ENVIRONMENT": "$ENVIRONMENT",
  "BUILD_TIME": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "VERSION": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
}
EOF

echo "📝 Runtime configuration updated:"
cat frontend/dist/env.json
echo ""

# Upload to S3
echo "☁️  Uploading to S3..."

# Upload with cache-friendly headers
echo "📂 Uploading static assets (with 1-year cache)..."
aws s3 sync frontend/dist/assets/ s3://$BUCKET_NAME/assets/ \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*" \
    --include "*.js" \
    --include "*.css" \
    --include "*.png" \
    --include "*.jpg" \
    --include "*.jpeg" \
    --include "*.gif" \
    --include "*.svg" \
    --include "*.woff" \
    --include "*.woff2"

echo "📄 Uploading HTML and config files (with short cache)..."
aws s3 cp frontend/dist/index.html s3://$BUCKET_NAME/ \
    --cache-control "public, max-age=300, must-revalidate"

aws s3 cp frontend/dist/env.json s3://$BUCKET_NAME/ \
    --cache-control "no-cache, no-store, must-revalidate"

echo "📋 Uploading manifest and other files..."
aws s3 sync frontend/dist/ s3://$BUCKET_NAME/ \
    --exclude "assets/*" \
    --exclude "index.html" \
    --exclude "env.json" \
    --cache-control "public, max-age=3600"

echo "✅ S3 upload completed"

# Invalidate CloudFront cache (unless skipped)
if [ "$SKIP_INVALIDATE" != "--skip-invalidate" ] && [ -n "$DISTRIBUTION_ID" ]; then
    echo "🔄 Invalidating CloudFront cache..."
    ./scripts/invalidate-cache.sh "$DISTRIBUTION_ID" "$ENVIRONMENT"
else
    echo "⏭️  Skipping cache invalidation"
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  API Base: $API_BASE_URL"
echo "  Build Time: $(date)"
echo ""
echo "🔗 Application URLs:"
case "$ENVIRONMENT" in
    "dev")
        echo "  Frontend: https://dev.daylight.app"
        echo "  API: $API_BASE_URL"
        ;;
    "prod")
        echo "  Frontend: https://daylight.app"
        echo "  API: $API_BASE_URL"
        ;;
esac
echo ""
echo "📚 Next steps:"
echo "  • Test the deployment: npm run test:e2e"
echo "  • Monitor CloudFront metrics in AWS Console"
echo "  • Check application logs if needed"
