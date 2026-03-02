#!/usr/bin/env bash
# ===========================================
# Поднять все сервисы на GPU-сервере (Brev / AWS g6e)
# Запуск: на сервере  cd ~/global-risk-platform && ./scripts/start-all-gpu.sh
# Поднимает: Redis → NIM (FourCastNet) → API → Web
# ===========================================

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Подъём всех сервисов на GPU ===${NC}"
echo ""

# 1. Загрузить .env (чтобы NGC_API_KEY и остальное было доступно для NIM и API)
if [ -f "$API_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$API_DIR/.env" 2>/dev/null || true
  set +a
  echo -e "${GREEN}✓ .env загружен${NC}"
else
  echo -e "${YELLOW}⚠ apps/api/.env не найден. Создайте из .env.example и задайте NGC_API_KEY.${NC}"
fi

# 2. Redis (опционально)
echo -e "${YELLOW}[1/4] Redis...${NC}"
if command -v redis-cli &>/dev/null; then
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "  ${GREEN}✓ Redis уже запущен${NC}"
  else
    (redis-server --daemonize yes 2>/dev/null || sudo systemctl start redis-server 2>/dev/null || true)
    sleep 1
    redis-cli ping 2>/dev/null | grep -q PONG && echo -e "  ${GREEN}✓ Redis запущен${NC}" || echo -e "  ${YELLOW}⚠ Redis не запущен (необязательно)${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ Redis не установлен (необязательно)${NC}"
fi

# 3. NIM (FourCastNet на 8001)
echo -e "${YELLOW}[2/4] NIM (FourCastNet)...${NC}"
if [ -z "$NGC_API_KEY" ]; then
  echo -e "  ${YELLOW}⚠ NGC_API_KEY не задан — пропуск NIM. Задайте в apps/api/.env и перезапустите скрипт.${NC}"
else
  if docker compose -f "$ROOT/docker-compose.nim-fourcastnet.yml" ps 2>/dev/null | grep -q "Up"; then
    echo -e "  ${GREEN}✓ NIM уже запущен${NC}"
  else
    echo "$NGC_API_KEY" | docker login nvcr.io --username '$oauthtoken' --password-stdin 2>/dev/null || true
    docker compose -f "$ROOT/docker-compose.nim-fourcastnet.yml" up -d
    echo -e "  Ожидание готовности NIM (до 90 с)..."
    for i in 1 2 3 4 5 6 7 8 9; do
      if curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready"; then
        echo -e "  ${GREEN}✓ FourCastNet NIM готов на :8001${NC}"
        break
      fi
      [ "$i" -lt 9 ] && sleep 10
    done
    if ! curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready"; then
      echo -e "  ${YELLOW}⚠ NIM ещё не готов. Проверьте: curl http://localhost:8001/v1/health/ready${NC}"
    fi
  fi
fi

# 4. API (uvicorn :9002)
echo -e "${YELLOW}[3/4] API (uvicorn :9002)...${NC}"
pkill -f "uvicorn src.main:app" 2>/dev/null || true
sleep 2
cd "$API_DIR"
if [ ! -d .venv ]; then
  echo -e "  ${YELLOW}Создание venv...${NC}"
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip -q
  [ -f pyproject.toml ] && .venv/bin/pip install -e . -q || .venv/bin/pip install fastapi "uvicorn[standard]" pydantic pydantic-settings -q
fi
source .venv/bin/activate
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 --timeout-keep-alive 120 --no-access-log > /tmp/api.log 2>&1 &
echo $! > /tmp/pfrp-api.pid 2>/dev/null || true
cd "$ROOT"
sleep 3
if curl -sf http://localhost:9002/api/v1/health -o /dev/null 2>/dev/null; then
  echo -e "  ${GREEN}✓ API запущен на :9002${NC}"
else
  echo -e "  ${RED}⚠ API не ответил. Логи: tail -f /tmp/api.log${NC}"
fi

# 5. Web (vite preview :5180)
echo -e "${YELLOW}[4/4] Web (:5180)...${NC}"
pkill -f "vite preview" 2>/dev/null || true
sleep 1
cd "$WEB_DIR"
if [ ! -d node_modules ]; then
  echo -e "  ${YELLOW}npm install...${NC}"
  npm install --silent
fi
if [ ! -d dist ]; then
  echo -e "  ${YELLOW}npm run build...${NC}"
  npm run build
fi
nohup npx vite preview --port 5180 --host > /tmp/web.log 2>&1 &
echo $! > /tmp/pfrp-web.pid 2>/dev/null || true
cd "$ROOT"
sleep 2
if curl -sf http://localhost:5180 -o /dev/null 2>/dev/null; then
  echo -e "  ${GREEN}✓ Web запущен на :5180${NC}"
else
  echo -e "  ${YELLOW}⚠ Web не ответил. Логи: tail -f /tmp/web.log${NC}"
fi

# 6. Итог
echo ""
echo -e "${CYAN}=== Статус ===${NC}"
[ -x "$ROOT/scripts/check-server-gpu.sh" ] && "$ROOT/scripts/check-server-gpu.sh" || {
  echo -n "NIM (:8001): "; curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready" && echo "ready" || echo "not ready"
  echo -n "API (:9002): "; curl -sf http://localhost:9002/api/v1/health -o /dev/null 2>/dev/null && echo "up" || echo "down"
  echo -n "Web (:5180): "; curl -sf http://localhost:5180 -o /dev/null 2>/dev/null && echo "up" || echo "down"
}
echo ""
echo -e "${GREEN}Готово.${NC}"
echo "  Command Center: http://localhost:5180/command (после Port Forward — Brev/SSH)"
echo "  Логи API: tail -f /tmp/api.log"
echo "  Логи Web: tail -f /tmp/web.log"
echo "  Остановить всё: pkill -f 'uvicorn src.main:app'; pkill -f 'vite preview'; docker compose -f docker-compose.nim-fourcastnet.yml down"
echo ""
