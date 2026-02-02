#!/bin/bash
# ===========================================
# FULL DEPLOYMENT WITH TIMEOUT PROTECTION
# Deploys all changes to server with keepalive and extended timeouts
# ===========================================

set -e

echo "🚀 Starting full deployment with timeout protection..."

# Configuration
SERVER_HOST="173.212.208.123"
SERVER_PORT="32769"
SERVER_USER="arin"
PROJECT_DIR="/home/arin/global-risk-platform"
DOMAIN="risk.saa-alliance.com"

# SSH with keepalive to prevent timeout
SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=120 -o ConnectTimeout=60"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📦 Preparing deployment package...${NC}"

# Step 1: Create tarball (exclude large files)
echo -e "${YELLOW}Step 1: Creating deployment tarball...${NC}"
DEPLOY_TAR="/tmp/pfrp-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"
COPYFILE_DISABLE=1 tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.DS_Store' \
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
    --exclude='.services-logs' \
    -czf "$DEPLOY_TAR" \
    -C "$(pwd)" .

echo -e "${GREEN}✅ Package created: $(du -h "$DEPLOY_TAR" | cut -f1)${NC}"

# Step 2: Backup current server version
echo -e "${YELLOW}Step 2: Backing up current server version...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~
if [ -d "global-risk-platform" ]; then
    BACKUP_NAME="global-risk-platform-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$BACKUP_NAME" global-risk-platform 2>/dev/null || true
    echo "✅ Server backup created: $BACKUP_NAME"
    # Keep only last 3 backups
    ls -t global-risk-platform-backup-*.tar.gz 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
else
    echo "ℹ️  No existing project to backup"
fi
ENDSSH

# Step 3: Copy tarball to server
echo -e "${YELLOW}Step 3: Copying package to server (may take 30-60s)...${NC}"
scp $SSH_OPTS -P $SERVER_PORT "$DEPLOY_TAR" $SERVER_USER@$SERVER_HOST:~/
echo -e "${GREEN}✅ Package uploaded${NC}"

# Step 4: Extract on server
echo -e "${YELLOW}Step 4: Extracting on server...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~
rm -rf global-risk-platform 2>/dev/null || true
mkdir -p global-risk-platform
tar -xzf pfrp-deploy-*.tar.gz -C global-risk-platform
rm -f pfrp-deploy-*.tar.gz
echo "✅ Project extracted"
ENDSSH

# Step 5: Create/update .env
echo -e "${YELLOW}Step 5: Configuring environment...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform/apps/api
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
DATABASE_URL=sqlite:///./prod.db
USE_SQLITE=true
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=["https://risk.saa-alliance.com"]

# NVIDIA API keys (set manually if needed)
NVIDIA_LLM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODE=cloud
EOF
    echo "✅ Environment file created"
else
    echo "ℹ️  Environment file exists, preserving it"
fi
ENDSSH

# Step 6: Install backend dependencies
echo -e "${YELLOW}Step 6: Installing backend dependencies (~60s)...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform/apps/api
echo "[6a] Creating/activating venv..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv 2>/dev/null || python -m venv .venv
fi
source .venv/bin/activate
echo "[6b] Upgrading pip..."
pip install --upgrade pip --quiet
echo "[6c] Installing backend packages..."
pip install -e . --quiet
pip install aiosqlite email-validator scipy networkx --quiet
echo "✅ Backend dependencies installed"
ENDSSH

# Step 7: Run database migrations
echo -e "${YELLOW}Step 7: Running database migrations...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform/apps/api
source .venv/bin/activate
if alembic upgrade head 2>/dev/null; then
    echo "✅ Migrations applied"
else
    echo "⚠️  Migration skipped or failed (continuing)"
fi
ENDSSH

# Step 8: Install frontend dependencies and build (LONG STEP - 3-5 min)
echo -e "${YELLOW}Step 8: Building frontend (3-5 min, please wait)...${NC}"
echo "   This step may take several minutes. Progress indicators:"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform/apps/web
echo "[8a] npm install (1-2 min)..."
npm install --loglevel=error
echo "[8b] npm run build (2-4 min)..."
# Increase Node memory limit to prevent OOM during build
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
echo "✅ Frontend build complete"
ENDSSH

# Step 9: Stop old services
echo -e "${YELLOW}Step 9: Stopping old services...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true
pkill -f "npm run preview" 2>/dev/null || true
sleep 3
echo "✅ Old services stopped"
ENDSSH

# Step 10: Start new services
echo -e "${YELLOW}Step 10: Starting new services...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Start backend
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 --timeout-keep-alive 120 > /tmp/api.log 2>&1 &
echo "✅ Backend started on port 9002"

# Start frontend
cd ../web
nohup npx serve -s dist -l 5180 > /tmp/web.log 2>&1 &
echo "✅ Frontend started on port 5180"

sleep 5
ENDSSH

# Step 11: Health checks
echo -e "${YELLOW}Step 11: Running health checks...${NC}"
ssh $SSH_OPTS -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'ENDSSH'
# Check processes
if pgrep -f "uvicorn src.main:app" > /dev/null; then
    echo "✅ Backend process running"
else
    echo "❌ Backend not running"
fi

if pgrep -f "serve" > /dev/null; then
    echo "✅ Frontend process running"
else
    echo "❌ Frontend not running"
fi

# Wait for API startup (SENTINEL, OVERSEER init can take 10-20s)
echo "Waiting for API to be ready (20s)..."
sleep 20

# Health check with retries
HEALTH_OK=
for i in 1 2 3 4 5; do
    if curl -sf http://localhost:9002/api/v1/health 2>/dev/null | grep -q "healthy"; then
        HEALTH_OK=1
        echo "✅ Backend health check passed"
        break
    fi
    echo "   Retry $i/5..."
    sleep 5
done

if [ -z "$HEALTH_OK" ]; then
    echo "⚠️  Backend health check failed - check logs:"
    echo "   tail -n 50 /tmp/api.log"
fi

# Test frontend
if curl -sf http://localhost:5180 > /dev/null; then
    echo "✅ Frontend is responding"
else
    echo "⚠️  Frontend not responding"
fi
ENDSSH

# Cleanup local temp file
rm -f "$DEPLOY_TAR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "🌐 Frontend: https://${DOMAIN}"
echo "🔌 API: https://${DOMAIN}/api/v1/health"
echo "🎯 Command Center: https://${DOMAIN}/command"
echo ""
echo "📋 Server logs:"
echo "   Backend:  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/api.log'"
echo "   Frontend: ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/web.log'"
echo ""
echo "🔍 Check services:"
echo "   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'ps aux | grep -E \"uvicorn|serve\"'"
echo ""
