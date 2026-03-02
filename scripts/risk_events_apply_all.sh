#!/usr/bin/env bash
# Risk Events: применить миграции + один раз заполнить реестр и подтянуть USGS.
# Запускать из КОРНЯ репо (global-risk-platform), не из apps/api:
#   cd /path/to/global-risk-platform
#   ./scripts/risk_events_apply_all.sh
# Из apps/api:  cd .. && ./scripts/risk_events_apply_all.sh
#
# Требования: 1) миграции уже выполнены (cd apps/api && alembic upgrade head)
#             2) API запущен (uvicorn в другом терминале).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
BASE_URL="${BASE_URL:-http://localhost:9002}"
API="${BASE_URL}/api/v1"

echo "=== 1. Миграции (выполнить вручную если ещё не делали) ==="
echo "  cd apps/api && alembic upgrade head"
echo "  (или: alembic stamp head — если таблицы уже созданы)"
echo ""

echo "=== 2. Реестр источников + синхронизация USGS (365 дней, M5+) ==="
SYNC_RESP=$(curl -s -w "\n%{http_code}" -X POST "${API}/risk/events/sync?source=usgs&days=365&min_magnitude=5&seed_registry=true")
HTTP_CODE=$(echo "$SYNC_RESP" | tail -n1)
BODY=$(echo "$SYNC_RESP" | sed '$d')
if echo "$BODY" | grep -q '"status":"success"'; then
  echo "  OK: $BODY"
elif [ -z "$BODY" ] || [ "$HTTP_CODE" = "000" ]; then
  echo "  Пустой ответ или нет соединения. Запустите API в другом терминале:"
  echo "    cd $REPO_ROOT/apps/api && source .venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 9002"
  echo "  Затем снова запустите этот скрипт. (Порт по умолчанию: 9002; иначе: BASE_URL=http://localhost:ПОРТ ./scripts/risk_events_apply_all.sh)"
  exit 1
else
  echo "  Ответ (HTTP $HTTP_CODE): $BODY"
  echo "  Если API не запущен — запустите его и повторите."
  exit 1
fi

echo ""
echo "=== 3. Проверка: список событий и источников ==="
echo "  GET /api/v1/risk/events"
curl -s "${API}/risk/events?limit=3" | head -c 500
echo ""
echo "  GET /api/v1/risk/sources"
curl -s "${API}/risk/sources" | head -c 400
echo ""
echo "Готово. Данные для расчёта онлайном: GET ${API}/risk/events и GET ${API}/risk/sources"
