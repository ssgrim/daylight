#!/bin/bash

# Address High Priority Issues Script
# This script helps identify and fix common issues in the Daylight project

set -e

echo "🔍 Starting high priority issues check..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Checking project structure..."

# Check for nested router issues (excluding test files and main.tsx)
if grep -r "BrowserRouter" frontend/src/pages/ --include="*.tsx" | grep -v "main.tsx" | grep -v "test.tsx" | grep -q "BrowserRouter"; then
    print_warning "Found nested BrowserRouter usage (should only be in main.tsx)"
else
    print_status "✅ No nested BrowserRouter issues found"
fi

# Check TypeScript errors
print_status "Checking TypeScript errors..."
if command -v npx &> /dev/null; then
    if npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | grep -q "error"; then
        print_warning "TypeScript errors found in frontend"
        npx tsc --noEmit --project frontend/tsconfig.json || true
    else
        print_status "✅ No TypeScript errors in frontend"
    fi
else
    print_warning "npx not found, skipping TypeScript check"
fi

# Check for accessibility issues
print_status "Checking accessibility setup..."
if [ -f "frontend/src/pages/a11y.test.tsx" ]; then
    print_status "✅ Accessibility tests are configured"
else
    print_warning "Accessibility tests not found"
fi

# Check test configuration
print_status "Checking test configuration..."
if [ -f "jest.config.js" ] && [ -f "playwright.config.ts" ]; then
    print_status "✅ Test configurations are present"
else
    print_warning "Some test configurations missing"
fi

# Check for version mismatches
print_status "Checking for version mismatches..."
if [ -f "package.json" ] && [ -f "frontend/package.json" ]; then
    ROOT_REACT=$(grep '"react":' package.json | head -1 | sed 's/.*"react": "\([^"]*\)".*/\1/')
    FRONTEND_REACT=$(grep '"react":' frontend/package.json | head -1 | sed 's/.*"react": "\([^"]*\)".*/\1/')

    if [ "$ROOT_REACT" != "$FRONTEND_REACT" ]; then
        print_warning "React version mismatch: root=$ROOT_REACT, frontend=$FRONTEND_REACT"
    else
        print_status "✅ React versions match"
    fi
fi

# Check .gitignore
print_status "Checking .gitignore..."
if [ -f ".gitignore" ]; then
    if grep -q "node_modules" .gitignore && grep -q "dist" .gitignore; then
        print_status "✅ .gitignore looks good"
    else
        print_warning ".gitignore may be missing important entries"
    fi
else
    print_error ".gitignore file not found"
fi

# Run frontend tests if possible
print_status "Running frontend tests..."
if [ -d "frontend" ]; then
    cd frontend
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        if command -v npm &> /dev/null; then
            print_status "Running npm test..."
            npm test || print_warning "Tests failed - check test output above"
        else
            print_warning "npm not found, skipping tests"
        fi
    fi
    cd ..
fi

# Check for unused dependencies
print_status "Checking for potential issues..."
if command -v npx &> /dev/null; then
    if [ -f "frontend/package.json" ]; then
        cd frontend
        print_status "Checking for unused dependencies..."
        npx depcheck 2>/dev/null || print_warning "depcheck not available or failed"
        cd ..
    fi
fi

print_status "High priority issues check completed!"
echo ""
echo "Next steps:"
echo "1. Review any warnings above"
echo "2. Run 'npm run test' to execute test suites"
echo "3. Run 'npm run tsc' to check TypeScript errors"
echo "4. Consider running accessibility tests with proper axe setup"