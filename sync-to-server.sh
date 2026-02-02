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
# COPYFILE_DISABLE avoids Apple xattr in tarball (reduces "Ignoring unknown extended header" on Linux)
DEPLOY_TAR="/tmp/pfrp-sync-$(date +%Y%m%d_%H%M%S).tar.gz"
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
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=["https://risk.saa-alliance.com"]

# Secrets MUST be provided out-of-band (do not commit keys):
# NVIDIA_API_KEY=...
# NVIDIA_FOURCASTNET_API_KEY=...
# NVIDIA_FLUX_API_KEY=...
# NGC_API_KEY=...
NVIDIA_LLM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODE=cloud
EOF
    echo "Environment file created"
    # Restore .env from backup so NVIDIA_API_KEY and other secrets are preserved
    LATEST_BACKUP=$(ls -t ~/global-risk-platform-backup-*.tar.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
      tar -xzf "$LATEST_BACKUP" -O global-risk-platform/apps/api/.env > apps/api/.env.from_backup 2>/dev/null && mv apps/api/.env.from_backup apps/api/.env && echo "Restored .env from backup (secrets preserved)"
    fi
else
    echo "Environment file already exists, preserving it"
fi
ENDSSH

# Step 5: Install dependencies
echo -e "${YELLOW}Step 5: Installing dependencies on server...${NC}"
echo "   (backend: ~1 min, frontend build: 2–4 min — wait for 'Frontend built')"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Backend
echo "[Step 5a] Backend: venv and pip..."
cd apps/api
if [ ! -d ".venv" ]; then
    python3 -m venv .venv 2>/dev/null || python -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -e . --quiet
pip install aiosqlite email-validator scipy networkx --quiet
echo "[Step 5a] Backend dependencies installed"

# Run database migrations
echo "[Step 5b] Database migrations..."
if alembic upgrade head 2>/dev/null; then
    echo "[Step 5b] Migrations OK"
else
    echo "[Step 5b] Migration skipped or failed (continuing)"
fi

# Frontend
echo "[Step 5c] Frontend: npm install..."
cd ~/global-risk-platform/apps/web
npm install --silent
echo "[Step 5c] Frontend: npm run build (2–4 min)..."
npm run build
echo "[Step 5c] Frontend built"
ENDSSH

# Step 6: Restart services
echo -e "${YELLOW}Step 6: Restarting services...${NC}"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform

# Kill existing processes
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "npm run preview" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true
sleep 2

# Start backend
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
echo "Backend started on port 9002"

# Start frontend (production build with SPA fallback for /command, /dashboard, etc.)
cd ../web
nohup npm run preview:prod > /tmp/web.log 2>&1 &
echo "Frontend started on port 5180 (serve with SPA fallback)"

# Wait a moment for services to start
sleep 3

# Check if services are running
if pgrep -f "uvicorn src.main:app" > /dev/null; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend may not have started - check logs"
fi

if pgrep -f "serve" > /dev/null; then
    echo "✅ Frontend is running"
else
    echo "⚠️  Frontend may not have started - check logs"
fi

# Wait for API to finish startup (DB init, SENTINEL, OVERSEER)
echo "Waiting for API to be ready (15s)..."
sleep 15

# Retry health check (API can take 10–30s to start)
HEALTH_OK=
for i in 1 2 3 4 5; do
    if curl -sf http://localhost:9002/api/v1/health | grep -q "healthy"; then
        HEALTH_OK=1
        break
    fi
    if curl -sf http://localhost:9002/health | grep -q "healthy"; then
        HEALTH_OK=1
        break
    fi
    [ $i -lt 5 ] && sleep 5
done
if [ -n "$HEALTH_OK" ]; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed (API may still be starting; check: tail -f /tmp/api.log)"
fi

# Check analytics (optional; depends on DB)
if curl -sf "http://localhost:9002/api/v1/analytics/risk-trends?time_range=1M" | grep -q "time_range"; then
    echo "✅ Analytics API is working"
else
    echo "⚠️  Analytics API check failed - may still be starting or DB not seeded"
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
