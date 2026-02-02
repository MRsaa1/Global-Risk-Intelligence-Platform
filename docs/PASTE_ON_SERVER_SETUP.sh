#!/usr/bin/env bash
# ===========================================
# Вставь этот блок ЦЕЛИКОМ в терминал на сервере (Brev).
# Создаёт scripts/setup-server-gpu.sh и запускает его.
# ===========================================

cd ~/global-risk-platform
mkdir -p scripts

cat > scripts/setup-server-gpu.sh << 'ENDOFSCRIPT'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENV_FILE="$ROOT/apps/api/.env"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
for line in "USE_SQLITE=true" "USE_DATA_FEDERATION_PIPELINES=true" "USE_LOCAL_NIM=true" "FOURCASTNET_NIM_URL=http://localhost:8001" "E2CC_BASE_URL=http://localhost:8010"; do
  key="${line%%=*}"
  grep -q "^${key}=" "$ENV_FILE" 2>/dev/null || echo "$line" >> "$ENV_FILE"
done
echo "✓ .env ready"
if command -v redis-cli &>/dev/null; then
  redis-cli ping 2>/dev/null | grep -q PONG || redis-server --daemonize yes 2>/dev/null
fi
pkill -f "uvicorn src.main:app" 2>/dev/null || true
sleep 2
cd "$ROOT/apps/api"
source .venv/bin/activate
nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
sleep 3
echo ""
echo "NIM (:8001): $(curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q ready && echo ready || echo not ready)"
echo "API (:9002): $(curl -sf http://localhost:9002/api/v1/health -o /dev/null 2>/dev/null && echo up || echo down)"
echo ""
ENDOFSCRIPT

chmod +x scripts/setup-server-gpu.sh
./scripts/setup-server-gpu.sh
