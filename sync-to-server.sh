#!/bin/bash
# ===========================================
# SYNCHRONIZE LOCAL VERSION TO SERVER
# Syncs current working local version to production server
# ===========================================

set -e

echo "🔄 Synchronizing local version to server..."

# Configuration
SERVER_HOST="contabo"  # Use SSH alias from ~/.ssh/config
SERVER_PORT="32769"
SERVER_USER="arin"
PROJECT_DIR="/home/arin/global-risk-platform"
DOMAIN="risk.saa-alliance.com"
SSH_OPTS=""  # Use SSH config settings from alias

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "deploy.sh" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Current local version status:${NC}"
echo "   Local URL: http://localhost:5180/command"
echo "   Server URL: https://${DOMAIN}"
echo ""

# Step 1: Create deployment package
echo -e "${YELLOW}Step 1: Creating deployment package...${NC}"
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='dev.db' \
    --exclude='*.db' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='backup_*.tar.gz' \
    --exclude='*.log' \
    --exclude='dist' \
    --exclude='build' \
    -czf /tmp/pfrp-sync-$(date +%Y%m%d_%H%M%S).tar.gz \
    -C "$(pwd)" .

DEPLOY_TAR="/tmp/pfrp-sync-$(date +%Y%m%d_%H%M%S).tar.gz"
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='dev.db' \
    --exclude='*.db' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='backup_*.tar.gz' \
    --exclude='*.log' \
    --exclude='dist' \
    --exclude='build' \
    -czf "$DEPLOY_TAR" \
    -C "$(pwd)" .

echo -e "${GREEN}✅ Package created: $(basename $DEPLOY_TAR)${NC}"

# Step 2: Backup current server version
echo -e "${YELLOW}Step 2: Backing up current server version...${NC}"
ssh $SSH_OPTS $SERVER_HOST << ENDSSH
cd ~
if [ -d "global-risk-platform" ]; then
    tar -czf global-risk-platform-backup-$(date +%Y%m%d_%H%M%S).tar.gz global-risk-platform 2>/dev/null || true
    echo "Server backup created"
else
    echo "No existing project to backup"
fi
ENDSSH

# Step 3: Copy new version to server
echo -e "${YELLOW}Step 3: Copying new version to server...${NC}"
scp $SSH_OPTS "$DEPLOY_TAR" $SERVER_HOST:~/

# Step 4: Extract and setup on server
echo -e "${YELLOW}Step 4: Extracting and setting up on server...${NC}"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~
rm -rf global-risk-platform 2>/dev/null || true
mkdir -p global-risk-platform
tar -xzf pfrp-sync-*.tar.gz -C global-risk-platform
rm pfrp-sync-*.tar.gz
cd global-risk-platform
echo "Project extracted"

# Create .env file for production (preserve existing if needed)
if [ ! -f "apps/api/.env" ]; then
    cat > apps/api/.env << 'EOF'
DATABASE_URL=sqlite:///./prod.db
USE_SQLITE=true
DEBUG=false
CORS_ORIGINS=["https://risk.saa-alliance.com","http://localhost:5180"]
NVIDIA_API_KEY=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
NVIDIA_LLM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_FOURCASTNET_API_KEY=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
NVIDIA_FLUX_API_KEY=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
NGC_API_KEY=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
NVIDIA_MODE=cloud
# Optional: External API keys (clients work without them using fallback data)
NOAA_API_TOKEN=uUrbXwtEvXGZLOMupmiVucEARZieKgeS
# CDS_API_KEY=your_copernicus_key_here
EOF
    echo "Environment file created"
else
    echo "Environment file already exists, preserving it"
    # Add new optional variables if they don't exist
    if ! grep -q "NOAA_API_TOKEN" apps/api/.env; then
        echo "" >> apps/api/.env
        echo "# Optional: External API keys (added $(date +%Y-%m-%d))" >> apps/api/.env
        echo "NOAA_API_TOKEN=uUrbXwtEvXGZLOMupmiVucEARZieKgeS" >> apps/api/.env
        echo "# CDS_API_KEY=your_copernicus_key_here" >> apps/api/.env
        echo "NOAA API token added"
    else
        # Update existing NOAA_API_TOKEN if it's commented out or has placeholder
        sed -i 's/^# NOAA_API_TOKEN=.*/NOAA_API_TOKEN=uUrbXwtEvXGZLOMupmiVucEARZieKgeS/' apps/api/.env
        sed -i 's/^NOAA_API_TOKEN=.*/NOAA_API_TOKEN=uUrbXwtEvXGZLOMupmiVucEARZieKgeS/' apps/api/.env
        echo "NOAA API token updated"
    fi
fi
ENDSSH

# Step 5: Install dependencies
echo -e "${YELLOW}Step 5: Installing dependencies on server...${NC}"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Backend
cd apps/api
if [ ! -d ".venv" ]; then
    python3 -m venv .venv 2>/dev/null || python -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -e . --quiet
pip install aiosqlite email-validator scipy networkx --quiet
echo "Backend dependencies installed"

# Run database migrations
echo "Running database migrations..."
if alembic upgrade head 2>/dev/null; then
    echo "Database migrations completed"
else
    echo "Migration skipped or failed - may need manual review"
fi

# Frontend
cd ../web
npm install --silent
npm run build
echo "Frontend built"
ENDSSH

# Step 6: Restart services
echo -e "${YELLOW}Step 6: Restarting services...${NC}"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Kill existing processes
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "npm run preview" 2>/dev/null || true
sleep 2

# Start backend
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
echo "Backend started on port 9002"

# Start frontend (production build)
cd ../web
nohup npm run preview -- --host 0.0.0.0 --port 5180 > /tmp/web.log 2>&1 &
echo "Frontend started on port 5180"

# Wait a moment for services to start
sleep 3

# Check if services are running
if pgrep -f "uvicorn src.main:app" > /dev/null; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend may not have started - check logs"
fi

if pgrep -f "npm run preview" > /dev/null; then
    echo "✅ Frontend is running"
else
    echo "⚠️  Frontend may not have started - check logs"
fi

# Wait for services to be ready
sleep 5

# Check new analytics endpoints
echo "Checking analytics API..."
if curl -s "http://localhost:9002/api/v1/analytics/risk-trends?time_range=1M" | grep -q "time_range"; then
    echo "✅ Analytics API is working"
else
    echo "⚠️  Analytics API check failed - may still be starting"
fi

# Check health endpoint
if curl -s http://localhost:9002/api/v1/health | grep -q "healthy"; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed"
fi
ENDSSH

# Cleanup local temp file
rm -f "$DEPLOY_TAR"

echo ""
echo -e "${GREEN}✅ Synchronization complete!${NC}"
echo ""
echo "🌐 Server URL: https://${DOMAIN}"
echo "🔌 API: https://${DOMAIN}/api"
echo ""
echo "📊 To check server status:"
echo "   ssh $SERVER_HOST 'ps aux | grep -E \"uvicorn|npm\"'"
echo ""
echo "📋 To view logs:"
echo "   ssh $SERVER_HOST 'tail -f /tmp/api.log'"
echo "   ssh $SERVER_HOST 'tail -f /tmp/web.log'"
echo ""
echo "🔄 Local version: http://localhost:5180/command"
echo "🌐 Server version: https://${DOMAIN}"
