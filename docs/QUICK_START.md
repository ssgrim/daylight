# Daylight Quick Setup Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites Check

```bash
# Verify required tools are installed
node --version    # Should be 20.x or later
npm --version     # Should be 10.x or later
aws --version     # Should be 2.x
terraform --version # Should be 1.6.0 or later
```

### 1. Clone and Install

```bash
git clone https://github.com/your-org/daylight.git
cd daylight
npm install
```

### 2. Configure Environment

```bash
# Copy environment templates
cp env.dev.json.template env.dev.json
cp frontend/env.dev.template frontend/.env.local
cp infra/env/dev.tfvars.template infra/env/dev.tfvars

# Edit with your values (required: API keys, AWS region)
# - Google Places API key
# - Mapbox access token (optional)
# - AWS region preference
```

### 3. Deploy to AWS

```bash
# Configure AWS credentials
aws configure

# Deploy infrastructure
cd infra/terraform
terraform init
terraform apply -var-file="../env/dev.tfvars"

# Get API endpoint
terraform output api_url
```

### 4. Start Development

```bash
# Update frontend config with API URL from step 3
# Edit frontend/.env.local -> VITE_API_BASE

# Start development server
cd ../../frontend
npm run dev

# Open http://localhost:5173
```

## 📋 Environment Variables Checklist

### Required Variables

- [ ] `GOOGLE_PLACES_API_KEY` - For location search
- [ ] `AWS_REGION` - Your preferred AWS region
- [ ] `VITE_API_BASE` - API Gateway URL from Terraform output

### Optional Variables

- [ ] `VITE_MAPBOX_TOKEN` - For enhanced maps (fallback available)
- [ ] `VITE_SENTRY_DSN` - For error tracking
- [ ] Custom domain configurations

## 🏗️ Architecture at a Glance

```text
[Browser] → [CloudFront] → [S3 + API Gateway] → [Lambda] → [DynamoDB]
                ↓                ↓                ↓         ↓
           Static Files      REST API      Business Logic  Data Store
```

## 🔧 Common Commands

### Development

```bash
npm run dev              # Start frontend dev server
npm run build           # Build all components
npm test                # Run all tests
npm run lint            # Check code quality
```

### Deployment

```bash
terraform plan          # Preview infrastructure changes
terraform apply         # Deploy infrastructure
npm run deploy:dev      # Deploy application code
npm run deploy:prod     # Deploy to production
```

### Monitoring

```bash
aws logs tail /aws/lambda/daylight-dev-plan --follow  # Watch Lambda logs
terraform output        # Show deployed resources
npm run smoke          # Run smoke tests
```

## 🐛 Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Build failures | `npm run clean && npm install && npm run build` |
| API 502 errors | Check CloudWatch logs: `aws logs tail /aws/lambda/function-name` |
| CORS errors | Verify `cors_configuration` in Terraform |
| Map not loading | Check `VITE_MAPBOX_TOKEN` or use fallback |

## 📖 Documentation Links

- [Complete Onboarding Guide](./ONBOARDING.md)
- [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

## 🆘 Getting Help

1. **Check Documentation** - Most questions are answered in `/docs`
2. **Review Logs** - CloudWatch has detailed error information
3. **Check Issues** - Common problems have solutions in GitHub issues
4. **Contact Team** - Reach out to the development team

---

**Next Steps**: Once setup is complete, see [ONBOARDING.md](./ONBOARDING.md) for detailed configuration options and [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) for system understanding.
