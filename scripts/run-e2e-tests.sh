#!/bin/bash

# Local E2E test runner script
# This script mimics what runs in CI for local testing

set -e

echo "🚀 Starting local E2E test run..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
  echo -e "\n🧹 Cleaning up..."
  if [ -f backend.pid ]; then
    echo "Stopping backend server..."
    kill $(cat backend.pid) 2>/dev/null || true
    rm backend.pid
  fi
  if [ -f frontend.pid ]; then
    echo "Stopping frontend server..."
    kill $(cat frontend.pid) 2>/dev/null || true  
    rm frontend.pid
  fi
}

trap cleanup EXIT

# Change to project root
cd "$(dirname "$0")"

echo "📂 Current directory: $(pwd)"

# Install dependencies
echo -e "\n📦 Installing backend dependencies..."
cd backend
npm install

echo -e "\n📦 Installing frontend dependencies..."
cd ../frontend
npm install

# Install Playwright browsers if not already installed
echo -e "\n🎭 Installing Playwright browsers..."
npx playwright install

# Start backend server
echo -e "\n🔧 Starting backend dev server..."
cd ../backend
npm run dev &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

# Wait for backend to be ready
echo "⏳ Waiting for backend server to start..."
timeout 30 bash -c 'until curl -f http://localhost:3000/health 2>/dev/null; do sleep 1; done' || {
  echo -e "${RED}❌ Backend failed to start${NC}"
  exit 1
}

echo -e "${GREEN}✅ Backend server ready${NC}"

# Set environment variable for frontend
export VITE_API_BASE="http://localhost:3000"

# Run the tests
echo -e "\n🧪 Running Playwright tests..."
cd ../frontend

if npm run test; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Tests failed${NC}"
  echo -e "\n📊 Test artifacts available in:"
  echo -e "  - playwright-report/ (HTML report)"
  echo -e "  - test-results/ (screenshots, traces)"
  exit 1
fi
