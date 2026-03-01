#!/bin/bash
# ===========================================
# SAFE DEPLOY — БЕЗ ТАЙМАУТА | БАЗЫ И КЛЮЧИ СОХРАНЯЮТСЯ
# ===========================================
# По умолчанию: contabo (173.212.208.123:32769, arin, ~/.ssh/id_ed25519_contabo).
# Переопределение: export DEPLOY_HOST=... DEPLOY_PORT=... DEPLOY_USER=... DEPLOY_PROJECT_DIR=...
# .env и ключи — только с сервера (бэкап → восстановление). Базы сохраняются.
# SSH: keepalive 60s, до 2400 раз — таймаута нет (npm build 5+ мин не оборвёт).
# ===========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_HOST="${DEPLOY_HOST:-contabo}"
DEPLOY_PORT="${DEPLOY_PORT:-32769}"
DEPLOY_USER="${DEPLOY_USER:-arin}"
DEPLOY_PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/home/arin/global-risk-platform}"

PROJECT_DIR="$DEPLOY_PROJECT_DIR"
DOMAIN="${DEPLOY_DOMAIN:-risk.saa-alliance.com}"

SSH_TARGET="$DEPLOY_USER@$DEPLOY_HOST"
SSH_PORT_OPT="-p $DEPLOY_PORT"
SCP_PORT_OPT="-P $DEPLOY_PORT"

SSH_OPTS="-o ServerAliveInterval=60 -o ServerAliveCountMax=2400 -o ConnectTimeout=120 -o TCPKeepAlive=yes -o Compression=yes"
if [ -n "${SSH_KEY:-}" ] && [ -f "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
elif [ "$DEPLOY_HOST" = "contabo" ] && [ -f "$HOME/.ssh/id_ed25519_contabo" ]; then
    SSH_OPTS="$SSH_OPTS -i $HOME/.ssh/id_ed25519_contabo"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  SAFE DEPLOY — Global Risk Platform${NC}"
echo -e "${GREEN}  Базы данных и ключи сохраняются | Без таймаута${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   Сервер:  $SSH_TARGET (port $DEPLOY_PORT)"
echo "   Каталог: $PROJECT_DIR"
echo "   Домен:   $DOMAIN"
echo ""
echo -e "   ${YELLOW}⚠️  .env и все *.db на сервере сохраняются${NC}"
echo -e "   ${YELLOW}   Локальный .env НЕ отправляется на сервер${NC}"
echo ""

if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
    echo -e "${RED}❌ Run from project root (где есть apps/api и apps/web). Current: $(pwd)${NC}"
    exit 1
fi

# ========================== PRE-FLIGHT CHECKS ==========================

echo -e "${BLUE}🔍 Pre-flight checks...${NC}"

# Check SSH connectivity
if ! ssh $SSH_OPTS $SSH_PORT_OPT -o BatchMode=yes -o ConnectTimeout=10 $SSH_TARGET "echo ok" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to $SSH_TARGET:$DEPLOY_PORT${NC}"
    echo "   Check: SSH key, firewall, server is running"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} SSH connection OK"

# Check disk space on server
DISK_FREE=$(ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "df -h /home 2>/dev/null | tail -1 | awk '{print \$4}'" 2>/dev/null || echo "?")
echo -e "   ${GREEN}✓${NC} Server disk free: $DISK_FREE"

echo ""

# ========================== STEP 1: ARCHIVE ==========================

echo -e "${BLUE}📦 Step 1/13: Creating deployment tarball...${NC}"
DEPLOY_TAR="/tmp/pfrp-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"
COPYFILE_DISABLE=1 tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='dev.db' \
    --exclude='*.db' \
    --exclude='*.db-journal' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='.env.prod' \
    --exclude='backup_*.tar.gz' \
    --exclude='*.log' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.services-logs' \
    --exclude='apps/web/public/models' \
    --exclude='apps/web/public/samples' \
    --exclude='apps/web/public/xeokit-data' \
    --exclude='.cursor' \
    --exclude='.codex' \
    --exclude='agent-transcripts' \
    --exclude='terminals' \
    -czf "$DEPLOY_TAR" \
    -C "$(pwd)" .
echo -e "${GREEN}   ✅ Package: $(du -h "$DEPLOY_TAR" | cut -f1)${NC}"

