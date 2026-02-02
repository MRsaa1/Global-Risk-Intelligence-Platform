#!/bin/bash
# Перезапуск API бэкенда. Запускать из корня репозитория: ./restart-api.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "📁 Корень проекта: $ROOT"

# Остановить процесс на порту 9002
if lsof -ti :9002 >/dev/null 2>&1; then
  echo "🛑 Освобождаю порт 9002..."
  lsof -ti :9002 | xargs kill -9 2>/dev/null || true
  pkill -f "uvicorn src.main:app" 2>/dev/null || true
  sleep 2
fi

# Переход в apps/api
API_DIR="$ROOT/apps/api"
if [ ! -d "$API_DIR" ]; then
  echo "❌ Папка не найдена: $API_DIR"
  echo "   Запускайте скрипт из корня репозитория: cd /путь/к/global-risk-platform && ./restart-api.sh"
  exit 1
fi
cd "$API_DIR"

# Создать .venv если нет
if [ ! -d ".venv" ]; then
  echo "📦 Создаю виртуальное окружение .venv..."
  python3 -m venv .venv
fi

# Активировать venv и установить зависимости при первом запуске
source .venv/bin/activate
if ! python -c "import uvicorn" 2>/dev/null; then
  echo "📦 Устанавливаю зависимости (pip install)..."
  pip install -e '.[dev]' 2>/dev/null || pip install -e . 2>/dev/null || pip install "uvicorn[standard]" fastapi pydantic pydantic-settings
fi

echo "🚀 Запуск API на http://0.0.0.0:9002"
echo "   Документация: http://localhost:9002/docs"
echo ""
exec uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
