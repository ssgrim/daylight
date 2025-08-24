# 🚀 Quick Deployment Reference

## GitHub Actions Automated Deployment

### One-Time Setup

1. **Run setup script**:
   ```powershell
   .\scripts\setup-github-actions.ps1 dev
   ```

2. **Add secrets to GitHub**:
   - Go to: `Settings > Secrets and variables > Actions`
   - Add all secrets from `github-secrets-dev.txt`
   - Get Mapbox token from https://account.mapbox.com/

3. **Test setup**:
   - Run "Test Deployment Setup" workflow manually
   - Verify all checks pass

### Automatic Deployment

**Triggers**: Push to `dev` branch
**Duration**: ~5-10 minutes
**Components**: Backend (Lambda) + Frontend (S3/CloudFront)

### Manual Deployment

```bash
# Option 1: GitHub Actions (Recommended)
git push origin dev

# Option 2: Local deployment
.\scripts\deploy-complete.ps1 dev

# Option 3: Individual components
npm run build                                    # Backend
aws lambda update-function-code --function-name daylight-trips-dev --zip-file fileb://dist/trips.zip

npm run build                                    # Frontend  
aws s3 sync dist/ s3://bucket-name/
aws cloudfront create-invalidation --distribution-id ID --paths "/*"
```

### Monitoring

- **GitHub Actions**: Repository → Actions tab
- **AWS Lambda**: CloudWatch logs `/aws/lambda/daylight-*`
- **Frontend**: `https://your-domain.com/env.json`
- **API Health**: `https://your-domain.com/api/health`

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Lambda update fails | Check function names match Terraform outputs |
| S3 upload fails | Verify bucket permissions and name |
| CloudFront invalidation fails | Check distribution ID |
| Smoke tests fail | Wait for propagation, check endpoints |

### Required Secrets

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DEV_API_BASE_URL
DEV_S3_BUCKET_NAME  
DEV_CLOUDFRONT_DISTRIBUTION_ID
DEV_DOMAIN_NAME
VITE_MAPBOX_TOKEN
```

### Deployment Flow

```
dev branch push → GitHub Actions → Build → Deploy → Test → ✅
```

1. **Backend**: Build TypeScript → Update Lambda functions
2. **Frontend**: Build React → Upload to S3 → Invalidate cache
3. **Verification**: Health checks on API and frontend
