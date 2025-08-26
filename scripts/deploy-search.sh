#!/bin/bash

# Deploy Search Infrastructure - Issue #112
# This script deploys the OpenSearch-based search infrastructure

set -e

echo "🔍 Deploying Search Infrastructure (Issue #112)"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "infra/terraform/search.tf" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Build backend with search handlers
echo "📦 Building backend with search handlers..."
cd backend
npm install
npm run build
cd ..

# Check if required zip files exist
if [ ! -f "backend/dist/search.zip" ] || [ ! -f "backend/dist/searchAdmin.zip" ]; then
    echo "❌ Error: Search Lambda zip files not found. Build may have failed."
    exit 1
fi

echo "✅ Search handlers built successfully"

# Deploy infrastructure with Terraform
echo "🚀 Deploying OpenSearch infrastructure..."
cd infra/terraform

# Initialize Terraform if not already done
if [ ! -d ".terraform" ]; then
    echo "🔧 Initializing Terraform..."
    terraform init
fi

# Plan the deployment
echo "📋 Planning Terraform deployment..."
terraform plan \
    -var="backend_zip_dir=../../backend/dist" \
    -var="search_instance_type=t3.small.search" \
    -var="search_instance_count=1" \
    -var="search_volume_size=20" \
    -var="enable_vpc_search=false" \
    -var="search_admin_token=dev-admin-token-$(date +%s)" \
    -out=search-plan.tfplan

# Ask for confirmation
echo ""
echo "🤔 Review the plan above. Do you want to apply these changes?"
echo "   This will create an OpenSearch cluster and Lambda functions."
echo "   Estimated cost: ~$30-50/month for t3.small.search instance"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Apply the changes
echo "🚀 Applying Terraform changes..."
terraform apply search-plan.tfplan

# Get the outputs
echo ""
echo "📊 Deployment Summary"
echo "===================="
API_BASE=$(terraform output -raw api_base_url 2>/dev/null || echo "Not available")
SEARCH_ENDPOINT=$(terraform output -raw search_endpoint 2>/dev/null || echo "Not available")
SEARCH_DASHBOARD=$(terraform output -raw search_dashboard_endpoint 2>/dev/null || echo "Not available")

echo "API Base URL:      $API_BASE"
echo "Search Endpoint:   $SEARCH_ENDPOINT"
echo "Search Dashboard:  $SEARCH_DASHBOARD"

# Initialize search index with sample data
if [ "$API_BASE" != "Not available" ]; then
    echo ""
    echo "🔄 Initializing search index with sample data..."
    
    # Wait a moment for Lambda deployment to be ready
    sleep 10
    
    # Initialize the index
    INIT_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer dev-admin-token-$(date +%s)" \
        -H "Content-Type: application/json" \
        -d '{"action": "initialize"}' \
        "$API_BASE/search/admin" || echo '{"error": "failed"}')
    
    if echo "$INIT_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Search index initialized successfully"
        
        # Test the search functionality
        echo "🧪 Testing search functionality..."
        SEARCH_RESPONSE=$(curl -s "$API_BASE/search?q=bridge&limit=3" || echo '{"error": "failed"}')
        
        if echo "$SEARCH_RESPONSE" | grep -q '"success":true'; then
            echo "✅ Search test successful"
            RESULT_COUNT=$(echo "$SEARCH_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
            echo "   Found $RESULT_COUNT locations in search index"
        else
            echo "⚠️  Search test failed, but infrastructure is deployed"
        fi
    else
        echo "⚠️  Index initialization failed, but infrastructure is deployed"
        echo "   You can manually initialize later with:"
        echo "   curl -X POST -H 'Authorization: Bearer <token>' $API_BASE/search/admin -d '{\"action\": \"initialize\"}'"
    fi
fi

cd ../..

echo ""
echo "🎉 Search Infrastructure Deployment Complete!"
echo "=============================================="
echo ""
echo "🔗 Available Endpoints:"
echo "  Search API:        $API_BASE/search"
echo "  Search Admin:      $API_BASE/search/admin (requires auth)"
echo "  Search Dashboard:  $SEARCH_DASHBOARD"
echo ""
echo "📚 Example Usage:"
echo "  # Search near Golden Gate Bridge"
echo "  curl '$API_BASE/search?q=bridge&lat=37.8199&lon=-122.4783&radius=5km'"
echo ""
echo "  # Get search suggestions"
echo "  curl '$API_BASE/search?action=suggest&prefix=golden'"
echo ""
echo "  # Search with facets"
echo "  curl '$API_BASE/search?category=dining&facets=subcategory'"
echo ""
echo "📖 Documentation: docs/search-infrastructure.md"
echo "🧪 Tests: backend/test/search.test.js"
echo ""
echo "✅ Issue #112 - Search Infrastructure & Geospatial Indexing - COMPLETE"