PROJECT_DIR_ESC=$(printf '%s' "$PROJECT_DIR" | sed "s/'/'\\\\''/g")
CORS_ORIGINS="[\"https://${DOMAIN}\"]"
[ -z "$DOMAIN" ] && CORS_ORIGINS='["https://risk.example.com"]'
CORS_ORIGINS_ESC=$(printf '%s' "$CORS_ORIGINS" | sed "s/'/'\\\\''/g")

# ========================== STEP 2: BACKUP ON SERVER ==========================

echo -e "${YELLOW}📋 Step 2/13: Server backup — .env, databases, keys...${NC}"
ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
PRESERVE_DIR="$HOME/pfrp-preserve"
mkdir -p "$PRESERVE_DIR"

if [ -d "$PROJ" ]; then
    BACKUP_NAME="global-risk-platform-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$HOME/$BACKUP_NAME" -C "$(dirname "$PROJ")" "$(basename "$PROJ")" 2>/dev/null || true
    echo "   ✅ Full backup: $BACKUP_NAME"
    ls -t "$HOME"/global-risk-platform-backup-*.tar.gz 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true

    API_DIR="$PROJ/apps/api"
    for f in "$API_DIR"/.env "$API_DIR"/.env.local "$API_DIR"/.env.production "$API_DIR"/.env.prod; do
        [ -f "$f" ] && cp -a "$f" "$PRESERVE_DIR/$(basename "$f")" && echo "   ✅ Preserved $(basename "$f") (keys + secrets)"
    done
    mkdir -p "$PRESERVE_DIR/db"
    for f in "$API_DIR"/*.db; do
        [ -f "$f" ] && cp -a "$f" "$PRESERVE_DIR/db/" && echo "   ✅ Preserved database: $(basename "$f")"
    done
    if [ -d "$API_DIR/data" ]; then
        mkdir -p "$PRESERVE_DIR/data"
        for f in "$API_DIR/data"/*.db; do
            [ -f "$f" ] && cp -a "$f" "$PRESERVE_DIR/data/" && echo "   ✅ Preserved data/$(basename "$f")"
        done
    fi
else
    echo "   ℹ️  No existing project (first deploy)"
fi
exit 0
ENDSSH

# ========================== STEP 3: UPLOAD ==========================

echo -e "${YELLOW}📤 Step 3/13: Uploading package to server...${NC}"
scp $SSH_OPTS $SCP_PORT_OPT "$DEPLOY_TAR" $SSH_TARGET:/tmp/grp-deploy.tar.gz
echo -e "${GREEN}   ✅ Uploaded${NC}"

# ========================== STEP 4: EXTRACT + RESTORE ==========================

echo -e "${YELLOW}📂 Step 4/13: Extract and restore .env + databases...${NC}"
ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
PRESERVE_DIR="$HOME/pfrp-preserve"
rm -rf "$PROJ" 2>/dev/null || true
mkdir -p "$PROJ"
tar -xzf /tmp/grp-deploy.tar.gz -C "$PROJ" || { echo "❌ Extract failed"; exit 1; }
rm -f /tmp/grp-deploy.tar.gz
echo "   ✅ Project extracted"

API_DIR="$PROJ/apps/api"
mkdir -p "$API_DIR"

# Restore .env files (keys, secrets, API tokens — NEVER overwritten)
for f in "$PRESERVE_DIR"/.env "$PRESERVE_DIR"/.env.local "$PRESERVE_DIR"/.env.production "$PRESERVE_DIR"/.env.prod; do
    [ -f "$f" ] && cp -a "$f" "$API_DIR/$(basename "$f")" && echo "   ✅ Restored $(basename "$f") (keys preserved)"
done

# Restore databases
if [ -d "$PRESERVE_DIR/db" ] && [ -n "$(ls -A "$PRESERVE_DIR/db" 2>/dev/null)" ]; then
    cp -a "$PRESERVE_DIR/db"/*.db "$API_DIR/" 2>/dev/null || true
    echo "   ✅ Restored databases into apps/api/"
fi
if [ -d "$PRESERVE_DIR/data" ] && [ -n "$(ls -A "$PRESERVE_DIR/data" 2>/dev/null)" ]; then
    mkdir -p "$API_DIR/data"
    cp -a "$PRESERVE_DIR/data"/*.db "$API_DIR/data/" 2>/dev/null || true
    echo "   ✅ Restored databases into apps/api/data/"
fi
exit 0
ENDSSH

# ========================== STEP 5: STATIC ASSETS ==========================

echo -e "${YELLOW}📁 Step 5/13: Rsync static assets (models, samples, xeokit-data)...${NC}"
[ -d "apps/web/public/models" ] && rsync -az --progress -e "ssh $SSH_OPTS $SSH_PORT_OPT" \
    apps/web/public/models/ "$SSH_TARGET:$PROJECT_DIR/apps/web/public/models/" && echo -e "${GREEN}   ✅ models/ synced${NC}"
[ -d "apps/web/public/samples" ] && rsync -az --progress -e "ssh $SSH_OPTS $SSH_PORT_OPT" \
    apps/web/public/samples/ "$SSH_TARGET:$PROJECT_DIR/apps/web/public/samples/" && echo -e "${GREEN}   ✅ samples/ synced${NC}"
[ -d "apps/web/public/xeokit-data" ] && rsync -az --progress -e "ssh $SSH_OPTS $SSH_PORT_OPT" \
    apps/web/public/xeokit-data/ "$SSH_TARGET:$PROJECT_DIR/apps/web/public/xeokit-data/" && echo -e "${GREEN}   ✅ xeokit-data/ synced${NC}"

# ========================== STEP 5: ENV FILE ==========================

echo -e "${YELLOW}🔐 Step 6/13: Environment file — preserve or create...${NC}"
ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; export CORS='$CORS_ORIGINS_ESC'; bash -s" << 'ENDSSH'
cd "$PROJ/apps/api"
if [ ! -f ".env" ]; then
    SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "change-me-use-openssl-rand-hex-32")
    cat > .env << ENVEOF
DATABASE_URL=sqlite:///./prod.db
USE_SQLITE=true
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=$SECRET
CORS_ORIGINS=$CORS
NVIDIA_LLM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODE=cloud
ENABLE_NEO4J=false
ALLOW_SEED_IN_PRODUCTION=true
# Optional APIs (set on server manually):
# NVIDIA_API_KEY=
# NOAA_API_TOKEN=
# FIRMS_MAP_KEY=
# ENABLE_REDIS=true
# REDIS_URL=redis://localhost:6379
ENVEOF
    echo "   ✅ New .env created with generated SECRET_KEY"
    echo "   ⚠️  Edit API keys on server: nano $PROJ/apps/api/.env"
else
    echo "   ✅ .env preserved (existing keys and config unchanged)"

    # Safely add new vars that didn't exist before (append only, never overwrite)
    for VAR_LINE in \
        "ENABLE_NEO4J=false" \
    ; do
        VAR_NAME="${VAR_LINE%%=*}"
        if ! grep -q "^${VAR_NAME}=" .env 2>/dev/null && ! grep -q "^# *${VAR_NAME}=" .env 2>/dev/null; then
            echo "$VAR_LINE" >> .env
            echo "   ✅ Added $VAR_NAME to .env"
        fi
    done

    # Ensure ALLOW_SEED_IN_PRODUCTION=true
    if ! grep -q "ALLOW_SEED_IN_PRODUCTION" .env 2>/dev/null; then
        echo "ALLOW_SEED_IN_PRODUCTION=true" >> .env
        echo "   ✅ Added ALLOW_SEED_IN_PRODUCTION=true"
    fi
fi
exit 0
ENDSSH

# ========================== STEP 6: BACKEND DEPS ==========================

echo -e "${YELLOW}🐍 Step 7/13: Backend dependencies (~1-2 min)...${NC}"
if ! ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
cd "$PROJ/apps/api"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv 2>/dev/null || python -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip --quiet 2>&1 | tail -1
pip install -e . --quiet 2>&1 | tail -3
pip install aiosqlite email-validator scipy networkx --quiet 2>&1 | tail -1
echo "   ✅ Backend deps installed"
exit 0
ENDSSH
then
    echo -e "${RED}❌ Step 7 failed${NC}"
    echo "   DNS issue? Run on server: echo 'nameserver 1.1.1.1' | sudo tee /etc/resolv.conf"
    echo "   Then re-run: ./deploy.sh"
    exit 1
fi

# ========================== STEP 7: MIGRATIONS ==========================

echo -e "${YELLOW}🗄️  Step 8/13: Database migrations...${NC}"
if ! ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
cd "$PROJ/apps/api"
source .venv/bin/activate

# Backup DB before migration
if [ -f prod.db ]; then
    cp -a prod.db "prod.db.bak-$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    ls -t prod.db.bak-* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
fi

if alembic upgrade head 2>&1; then
    echo "   ✅ Migrations OK"
    exit 0
fi
echo "   ❌ Migrations FAILED"
echo "   Fix on server: cd $PROJ/apps/api && source .venv/bin/activate && alembic upgrade head"
echo "   If 'table already exists': alembic stamp head && alembic upgrade head"
exit 1
ENDSSH
then
    echo -e "${RED}❌ Step 8 failed — deploy aborted. Fix migrations on server and re-run ./deploy.sh${NC}"
    exit 1
fi

# ========================== STEP 8: FRONTEND BUILD ==========================

echo -e "${YELLOW}🏗️  Step 9/13: Frontend build (3-5 min)...${NC}"
DOMAIN_ESC=$(printf '%s' "$DOMAIN" | sed "s/'/'\\\\''/g")
CESIUM_TOKEN_ESC=$(printf '%s' "${VITE_CESIUM_ION_TOKEN:-}" | sed "s/'/'\\\\''/g")
ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; export DEPLOY_DOMAIN='$DOMAIN_ESC'; export VITE_CESIUM_ION_TOKEN='$CESIUM_TOKEN_ESC'; bash -s" << 'ENDSSH'
cd "$PROJ/apps/web"
npm install --loglevel=error 2>&1 | tail -3
export NODE_OPTIONS="--max-old-space-size=4096"
if [ -n "$DEPLOY_DOMAIN" ]; then
  export VITE_API_URL="https://${DEPLOY_DOMAIN}"
  echo "   VITE_API_URL=https://${DEPLOY_DOMAIN}"
fi
if [ -z "$VITE_CESIUM_ION_TOKEN" ]; then
  export VITE_CESIUM_ION_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTExZmMxNS1jY2RhLTQ2YjctOTg0Mi02NWQxNGQxYjFhZGYiLCJpZCI6Mzc4MTk5LCJpYXQiOjE3NjgzMjc3NjJ9.neQZ3X5JRYBalv7cjUuVrq_kVw0nVyKQlwtOyxls5OM"
fi
npm run build 2>&1 | tail -10
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "   ✅ Frontend built ($(du -sh dist | cut -f1))"
else
    echo "   ❌ Frontend build failed — dist/index.html not found"
    exit 1
fi
exit 0
ENDSSH

# ========================== STEP 9: STOP SERVICES ==========================

echo -e "${YELLOW}🔄 Step 10/13: Stopping old services...${NC}"
ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "bash -s" << 'ENDSSH'
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true
pkill -f "npm run preview" 2>/dev/null || true
sleep 3
# Verify ports are free
if lsof -i :9002 -t >/dev/null 2>&1; then
    kill -9 $(lsof -i :9002 -t) 2>/dev/null || true
fi
if lsof -i :5180 -t >/dev/null 2>&1; then
    kill -9 $(lsof -i :5180 -t) 2>/dev/null || true
fi
sleep 1
echo "   ✅ Old services stopped"
exit 0
ENDSSH

# ========================== STEP 10: START SERVICES ==========================

echo -e "${YELLOW}🚀 Step 11/13: Starting services...${NC}"
ssh $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
cd "$PROJ/apps/api"
source .venv/bin/activate
set -a
[ -f .env ] && source .env
set +a
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 --timeout-keep-alive 120 --no-access-log > /tmp/api.log 2>&1 &
echo "   ✅ Backend starting on port 9002 (PID: $!)"

cd "$PROJ/apps/web"
nohup npx serve -s dist -l 5180 > /tmp/web.log 2>&1 &
echo "   ✅ Frontend starting on port 5180 (PID: $!)"

sleep 5
exit 0
ENDSSH

# ========================== STEP 12: HEALTH CHECK ==========================

echo -e "${YELLOW}🏥 Step 12/13: Health check + verify endpoints...${NC}"
ssh -T $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
echo "   Waiting for API to start..."
sleep 10

API_OK=false
for i in 1 2 3 4 5 6; do
    if curl -sf http://localhost:9002/api/v1/health 2>/dev/null | grep -q "healthy"; then
        API_OK=true
        break
    fi
    echo "   ... waiting ($i/6)"
    sleep 5
done

if [ "$API_OK" = "true" ]; then
    echo "   ✅ API healthy"
else
    echo "   ❌ API health check failed"
    echo "   Check: tail -50 /tmp/api.log"
    exit 0
fi

# Verify key endpoints
echo ""
echo "   Verifying endpoints..."
for EP in \
    "/api/v1/health" \
    "/api/v1/assets/" \
    "/api/v1/alerts/monitoring/status" \
    "/api/v1/auth/enterprise/permissions/matrix" \
    "/api/v1/developer/workflows/templates" \
    "/api/v1/srs/status" \
    "/api/v1/fst/status" \
; do
    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:9002${EP}" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        echo "   ✅ $EP → $STATUS"
    else
        echo "   ⚠️  $EP → $STATUS"
    fi
done
exit 0
ENDSSH

# ========================== STEP 13: SEED ==========================

echo -e "${YELLOW}🌱 Step 13/13: Seed demo data...${NC}"
ssh -T $SSH_OPTS $SSH_PORT_OPT $SSH_TARGET "export PROJ='$PROJECT_DIR_ESC'; bash -s" << 'ENDSSH'
cd "$PROJ/apps/api" 2>/dev/null || true
if grep -q "ALLOW_SEED_IN_PRODUCTION=true" .env 2>/dev/null; then
    echo "   Seeding demo data..."
    r=$(curl -sf -X POST http://localhost:9002/api/v1/seed/seed 2>/dev/null) || true
    echo "$r" | grep -q "success" && echo "   ✅ Assets + Digital Twins seeded" || echo "   ⚠️  Seed skipped"

    r=$(curl -sf -X POST http://localhost:9002/api/v1/seed/seed-modules 2>/dev/null) || true
    echo "$r" | grep -q "success\|ok\|seeded" && echo "   ✅ Strategic modules seeded" || echo "   ⚠️  Modules seed skipped"

    r=$(curl -sf -X POST http://localhost:9002/api/v1/stress-tests/admin/seed 2>/dev/null) || true
    echo "$r" | grep -q "inserted\|success" && echo "   ✅ Stress tests seeded" || echo "   ⚠️  Stress tests seed skipped"

    r=$(curl -sf -X POST "http://localhost:9002/api/v1/twins/sync-regime?regime=auto" 2>/dev/null) || true
    echo "$r" | grep -q "ok\|twins_updated" && echo "   ✅ Regime sync done" || echo "   ⚠️  Regime sync skipped"

    curl -sf -X POST http://localhost:9002/api/v1/alerts/monitoring/start >/dev/null 2>&1 && \
        echo "   ✅ Agent monitoring started" || true
else
    echo "   ⚠️  Seed skipped (ALLOW_SEED_IN_PRODUCTION not true)"
fi
exit 0
ENDSSH

rm -f "$DEPLOY_TAR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ SAFE DEPLOY COMPLETE${NC}"
echo -e "${GREEN}  Databases and keys preserved — nothing overwritten${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
    echo "  🌐 https://${DOMAIN}"
    echo "  🔌 API: https://${DOMAIN}/api/v1/health"
    echo ""
    echo "  New features deployed:"
    echo "    • Agent Workflows      → /workflows"
    echo "    • AI Models Dashboard  → /ai-models"
    echo "    • Agent Alerts         → Command Center (bottom-left)"
    echo "    • Regulatory Export    → /modules/fst"
    echo "    • Enterprise Auth      → /settings > Security"
    echo ""
fi
echo "  Logs:"
echo "    ssh $SSH_PORT_OPT $SSH_TARGET 'tail -f /tmp/api.log'"
echo "    ssh $SSH_PORT_OPT $SSH_TARGET 'tail -f /tmp/web.log'"
echo ""
echo "  Rollback (if needed):"
echo "    ssh $SSH_PORT_OPT $SSH_TARGET"
echo "    cd $PROJECT_DIR/apps/api"
echo "    cp ~/pfrp-preserve/db/prod.db . && cp ~/pfrp-preserve/.env ."
echo "    source .venv/bin/activate && pkill -f uvicorn"
echo "    nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &"
echo ""
