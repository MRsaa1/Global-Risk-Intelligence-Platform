#!/usr/bin/env bash
# Создать scripts/gpu-test-gpu.sh на сервере, если его нет (после git pull или без него).
# Запуск на сервере: bash scripts/create-gpu-test-script-on-server.sh

set -e
cd "$(dirname "$0")/.."
mkdir -p scripts
cat > scripts/gpu-test-gpu.sh << 'ENDOFSCRIPT'
#!/usr/bin/env bash
# Тест API в режиме С GPU (NIM на сервере). Запуск: cd ~/global-risk-platform && ./scripts/gpu-test-gpu.sh

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ARTIFACTS="$ROOT/docs/gpu-test-artifacts/gpu"
BASE_URL="${BASE_URL:-http://127.0.0.1:9002}"
API="${BASE_URL}/api/v1"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Тест режима С GPU ===${NC}"
echo "BASE_URL=$BASE_URL"
echo "Артефакты: $ARTIFACTS"
echo ""

mkdir -p "$ARTIFACTS"

echo -e "${YELLOW}1. GET /api/v1/health/nvidia${NC}"
if curl -sS -o "$ARTIFACTS/health_nvidia.json" -w "%{http_code}" "$API/health/nvidia" | grep -q 200; then
  echo -e "${GREEN}   OK${NC}"
else
  echo -e "${RED}   FAIL или API недоступен${NC}"
fi

echo -e "${YELLOW}2. GET /api/v1/nvidia/nim/health${NC}"
if curl -sS -o "$ARTIFACTS/nim_health.json" -w "%{http_code}" "$API/nvidia/nim/health" | grep -q 200; then
  echo -e "${GREEN}   OK${NC}"
else
  echo -e "${RED}   FAIL или недоступен${NC}"
  echo '{"fourcastnet":{"status":"unavailable"},"corrdiff":{"status":"unavailable"}}' > "$ARTIFACTS/nim_health.json"
fi

if [ -n "${TOKEN}" ]; then
  echo -e "${YELLOW}3. POST /api/v1/stress-tests/execute${NC}"
  HTTP=$(curl -sS -o "$ARTIFACTS/execute_response.json" -w "%{http_code}" \
    -X POST "$API/stress-tests/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"city_name":"Berlin","center_latitude":52.52,"center_longitude":13.405,"event_id":"flood-scenario","severity":0.5,"use_llm":false}')
  if [ "$HTTP" = "200" ]; then echo -e "${GREEN}   OK (HTTP 200)${NC}"; else echo -e "${RED}   HTTP $HTTP${NC}"; fi
else
  echo -e "${YELLOW}3. POST /stress-tests/execute — пропущен (TOKEN=... для вызова)${NC}"
fi

echo ""
echo -e "${CYAN}--- Сводка (ожидается с GPU) ---${NC}"
if command -v jq >/dev/null 2>&1; then
  NIM=$(jq -r '.nvidia_services.fourcastnet_nim.ready // empty' "$ARTIFACTS/health_nvidia.json" 2>/dev/null)
  [ -z "$NIM" ] || [ "$NIM" = "null" ] && NIM="false (не настроен)"
  NIM_NIM=$(jq -r '.fourcastnet.status // "unavailable"' "$ARTIFACTS/nim_health.json" 2>/dev/null || echo "unavailable")
  echo "  health/nvidia → fourcastnet_nim.ready: $NIM"
  echo "  nvidia/nim/health → fourcastnet.status: $NIM_NIM"
  echo "  Ожидание: ready=true, status=healthy"
else
  echo "  Файлы: $ARTIFACTS/health_nvidia.json, $ARTIFACTS/nim_health.json"
fi
echo ""
echo -e "${GREEN}Готово. Артефакты: $ARTIFACTS${NC}"
ENDOFSCRIPT
chmod +x scripts/gpu-test-gpu.sh
echo "Создан scripts/gpu-test-gpu.sh. Запуск: ./scripts/gpu-test-gpu.sh"
