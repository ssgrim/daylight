# Migration Guide: Legacy to Modular Infrastructure

This guide helps you migrate from the existing monolithic Terraform configuration to the new modular structure.

## Migration Overview

**From**: Single `main.tf` with all resources
**To**: Modular structure with separate modules for database, API, and frontend

## Pre-Migration Checklist

1. **Backup Current State**
```bash
cd infra/terraform
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d-%H%M%S)
cp -r terraform.tfstate.d terraform.tfstate.d.backup.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
```

2. **Export Current Resources**
```bash
terraform show -json > current-state.json
terraform output > current-outputs.txt
```

3. **Build Backend (Required)**
```bash
cd ../../backend
npm ci
npm run build
ls -la dist/  # Verify trips.zip and plan.zip exist
cd ../infra/terraform
```

## Migration Options

### Option 1: Fresh Deployment (Recommended for Dev)

**Pros**: Clean slate, uses new module structure
**Cons**: Requires re-deployment, data loss in DynamoDB

```bash
# 1. Destroy existing infrastructure
terraform destroy -auto-approve

# 2. Switch to modular configuration
mv main.tf main.tf.legacy
mv variables.tf variables.tf.legacy
cp main-modular.tf main.tf
cp variables-modular.tf variables.tf
cp outputs-modular.tf outputs.tf

# 3. Initialize and deploy
terraform init
terraform plan -var-file="../env/dev.tfvars"
terraform apply -var-file="../env/dev.tfvars"
```

### Option 2: State Migration (Recommended for Prod)

**Pros**: Preserves existing resources and data
**Cons**: More complex, requires careful state manipulation

#### Step 1: Backup and Prepare
```bash
# Create migration workspace
terraform workspace new migration
terraform workspace select migration

# Copy current state
cp terraform.tfstate migration.tfstate
```

#### Step 2: Import Resources into Modules
```bash
# Switch to modular configuration
mv main.tf main.tf.legacy
cp main-modular.tf main.tf
cp variables-modular.tf variables.tf
cp outputs-modular.tf outputs.tf

# Initialize with new configuration
terraform init

# Import existing resources (replace with your actual resource names)
terraform import 'module.database.aws_dynamodb_table.trips' daylight_trips_YOUR_SUFFIX
terraform import 'module.api.aws_lambda_function.functions["trips"]' daylight_trips_YOUR_SUFFIX
terraform import 'module.api.aws_lambda_function.functions["plan"]' daylight_plan_YOUR_SUFFIX
terraform import 'module.api.aws_apigatewayv2_api.api' YOUR_API_ID
terraform import 'module.frontend.aws_s3_bucket.frontend' your-bucket-name
terraform import 'module.frontend.aws_cloudfront_distribution.frontend' YOUR_DISTRIBUTION_ID
```

#### Step 3: Remove Old State
```bash
# Remove old resource states (be very careful here)
terraform state rm aws_dynamodb_table.trips
terraform state rm aws_lambda_function.trips
terraform state rm aws_lambda_function.plan
terraform state rm aws_apigatewayv2_api.api
terraform state rm aws_s3_bucket.frontend
terraform state rm aws_cloudfront_distribution.cdn
```

### Option 3: Parallel Deployment

**Pros**: Zero downtime, can test before switching
**Cons**: Temporary resource duplication, costs

```bash
# 1. Deploy new infrastructure with different names
# Edit dev.tfvars to use different names:
project_name = "daylight-v2"

# 2. Deploy new infrastructure
terraform apply -var-file="../env/dev.tfvars"

# 3. Test new infrastructure
# 4. Update DNS/configuration to point to new resources
# 5. Destroy old infrastructure
```

## Detailed Migration Steps (Option 2 - State Migration)

### 1. Identify Current Resources
```bash
terraform state list > current-resources.txt
cat current-resources.txt
```

Expected resources:
- `aws_dynamodb_table.trips`
- `aws_lambda_function.trips`
- `aws_lambda_function.plan`
- `aws_apigatewayv2_api.api`
- `aws_s3_bucket.frontend`
- `aws_cloudfront_distribution.cdn`
- Various IAM roles and policies

### 2. Create Resource Mapping

Create mapping from old to new module paths:

```bash
# Old -> New mapping
echo "aws_dynamodb_table.trips -> module.database.aws_dynamodb_table.trips"
echo "aws_lambda_function.trips -> module.api.aws_lambda_function.functions[\"trips\"]"
echo "aws_lambda_function.plan -> module.api.aws_lambda_function.functions[\"plan\"]"
echo "aws_apigatewayv2_api.api -> module.api.aws_apigatewayv2_api.api"
echo "aws_s3_bucket.frontend -> module.frontend.aws_s3_bucket.frontend"
echo "aws_cloudfront_distribution.cdn -> module.frontend.aws_cloudfront_distribution.frontend"
```

### 3. Migration Script

