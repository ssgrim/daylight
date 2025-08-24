# GitHub Actions Deployment Setup Script (PowerShell)
# This script helps set up the AWS IAM user and gets the values needed for GitHub secrets

param(
    [string]$Environment = "dev",
    [string]$AwsRegion = "us-west-1",
    [string]$ProjectName = "daylight"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up GitHub Actions deployment for $ProjectName ($Environment)" -ForegroundColor Green
Write-Host "📍 Region: $AwsRegion" -ForegroundColor Cyan
Write-Host ""

# Create IAM user for GitHub Actions
$IamUserName = "github-actions-$ProjectName-$Environment"

Write-Host "👤 Creating IAM user: $IamUserName" -ForegroundColor Yellow
try {
    aws iam create-user --user-name $IamUserName --tags "Key=Project,Value=$ProjectName" "Key=Environment,Value=$Environment" "Key=Purpose,Value=GitHubActions"
    Write-Host "✅ User created successfully" -ForegroundColor Green
} catch {
    Write-Host "ℹ️  User might already exist, continuing..." -ForegroundColor Yellow
}

# Get AWS Account ID
$AccountId = aws sts get-caller-identity --query Account --output text
$PolicyArn = "arn:aws:iam::$AccountId`:policy/GitHubActions-$ProjectName-$Environment"

Write-Host "📋 Creating and attaching IAM policy..." -ForegroundColor Yellow
try {
    aws iam create-policy `
        --policy-name "GitHubActions-$ProjectName-$Environment" `
        --policy-document file://docs/github-actions-iam-policy.json `
        --description "Policy for GitHub Actions deployment of $ProjectName ($Environment)"
    Write-Host "✅ Policy created successfully" -ForegroundColor Green
} catch {
    Write-Host "ℹ️  Policy might already exist, continuing..." -ForegroundColor Yellow
}

aws iam attach-user-policy --user-name $IamUserName --policy-arn $PolicyArn
Write-Host "✅ Policy attached to user" -ForegroundColor Green

# Create access key
Write-Host "🔑 Creating access key..." -ForegroundColor Yellow
$AccessKeyOutput = aws iam create-access-key --user-name $IamUserName --output json | ConvertFrom-Json
$AccessKeyId = $AccessKeyOutput.AccessKey.AccessKeyId
$SecretAccessKey = $AccessKeyOutput.AccessKey.SecretAccessKey

Write-Host "✅ Access key created successfully" -ForegroundColor Green
Write-Host ""

# Get Terraform outputs
Write-Host "📊 Getting Terraform outputs..." -ForegroundColor Yellow
Push-Location "infra\terraform"

if (-not (Test-Path "terraform.tfstate")) {
    Write-Host "❌ Terraform state not found. Please run 'terraform apply' first." -ForegroundColor Red
    Pop-Location
    exit 1
}

try {
    $ApiBaseUrl = terraform output -raw api_base_url 2>$null
    $S3BucketName = terraform output -raw s3_bucket_name 2>$null
    $CloudFrontDistributionId = terraform output -raw cloudfront_distribution_id 2>$null
    $WebsiteUrl = terraform output -raw website_url 2>$null
} catch {
    Write-Host "⚠️  Some Terraform outputs might be missing" -ForegroundColor Yellow
    $ApiBaseUrl = ""
    $S3BucketName = ""
    $CloudFrontDistributionId = ""
    $WebsiteUrl = ""
}

Pop-Location

# Extract domain from website URL
if ($WebsiteUrl) {
    $DomainName = $WebsiteUrl -replace "https://", ""
} else {
    $DomainName = ""
}

Write-Host "✅ Terraform outputs retrieved" -ForegroundColor Green
Write-Host ""

# Display all the values for GitHub secrets
Write-Host "🎯 GitHub Secrets Configuration" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add these secrets to your GitHub repository:" -ForegroundColor White
Write-Host "Repository Settings > Secrets and variables > Actions > New repository secret" -ForegroundColor Gray
Write-Host ""

Write-Host "AWS Credentials:" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow
Write-Host "AWS_ACCESS_KEY_ID: $AccessKeyId" -ForegroundColor White
Write-Host "AWS_SECRET_ACCESS_KEY: $SecretAccessKey" -ForegroundColor White
Write-Host ""

Write-Host "Development Environment:" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow
Write-Host "DEV_API_BASE_URL: $ApiBaseUrl" -ForegroundColor White
Write-Host "DEV_S3_BUCKET_NAME: $S3BucketName" -ForegroundColor White
Write-Host "DEV_CLOUDFRONT_DISTRIBUTION_ID: $CloudFrontDistributionId" -ForegroundColor White
Write-Host "DEV_DOMAIN_NAME: $DomainName" -ForegroundColor White
Write-Host ""

Write-Host "Application Secrets:" -ForegroundColor Yellow
Write-Host "-------------------" -ForegroundColor Yellow
Write-Host "VITE_MAPBOX_TOKEN: [YOUR_MAPBOX_TOKEN]" -ForegroundColor White
Write-Host ""

# Create a secrets file for reference
$SecretsFileName = "github-secrets-$Environment.txt"
$SecretsContent = @"
# GitHub Secrets for $ProjectName ($Environment)
# Generated on $(Get-Date)

AWS_ACCESS_KEY_ID=$AccessKeyId
AWS_SECRET_ACCESS_KEY=$SecretAccessKey

DEV_API_BASE_URL=$ApiBaseUrl
DEV_S3_BUCKET_NAME=$S3BucketName
DEV_CLOUDFRONT_DISTRIBUTION_ID=$CloudFrontDistributionId
DEV_DOMAIN_NAME=$DomainName

VITE_MAPBOX_TOKEN=[YOUR_MAPBOX_TOKEN]
"@

$SecretsContent | Out-File -FilePath $SecretsFileName -Encoding UTF8

Write-Host "📝 Secrets saved to: $SecretsFileName" -ForegroundColor Cyan
Write-Host ""

# Validation
Write-Host "🔍 Validation" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan

$AllGood = $true

if (-not $ApiBaseUrl) {
    Write-Host "⚠️  Warning: API_BASE_URL is empty. Check Terraform outputs." -ForegroundColor Yellow
    $AllGood = $false
}

if (-not $S3BucketName) {
    Write-Host "⚠️  Warning: S3_BUCKET_NAME is empty. Check Terraform outputs." -ForegroundColor Yellow
    $AllGood = $false
}

if (-not $CloudFrontDistributionId) {
    Write-Host "⚠️  Warning: CLOUDFRONT_DISTRIBUTION_ID is empty. Check Terraform outputs." -ForegroundColor Yellow
    $AllGood = $false
}

if ($AllGood) {
    Write-Host "✅ All required values found!" -ForegroundColor Green
} else {
    Write-Host "❌ Some values are missing. Please check your Terraform deployment." -ForegroundColor Red
}

Write-Host ""
Write-Host "🔧 Next Steps" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host "1. Add the secrets above to your GitHub repository" -ForegroundColor White
Write-Host "2. Get a Mapbox token from https://account.mapbox.com/" -ForegroundColor White
Write-Host "3. Push to the 'dev' branch to trigger deployment" -ForegroundColor White
Write-Host "4. Monitor the deployment in GitHub Actions" -ForegroundColor White
Write-Host ""

Write-Host "🔗 Useful Links" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host "• GitHub Secrets: https://github.com/YOUR_USERNAME/daylight/settings/secrets/actions" -ForegroundColor White
Write-Host "• AWS Console: https://console.aws.amazon.com/" -ForegroundColor White
Write-Host "• Mapbox Tokens: https://account.mapbox.com/access-tokens/" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  Security Notes" -ForegroundColor Red
Write-Host "==================" -ForegroundColor Red
Write-Host "• Store the $SecretsFileName file securely" -ForegroundColor White
Write-Host "• Do not commit secrets to version control" -ForegroundColor White
Write-Host "• Rotate access keys regularly" -ForegroundColor White
Write-Host "• Delete the secrets file after adding them to GitHub" -ForegroundColor White

Write-Host ""
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
