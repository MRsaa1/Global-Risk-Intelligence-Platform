#!/bin/bash
# Быстрая остановка процесса на порту 9002

echo "🔍 Ищу процесс на порту 9002..."

# Найти PID процесса на порту 9002
PID=$(lsof -ti :9002 2>/dev/null)

if [ -z "$PID" ]; then
    echo "✅ Порт 9002 свободен"
    exit 0
fi

echo "🛑 Найден процесс PID: $PID"
echo "   Останавливаю..."

# Остановить процесс
kill -9 $PID 2>/dev/null

# Подождать немного
sleep 1

# Проверить еще раз
if lsof -ti :9002 >/dev/null 2>&1; then
    echo "⚠️  Процесс все еще работает, принудительная остановка..."
    pkill -9 -f "uvicorn.*9002" 2>/dev/null
    pkill -9 -f "python.*main:app" 2>/dev/null
    sleep 1
fi

# Финальная проверка
if lsof -ti :9002 >/dev/null 2>&1; then
    echo "❌ Не удалось освободить порт 9002"
    echo "   Попробуйте вручную: lsof -i :9002"
    exit 1
else
    echo "✅ Порт 9002 освобожден!"
    ROOT="$(cd "$(dirname "$0")" && pwd)"
    echo ""
    echo "Теперь запустите API из корня репозитория:"
    echo "  cd $ROOT"
    echo "  ./restart-api.sh"
    echo ""
    echo "Или вручную:"
    echo "  cd $ROOT/apps/api"
    echo "  source .venv/bin/activate"
    echo "  uvicorn src.main:app --reload --host 0.0.0.0 --port 9002"
fi