```bash
#!/bin/bash
# migration-script.sh

set -e

echo "🚀 Starting infrastructure migration..."

# Get current resource IDs
TRIPS_TABLE=$(terraform state show aws_dynamodb_table.trips | grep "name" | head -1 | cut -d'"' -f4)
TRIPS_LAMBDA=$(terraform state show aws_lambda_function.trips | grep "function_name" | head -1 | cut -d'"' -f4)
PLAN_LAMBDA=$(terraform state show aws_lambda_function.plan | grep "function_name" | head -1 | cut -d'"' -f4)
API_ID=$(terraform state show aws_apigatewayv2_api.api | grep "id" | head -1 | cut -d'"' -f4)
S3_BUCKET=$(terraform state show aws_s3_bucket.frontend | grep "bucket" | head -1 | cut -d'"' -f4)
CF_DIST=$(terraform state show aws_cloudfront_distribution.cdn | grep "id" | head -1 | cut -d'"' -f4)

echo "📋 Current resources:"
echo "  DynamoDB Table: $TRIPS_TABLE"
echo "  Trips Lambda: $TRIPS_LAMBDA"
echo "  Plan Lambda: $PLAN_LAMBDA"
echo "  API Gateway: $API_ID"
echo "  S3 Bucket: $S3_BUCKET"
echo "  CloudFront: $CF_DIST"

# Backup state
cp terraform.tfstate terraform.tfstate.pre-migration

# Switch to modular configuration
mv main.tf main.tf.legacy
cp main-modular.tf main.tf
cp variables-modular.tf variables.tf
cp outputs-modular.tf outputs.tf

# Initialize new configuration
terraform init

# Import resources into modules
echo "📦 Importing resources into modules..."

terraform import "module.database.aws_dynamodb_table.trips" "$TRIPS_TABLE"
terraform import "module.api.aws_lambda_function.functions[\"trips\"]" "$TRIPS_LAMBDA"
terraform import "module.api.aws_lambda_function.functions[\"plan\"]" "$PLAN_LAMBDA"
terraform import "module.api.aws_apigatewayv2_api.api" "$API_ID"
terraform import "module.frontend.aws_s3_bucket.frontend" "$S3_BUCKET"
terraform import "module.frontend.aws_cloudfront_distribution.frontend" "$CF_DIST"

# Remove old state entries
echo "🗑️ Removing old state entries..."
terraform state rm aws_dynamodb_table.trips
terraform state rm aws_lambda_function.trips
terraform state rm aws_lambda_function.plan
terraform state rm aws_apigatewayv2_api.api
terraform state rm aws_s3_bucket.frontend
terraform state rm aws_cloudfront_distribution.cdn

echo "✅ Migration completed!"
echo "🔍 Run 'terraform plan' to verify no changes needed"
```

### 4. Verify Migration
```bash
# Run the migration script
chmod +x migration-script.sh
./migration-script.sh

# Verify no changes needed
terraform plan -var-file="../env/dev.tfvars"

# Should show "No changes. Your infrastructure matches the configuration."
```

## Post-Migration Validation

### 1. Test All Components
```bash
# Get new outputs
terraform output

# Test API
API_URL=$(terraform output -raw api_base_url)
curl "$API_URL/health"

# Test frontend
WEBSITE_URL=$(terraform output -raw website_url)
curl -I "$WEBSITE_URL"

# Check DynamoDB
TABLE_NAME=$(terraform output -raw trips_table_name)
aws dynamodb describe-table --table-name "$TABLE_NAME"
```

### 2. Update Deployment Scripts
```bash
# Update GitHub Actions workflow to use new outputs
# Edit .github/workflows/deploy-dev.yml:
# OLD: --function-name "daylight_trips_${ENVIRONMENT}"
# NEW: --function-name "$(terraform output -raw lambda_function_names.trips)"
```

### 3. Update Documentation
```bash
# Update deployment documentation with new resource names
# Update monitoring dashboards with new resource ARNs
# Update backup scripts with new table names
```

## Rollback Plan

If migration fails, you can rollback:

```bash
# 1. Stop any running operations
terraform force-unlock LOCK_ID  # if needed

# 2. Restore original configuration
mv main.tf.legacy main.tf
mv variables.tf.legacy variables.tf
rm outputs.tf

# 3. Restore state
cp terraform.tfstate.backup terraform.tfstate

# 4. Verify original state
terraform plan  # Should show no changes
```

## Common Migration Issues

### Issue 1: Resource Name Mismatches
```bash
# Error: resource names don't match between old and new config

# Solution: Use exact same names in modules
# Check current names:
terraform state show aws_lambda_function.trips | grep function_name

# Update module to use same name pattern
```

### Issue 2: Missing Dependencies
```bash
# Error: resource dependencies not captured in modules

# Solution: Import all related resources
terraform import "module.api.aws_iam_role.lambda_execution_role" "ROLE_NAME"
terraform import "module.api.aws_iam_role_policy_attachment.lambda_basic_execution" "ROLE_NAME/POLICY_ARN"
```

### Issue 3: State File Corruption
```bash
# Error: state file becomes corrupted during migration

# Solution: Use the backup
cp terraform.tfstate.pre-migration terraform.tfstate
# Start migration process again
```

## Migration Checklist

- [ ] Backend is built and zip files exist
- [ ] Current state is backed up
- [ ] Resource IDs are documented
- [ ] Migration script is tested
- [ ] Rollback plan is ready
- [ ] Team is notified of migration window
- [ ] Post-migration tests are prepared
- [ ] Documentation updates are planned

## Benefits After Migration

1. **Modularity**: Easier to manage and update individual components
2. **Reusability**: Modules can be reused across environments
3. **Maintainability**: Clearer separation of concerns
4. **Testing**: Each module can be tested independently
5. **Scalability**: Easier to add new features and environments
6. **Documentation**: Better organized and self-documenting code
