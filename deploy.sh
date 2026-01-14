#!/bin/bash
# ===========================================
# PHYSICAL-FINANCIAL RISK PLATFORM
# Deployment Script for risk.saa-alliance.com
# ===========================================

set -e

echo "🚀 Starting deployment..."

# Configuration
SERVER_HOST="173.212.208.123"
SERVER_PORT="32769"
SERVER_USER="arin"
PROJECT_DIR="/home/arin/global-risk-platform"
DOMAIN="risk.saa-alliance.com"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Cleaning old project on server...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~
rm -rf global-risk-platform 2>/dev/null || true
echo "Old project removed"
ENDSSH

echo -e "${YELLOW}Step 2: Copying project to server...${NC}"
# Create tarball excluding node_modules and other large files
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='dev.db' \
    --exclude='.env' \
    -czf /tmp/pfrp-deploy.tar.gz -C "$(dirname "$0")" .

# Copy to server
scp -P $SERVER_PORT /tmp/pfrp-deploy.tar.gz $SERVER_USER@$SERVER_HOST:~/

echo -e "${YELLOW}Step 3: Extracting and setting up on server...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~
mkdir -p global-risk-platform
tar -xzf pfrp-deploy.tar.gz -C global-risk-platform
rm pfrp-deploy.tar.gz
cd global-risk-platform
echo "Project extracted"

# Create .env file for production
cat > apps/api/.env << 'EOF'
DATABASE_URL=sqlite:///./prod.db
USE_SQLITE=true
DEBUG=false
CORS_ORIGINS=["https://risk.saa-alliance.com","http://localhost:5180"]
NVIDIA_API_KEY=
NVIDIA_LLM_API_KEY=
EOF

echo "Environment configured"
ENDSSH

echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Backend
cd apps/api
python3 -m venv .venv 2>/dev/null || python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e . --quiet
echo "Backend dependencies installed"

# Frontend
cd ../web
npm install --silent
npm run build
echo "Frontend built"
ENDSSH

echo -e "${YELLOW}Step 5: Starting services...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Kill existing processes
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "npm run preview" 2>/dev/null || true

# Start backend
cd apps/api
source .venv/bin/activate
nohup USE_SQLITE=true python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
echo "Backend started on port 9002"

# Start frontend (production build)
cd ../web
nohup npm run preview -- --host 0.0.0.0 --port 5180 > /tmp/web.log 2>&1 &
echo "Frontend started on port 5180"
ENDSSH

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "🌐 Frontend: https://risk.saa-alliance.com"
echo "🔌 API: https://risk.saa-alliance.com/api"
echo ""
echo "To check logs:"
echo "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/api.log'"
echo "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/web.log'"
