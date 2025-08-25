# Daylight Development Environment

## Prerequisites & Setup

This document outlines all software prerequisites and setup procedures for the Daylight travel planning application.

### 🛠️ Required Software

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Node.js** | v22.17.0+ | JavaScript runtime for frontend/backend | Auto-installed by setup script |
| **npm** | v9.8.1+ | Package manager | Comes with Node.js |
| **Terraform** | v1.13.0+ | Infrastructure as Code | Auto-installed by setup script |
| **AWS CLI** | v2.28.16+ | AWS cloud management | Auto-installed by setup script |
| **Git** | Latest | Version control | Usually pre-installed |
| **Docker** | Latest | Containerization (optional) | Auto-installed by setup script |

### 🚀 Quick Setup

Run the automated setup script on any new development machine:

```bash
# Clone the repository
git clone <repository-url>
cd daylight

# Run the setup script (installs all prerequisites)
./setup-dev-environment.sh
```

### 📋 Manual Setup (Alternative)

If you prefer manual installation:

#### 1. Install Node.js
```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Install Terraform
```bash
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

#### 3. Install AWS CLI v2
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip
```

#### 4. Install Project Dependencies
```bash
# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies
cd frontend && npm install && cd ..

# Initialize Terraform
cd infra/terraform && terraform init && cd ../..
```

### ⚙️ Configuration

#### 1. AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, region, and output format
```

#### 2. Environment Variables
Create `.env` files in both `backend/` and `frontend/` directories:

**backend/.env:**
```bash
# API Keys (obtain from respective services)
MAPBOX_TOKEN=your_mapbox_token_here
GOOGLE_MAPS_KEY=your_google_maps_key_here

# Optional: AWS Secrets Manager ARNs for production
MAPBOX_SECRET_ARN=arn:aws:secretsmanager:region:account:secret:name
```

**frontend/.env:**
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

#### 3. Terraform Variables
Create `terraform.tfvars` in `infra/terraform/`:
```hcl
# Development configuration
region = "us-west-1"
allowed_origins = ["http://localhost:5173", "http://localhost:4173"]
enable_deletion_protection = false
env = "dev"
alert_email = "your-email@example.com"  # Optional: for CloudWatch alerts
```

### 🏗️ Development Workflow

#### Backend Development
```bash
cd backend

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

#### Frontend Development
```bash
cd frontend

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

#### Infrastructure Management
```bash
cd infra/terraform

# Plan infrastructure changes
terraform plan

# Apply infrastructure changes
terraform apply

# Destroy infrastructure (careful!)
terraform destroy
```

### 🧪 Testing & Validation

#### Verify Installation
```bash
# Check tool versions
node --version    # Should be v22.17.0+
npm --version     # Should be v9.8.1+
terraform version # Should be v1.13.0+
aws --version     # Should be v2.28.16+

# Test builds
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
cd infra/terraform && terraform validate && cd ../..
```

#### Run Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests (if available)
cd frontend && npm test

# Terraform validation
cd infra/terraform && terraform validate
```

### 🔧 IDE Configuration

#### Recommended VS Code Extensions
- **TypeScript**: Language support
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **HashiCorp Terraform**: Terraform support
- **AWS Toolkit**: AWS integration
- **GitLens**: Git enhancement

#### VS Code Settings (`.vscode/settings.json`)
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "terraform.validate.enabled": true,
  "aws.telemetry": false
}
```

### 🚨 Security Considerations

#### API Keys & Secrets
- **Never commit API keys** to version control
- Use environment variables or AWS Secrets Manager
- Rotate keys regularly
- Use least-privilege AWS IAM policies

#### Development vs Production
- Use different AWS accounts for dev/prod
- Enable deletion protection in production
- Configure proper CORS origins
- Enable CloudWatch monitoring and alerting

### 📊 Monitoring & Debugging

#### Development Logs
```bash
# Backend logs
cd backend && npm run dev  # Logs to console

# Frontend logs
cd frontend && npm run dev  # Check browser console

# AWS CloudWatch (production)
aws logs tail /aws/lambda/daylight_plan_<suffix> --follow
```

#### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Permission denied on Docker | Add user to docker group: `sudo usermod -aG docker $USER` |
| Terraform init fails | Check AWS credentials: `aws sts get-caller-identity` |
| Node modules not found | Run `npm install` in respective directory |
| Build fails | Check Node.js version: `node --version` |
| CORS errors | Update `allowed_origins` in Terraform configuration |

### 🔄 CI/CD Integration

The project is configured for automated deployment:

#### GitHub Actions (if configured)
- Runs tests on pull requests
- Deploys to staging on merge to `develop`
- Deploys to production on merge to `main`

#### Required Secrets
Set these in your CI/CD environment:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `MAPBOX_TOKEN`
- `GOOGLE_MAPS_KEY`

### 📚 Additional Resources

- [AWS CLI Configuration Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
- [Terraform Getting Started](https://learn.hashicorp.com/tutorials/terraform/install-cli)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### 🆘 Getting Help

1. Check this documentation first
2. Review error logs and console output
3. Search existing issues in the repository
4. Create a new issue with detailed error information
5. Contact the development team

---

**Last Updated:** August 25, 2025  
**Maintained By:** Development Team
