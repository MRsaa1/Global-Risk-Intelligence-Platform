#!/bin/bash
# ===========================================
# COMPLETE SYNCHRONIZATION
# Finishes the sync process after frontend build completes
# ===========================================

set -e

# Configuration
SERVER_HOST="173.212.208.123"
SERVER_PORT="32769"
SERVER_USER="arin"
SSH_KEY="$HOME/.ssh/id_ed25519_contabo"
SSH_OPTS="-i $SSH_KEY -p $SERVER_PORT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking build status...${NC}"

# Check if build is still running
if ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'pgrep -f "vite build" > /dev/null'; then
    echo -e "${YELLOW}⏳ Frontend build is still in progress. Waiting...${NC}"
    echo "   (This may take 5-10 minutes)"
    
    # Wait for build to complete (with timeout)
    timeout=600  # 10 minutes
    elapsed=0
    while ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'pgrep -f "vite build" > /dev/null' 2>/dev/null; do
        if [ $elapsed -ge $timeout ]; then
            echo -e "${RED}❌ Build timeout. Check manually.${NC}"
            exit 1
        fi
        sleep 10
        elapsed=$((elapsed + 10))
        echo "   Still building... (${elapsed}s)"
    done
    echo -e "${GREEN}✅ Build complete!${NC}"
else
    echo -e "${GREEN}✅ Build already complete or not running${NC}"
fi

# Check if dist directory exists
echo -e "${YELLOW}🔍 Checking dist directory...${NC}"
if ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'test -d ~/global-risk-platform/apps/web/dist && ls ~/global-risk-platform/apps/web/dist/ | head -1'; then
    echo -e "${GREEN}✅ dist directory exists${NC}"
else
    echo -e "${RED}❌ dist directory not found. Build may have failed.${NC}"
    echo "   Check logs: ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'cd ~/global-risk-platform/apps/web && npm run build'"
    exit 1
fi

# Stop old frontend processes
echo -e "${YELLOW}🛑 Stopping old frontend processes...${NC}"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'pkill -f "vite preview" 2>/dev/null || true'
sleep 2

# Start new frontend
echo -e "${YELLOW}🚀 Starting new frontend...${NC}"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform/apps/web
nohup npm run preview -- --host 0.0.0.0 --port 5180 > /tmp/web.log 2>&1 &
sleep 2
if pgrep -f "vite preview.*5180" > /dev/null; then
    echo "✅ Frontend started on port 5180"
else
    echo "⚠️  Frontend may not have started - check logs"
fi
ENDSSH

# Check backend
echo -e "${YELLOW}🔍 Checking backend...${NC}"
if ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'pgrep -f "uvicorn src.main:app.*9002" > /dev/null'; then
    echo -e "${GREEN}✅ Backend is running on port 9002${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not running. Starting...${NC}"
    ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/global-risk-platform/apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
sleep 2
if pgrep -f "uvicorn src.main:app.*9002" > /dev/null; then
    echo "✅ Backend started"
else
    echo "⚠️  Backend may not have started - check logs"
fi
ENDSSH
fi

# Final status check
echo ""
echo -e "${GREEN}✅ Synchronization complete!${NC}"
echo ""
echo "📊 Service Status:"
ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'ps aux | grep -E "uvicorn.*9002|vite preview.*5180" | grep -v grep || echo "   No services found"'
echo ""
echo "🌐 URLs:"
echo "   Frontend: https://risk.saa-alliance.com"
echo "   API: https://risk.saa-alliance.com/api/v1/health"
echo ""
echo "📋 To check logs:"
echo "   ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'tail -f /tmp/api.log'"
echo "   ssh $SSH_OPTS $SERVER_USER@$SERVER_HOST 'tail -f /tmp/web.log'"
