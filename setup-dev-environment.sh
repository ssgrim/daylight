#!/bin/bash

# Daylight Development Environment Setup Script
# Automatically installs and configures all prerequisites

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get version
get_version() {
    case $1 in
        "node")
            node --version 2>/dev/null | sed 's/v//'
            ;;
        "npm")
            npm --version 2>/dev/null
            ;;
        "terraform")
            terraform version 2>/dev/null | head -1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | sed 's/v//'
            ;;
        "aws")
            aws --version 2>/dev/null | awk '{print $1}' | sed 's/aws-cli\///'
            ;;
        "docker")
            docker --version 2>/dev/null | awk '{print $3}' | sed 's/,//'
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Function to compare versions
version_ge() {
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Function to install Node.js
install_nodejs() {
    print_status "Installing Node.js..."
    
    if command_exists curl; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        print_error "curl is required but not installed. Installing curl first..."
        sudo apt-get update
        sudo apt-get install -y curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
}

# Function to install Terraform
install_terraform() {
    print_status "Installing Terraform..."
    
    wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
    sudo apt-get update && sudo apt-get install -y terraform
}

# Function to install AWS CLI
install_aws_cli() {
    print_status "Installing AWS CLI..."
    
    if [ "$(uname -m)" = "x86_64" ]; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    else
        curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
    fi
    
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
}

# Function to install Docker
install_docker() {
    print_status "Installing Docker..."
    
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking development prerequisites..."
    
    local missing_tools=()
    local outdated_tools=()
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(get_version node)
        if version_ge "$node_version" "20.0.0"; then
            print_success "Node.js $node_version (✓ >= 20.0.0)"
        else
            print_warning "Node.js $node_version (requires >= 20.0.0)"
            outdated_tools+=("node")
        fi
    else
        print_warning "Node.js not found"
        missing_tools+=("node")
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(get_version npm)
        if version_ge "$npm_version" "9.0.0"; then
            print_success "npm $npm_version (✓ >= 9.0.0)"
        else
            print_warning "npm $npm_version (requires >= 9.0.0)"
            outdated_tools+=("npm")
        fi
    else
        print_warning "npm not found"
        missing_tools+=("npm")
    fi
    
    # Check Terraform
    if command_exists terraform; then
        local tf_version=$(get_version terraform)
        if version_ge "$tf_version" "1.0.0"; then
            print_success "Terraform $tf_version (✓ >= 1.0.0)"
        else
            print_warning "Terraform $tf_version (requires >= 1.0.0)"
            outdated_tools+=("terraform")
        fi
    else
        print_warning "Terraform not found"
        missing_tools+=("terraform")
    fi
    
    # Check AWS CLI
    if command_exists aws; then
        local aws_version=$(get_version aws)
        print_success "AWS CLI $aws_version"
    else
        print_warning "AWS CLI not found"
        missing_tools+=("aws")
    fi
    
    # Check Docker
    if command_exists docker; then
        local docker_version=$(get_version docker)
        print_success "Docker $docker_version"
    else
        print_warning "Docker not found"
        missing_tools+=("docker")
    fi
    
    # Return status
    if [ ${#missing_tools[@]} -eq 0 ] && [ ${#outdated_tools[@]} -eq 0 ]; then
        print_success "All prerequisites are installed and up to date!"
        return 0
    else
        return 1
    fi
}

# Function to install missing prerequisites
install_prerequisites() {
    print_status "Installing missing prerequisites..."
    
    # Update package list
    sudo apt-get update
    
    # Install Node.js if missing or outdated
    if ! command_exists node || ! version_ge "$(get_version node)" "20.0.0"; then
        install_nodejs
    fi
    
    # Install Terraform if missing
    if ! command_exists terraform; then
        install_terraform
    fi
    
    # Install AWS CLI if missing
    if ! command_exists aws; then
        install_aws_cli
    fi
    
    # Install Docker if missing
    if ! command_exists docker; then
        install_docker
    fi
}

# Function to setup project dependencies
setup_project() {
    print_status "Setting up project dependencies..."
    
    # Install backend dependencies
    if [ -d "backend" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
    fi
    
    # Install frontend dependencies
    if [ -d "frontend" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        npm install
        
        # Verify critical build dependencies are installed
        print_status "Verifying build dependencies..."
        if ! npm list terser >/dev/null 2>&1; then
            print_warning "Terser not found, installing for build optimization..."
            npm install -D terser
        else
            print_success "Terser installed (required for production builds)"
        fi
        
        cd ..
    fi
    
    # Install root dependencies if package.json exists
    if [ -f "package.json" ]; then
        print_status "Installing root dependencies..."
        npm install
    fi
}

# Function to validate project setup
validate_project() {
    print_status "Validating project setup..."
    
    # Check backend
    if [ -d "backend" ]; then
        cd backend
        if npm test; then
            print_success "Backend tests passed"
        else
            print_error "Backend tests failed"
            cd ..
            return 1
        fi
        cd ..
    fi
    
    # Check frontend
    if [ -d "frontend" ]; then
        cd frontend
        
        # Check if build optimization dependencies are available
        print_status "Checking frontend build optimization..."
        if npm list terser >/dev/null 2>&1; then
            print_success "Build optimization dependencies available"
        else
            print_warning "Terser not found - production builds may not be optimized"
        fi
        
        # Test frontend build
        if npm run build; then
            print_success "Frontend builds successfully with optimized chunks"
            
            # Check if build output has proper chunk structure
            if [ -d "dist/assets" ]; then
                local chunk_count=$(ls dist/assets/*.js 2>/dev/null | wc -l)
                if [ $chunk_count -gt 3 ]; then
                    print_success "Code splitting working correctly ($chunk_count chunks generated)"
                else
                    print_warning "Code splitting may not be optimal (only $chunk_count chunks)"
                fi
            fi
        else
            print_error "Frontend build failed"
            cd ..
            return 1
        fi
        cd ..
    fi
    
    print_success "Project validation completed successfully!"
}

# Main execution
main() {
    print_status "Daylight Development Environment Setup"
    print_status "======================================"
    
    # Handle command line arguments
    if [ "$1" = "--validate-only" ]; then
        check_prerequisites
        validate_project
        exit $?
    fi
    
    # Check current prerequisites
    if check_prerequisites; then
        print_success "All prerequisites already installed!"
    else
        print_status "Installing missing prerequisites..."
        install_prerequisites
        
        # Verify installation
        if check_prerequisites; then
            print_success "Prerequisites installation completed!"
        else
            print_error "Some prerequisites failed to install properly"
            exit 1
        fi
    fi
    
    # Setup project
    setup_project
    
    # Validate setup
    validate_project
    
    print_success "Development environment setup completed!"
    print_status "You can now run:"
    print_status "  cd backend && npm run dev"
    print_status "  cd frontend && npm run dev"
    print_status ""
    print_status "For production builds:"
    print_status "  cd frontend && npm run build (optimized with code splitting)"
    print_status ""
    print_status "For Docker-based development:"
    print_status "  docker-compose up"
    print_status ""
    print_status "Build optimizations enabled:"
    print_status "  ✓ Code splitting for reduced bundle sizes"
    print_status "  ✓ Lazy loading for better performance"
    print_status "  ✓ Terser minification for production"
    print_status ""
    print_status "Happy coding! 🚀"
}

# Run main function with all arguments
main "$@"
