# Complete deployment script for Daylight application (PowerShell)
# Usage: .\deploy-complete.ps1 <environment> [-SkipBuild] [-SkipInvalidate]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "dev",
    
    [switch]$SkipBuild,
    [switch]$SkipInvalidate
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Load environment-specific configuration
switch ($Environment) {
    "dev" {
        $BucketName = if ($env:DAYLIGHT_DEV_BUCKET) { $env:DAYLIGHT_DEV_BUCKET } else { "daylight-frontend-dev" }
        $DistributionId = $env:DAYLIGHT_DEV_DISTRIBUTION_ID
        $ApiBaseUrl = if ($env:DAYLIGHT_DEV_API_BASE) { $env:DAYLIGHT_DEV_API_BASE } else { "https://api-dev.daylight.app" }
    }
    "prod" {
        $BucketName = if ($env:DAYLIGHT_PROD_BUCKET) { $env:DAYLIGHT_PROD_BUCKET } else { "daylight-frontend-prod" }
        $DistributionId = $env:DAYLIGHT_PROD_DISTRIBUTION_ID
        $ApiBaseUrl = if ($env:DAYLIGHT_PROD_API_BASE) { $env:DAYLIGHT_PROD_API_BASE } else { "https://api.daylight.app" }
    }
}

Write-Host "🚀 Starting deployment to $Environment environment" -ForegroundColor Green
Write-Host "📦 S3 Bucket: $BucketName" -ForegroundColor Cyan
Write-Host "🌐 CloudFront Distribution: $DistributionId" -ForegroundColor Cyan
Write-Host "🔗 API Base URL: $ApiBaseUrl" -ForegroundColor Cyan
Write-Host ""

# Validate required environment variables
if (-not $DistributionId) {
    Write-Host "⚠️  Warning: DISTRIBUTION_ID not set. Cache invalidation will be skipped." -ForegroundColor Yellow
}

# Build frontend (unless skipped)
if (-not $SkipBuild) {
    Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
    Push-Location "frontend"
    
    try {
        # Install dependencies if node_modules doesn't exist
        if (-not (Test-Path "node_modules")) {
            Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
            npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
        }
        
        # Build for production
        Write-Host "🏗️  Building production bundle..." -ForegroundColor Cyan
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
        
        Write-Host "✅ Frontend build completed" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "⏭️  Skipping build (-SkipBuild specified)" -ForegroundColor Yellow
}

# Update env.json with correct API base URL
Write-Host "⚙️  Updating runtime configuration..." -ForegroundColor Yellow

$GitCommit = try { git rev-parse --short HEAD 2>$null } catch { "unknown" }
$BuildTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$EnvConfig = @{
    VITE_API_BASE = $ApiBaseUrl
    ENVIRONMENT = $Environment
    BUILD_TIME = $BuildTime
    VERSION = $GitCommit
} | ConvertTo-Json -Depth 2

$EnvConfig | Out-File -FilePath "frontend\dist\env.json" -Encoding UTF8 -NoNewline

Write-Host "📝 Runtime configuration updated:" -ForegroundColor Cyan
Write-Host $EnvConfig
Write-Host ""

# Upload to S3
Write-Host "☁️  Uploading to S3..." -ForegroundColor Yellow

# Upload static assets with 1-year cache
Write-Host "📂 Uploading static assets (with 1-year cache)..." -ForegroundColor Cyan
$AssetExtensions = @("*.js", "*.css", "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.woff", "*.woff2")

foreach ($Extension in $AssetExtensions) {
    $AssetFiles = Get-ChildItem -Path "frontend\dist\assets" -Filter $Extension -Recurse
    foreach ($File in $AssetFiles) {
        $Key = "assets/" + $File.Name
        aws s3 cp $File.FullName "s3://$BucketName/$Key" --cache-control "public, max-age=31536000, immutable"
        if ($LASTEXITCODE -ne 0) { throw "Failed to upload $($File.Name)" }
    }
}

# Upload HTML with short cache
Write-Host "📄 Uploading HTML and config files (with short cache)..." -ForegroundColor Cyan
aws s3 cp "frontend\dist\index.html" "s3://$BucketName/" --cache-control "public, max-age=300, must-revalidate"
if ($LASTEXITCODE -ne 0) { throw "Failed to upload index.html" }

aws s3 cp "frontend\dist\env.json" "s3://$BucketName/" --cache-control "no-cache, no-store, must-revalidate"
if ($LASTEXITCODE -ne 0) { throw "Failed to upload env.json" }

# Upload other files
Write-Host "📋 Uploading manifest and other files..." -ForegroundColor Cyan
$OtherFiles = Get-ChildItem -Path "frontend\dist" -File | Where-Object { 
    $_.Name -ne "index.html" -and $_.Name -ne "env.json" -and $_.DirectoryName -notlike "*assets*" 
}

foreach ($File in $OtherFiles) {
    aws s3 cp $File.FullName "s3://$BucketName/$($File.Name)" --cache-control "public, max-age=3600"
    if ($LASTEXITCODE -ne 0) { throw "Failed to upload $($File.Name)" }
}

Write-Host "✅ S3 upload completed" -ForegroundColor Green

# Invalidate CloudFront cache (unless skipped)
if (-not $SkipInvalidate -and $DistributionId) {
    Write-Host "🔄 Invalidating CloudFront cache..." -ForegroundColor Yellow
    
    # Create invalidation
    $InvalidationId = aws cloudfront create-invalidation `
        --distribution-id $DistributionId `
        --paths "/index.html" "/env.json" "/*" `
        --query 'Invalidation.Id' `
        --output text
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Invalidation created successfully!" -ForegroundColor Green
        Write-Host "📋 Invalidation ID: $InvalidationId" -ForegroundColor Cyan
        Write-Host "🕒 Status: In Progress" -ForegroundColor Cyan
        
        # Option to wait for completion
        $WaitResponse = Read-Host "⏳ Wait for invalidation to complete? (y/N)"
        
        if ($WaitResponse -eq "y" -or $WaitResponse -eq "Y") {
            Write-Host "⏳ Waiting for invalidation to complete..." -ForegroundColor Yellow
            aws cloudfront wait invalidation-completed --distribution-id $DistributionId --id $InvalidationId
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Cache invalidation completed successfully!" -ForegroundColor Green
            } else {
                Write-Host "❌ Error waiting for invalidation completion" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "ℹ️  You can check the status with:" -ForegroundColor Cyan
            Write-Host "   aws cloudfront get-invalidation --distribution-id $DistributionId --id $InvalidationId" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Failed to create invalidation" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⏭️  Skipping cache invalidation" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host "  S3 Bucket: $BucketName" -ForegroundColor White
Write-Host "  API Base: $ApiBaseUrl" -ForegroundColor White
Write-Host "  Build Time: $(Get-Date)" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Application URLs:" -ForegroundColor Cyan
switch ($Environment) {
    "dev" {
        Write-Host "  Frontend: https://dev.daylight.app" -ForegroundColor White
        Write-Host "  API: $ApiBaseUrl" -ForegroundColor White
    }
    "prod" {
        Write-Host "  Frontend: https://daylight.app" -ForegroundColor White
        Write-Host "  API: $ApiBaseUrl" -ForegroundColor White
    }
}
Write-Host ""
Write-Host "📚 Next steps:" -ForegroundColor Cyan
Write-Host "  • Test the deployment: npm run test:e2e" -ForegroundColor White
Write-Host "  • Monitor CloudFront metrics in AWS Console" -ForegroundColor White
Write-Host "  • Check application logs if needed" -ForegroundColor White
