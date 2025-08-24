#!/bin/bash
set -e

# CloudFront cache invalidation script for deployments
# Usage: ./invalidate-cache.sh <distribution-id> [environment]

DISTRIBUTION_ID="${1}"
ENVIRONMENT="${2:-dev}"

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "Error: Distribution ID is required"
    echo "Usage: $0 <distribution-id> [environment]"
    exit 1
fi

echo "🚀 Starting cache invalidation for CloudFront distribution: $DISTRIBUTION_ID"
echo "📁 Environment: $ENVIRONMENT"

# Create invalidation for index.html and env.json (always invalidate)
INVALIDATION_PATHS='"/index.html" "/env.json" "/*"'

echo "🔄 Creating invalidation for paths: $INVALIDATION_PATHS"

# Create the invalidation
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths $INVALIDATION_PATHS \
    --query 'Invalidation.Id' \
    --output text)

if [ $? -eq 0 ]; then
    echo "✅ Invalidation created successfully!"
    echo "📋 Invalidation ID: $INVALIDATION_ID"
    echo "🕒 Status: In Progress"
    
    # Option to wait for completion
    read -p "⏳ Wait for invalidation to complete? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "⏳ Waiting for invalidation to complete..."
        aws cloudfront wait invalidation-completed \
            --distribution-id "$DISTRIBUTION_ID" \
            --id "$INVALIDATION_ID"
        
        if [ $? -eq 0 ]; then
            echo "✅ Cache invalidation completed successfully!"
        else
            echo "❌ Error waiting for invalidation completion"
            exit 1
        fi
    else
        echo "ℹ️  You can check the status with:"
        echo "   aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
    fi
else
    echo "❌ Failed to create invalidation"
    exit 1
fi

echo ""
echo "📚 Cache Invalidation Guide:"
echo "  • index.html: Always invalidated (short TTL)"
echo "  • /assets/*: Not needed (hashed filenames)"
echo "  • /api/*: Not cached (no-cache headers)"
echo "  • env.json: Always invalidated (runtime config)"
echo ""
echo "🔄 Next deployment steps:"
echo "  1. Build frontend: npm run build"
echo "  2. Upload to S3: aws s3 sync dist/ s3://bucket-name/"
echo "  3. Invalidate cache: ./invalidate-cache.sh $DISTRIBUTION_ID"
