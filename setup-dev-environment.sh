#!/bin/bash

# Daylight Travel Planning Application - Development Environment Setup
# This script installs all required prerequisites for development
# Run this script on any new development machine to set up the environment

set -e

echo "🚀 Setting up Daylight development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root is not recommended for development"
fi

# Update package lists
echo "📦 Updating package lists..."
sudo apt update

# Install essential build tools
echo "🔧 Installing essential build tools..."
sudo apt install -y \
    curl \
    wget \
    unzip \
    git \
    build-essential \
    python3-pip \
    ca-certificates \
    gnupg \
    lsb-release

# Install Node.js (using NodeSource repository for latest LTS)
echo "📱 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js $(node --version) installed"
else
    print_status "Node.js $(node --version) already installed"
fi

# Install npm (usually comes with Node.js)
if ! command -v npm &> /dev/null; then
    sudo apt install -y npm
    print_status "npm $(npm --version) installed"
else
    print_status "npm $(npm --version) already installed"
fi

# Install Terraform
echo "🏗️ Installing Terraform..."
if ! command -v terraform &> /dev/null; then
    curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
    sudo apt update
    sudo apt install -y terraform
    print_status "Terraform $(terraform --version | head -n1) installed"
else
    print_status "Terraform $(terraform --version | head -n1) already installed"
fi

# Install AWS CLI v2
echo "☁️ Installing AWS CLI v2..."
if ! command -v aws &> /dev/null; then
    cd /tmp
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    print_status "AWS CLI $(aws --version | cut -d' ' -f1) installed"
else
    print_status "AWS CLI $(aws --version | cut -d' ' -f1) already installed"
fi

# Install Docker (optional but recommended)
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group (requires logout/login)
    sudo usermod -aG docker $USER
    print_status "Docker installed (logout/login required for non-root access)"
else
    print_status "Docker already installed"
fi

# Install project dependencies
echo "📚 Installing project dependencies..."

# Backend dependencies
if [ -f "backend/package.json" ]; then
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_status "Backend dependencies installed"
else
    print_warning "backend/package.json not found, skipping backend dependencies"
fi

# Frontend dependencies
if [ -f "frontend/package.json" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    print_status "Frontend dependencies installed"
else
    print_warning "frontend/package.json not found, skipping frontend dependencies"
fi

# Initialize Terraform (if terraform directory exists)
if [ -d "infra/terraform" ]; then
    echo "🏗️ Initializing Terraform..."
    cd infra/terraform
    terraform init
    cd ../..
    print_status "Terraform initialized"
else
    print_warning "infra/terraform directory not found, skipping Terraform init"
fi

# Create environment files from templates (if they don't exist)
echo "⚙️ Setting up environment configuration..."

# Backend environment
if [ ! -f "backend/.env" ] && [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    print_status "Created backend/.env from template"
fi

# Frontend environment
if [ ! -f "frontend/.env" ] && [ -f "frontend/.env.example" ]; then
    cp frontend/.env.example frontend/.env
    print_status "Created frontend/.env from template"
fi

# Build projects to verify setup
echo "🔨 Building projects to verify setup..."

# Build backend
if [ -f "backend/package.json" ]; then
    cd backend
    if npm run build; then
        print_status "Backend build successful"
    else
        print_error "Backend build failed"
    fi
    cd ..
fi

# Build frontend
if [ -f "frontend/package.json" ]; then
    cd frontend
    if npm run build; then
        print_status "Frontend build successful"
    else
        print_error "Frontend build failed"
    fi
    cd ..
fi

# Validate Terraform configuration
if [ -d "infra/terraform" ]; then
    cd infra/terraform
    if terraform validate; then
        print_status "Terraform configuration valid"
    else
        print_error "Terraform configuration invalid"
    fi
    cd ../..
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Summary of installed tools:"
echo "   • Node.js: $(node --version)"
echo "   • npm: $(npm --version)"
echo "   • Terraform: $(terraform --version | head -n1)"
echo "   • AWS CLI: $(aws --version | cut -d' ' -f1)"
echo "   • Docker: $(docker --version 2>/dev/null || echo 'Not available')"
echo ""
echo "🚀 Next steps:"
echo "   1. Configure AWS credentials: aws configure"
echo "   2. Set up API keys in environment files"
echo "   3. Start development: npm run dev (in backend/frontend directories)"
echo ""
echo "📖 For more information, see:"
echo "   • README.md - Project overview and setup"
echo "   • docs/ - Detailed documentation"
echo "   • package.json - Available npm scripts"
echo ""

# Check for any missing dependencies
echo "🔍 Checking for potential issues..."

# Check if user needs to logout for Docker
if groups $USER | grep -q docker; then
    print_status "Docker group membership configured"
else
    print_warning "Logout/login required for Docker access without sudo"
fi

# Check Git configuration
if [ -z "$(git config --global user.name)" ] || [ -z "$(git config --global user.email)" ]; then
    print_warning "Git user configuration not set. Run:"
    echo "   git config --global user.name 'Your Name'"
    echo "   git config --global user.email 'your.email@example.com'"
fi

echo ""
print_status "Setup script completed successfully!"
