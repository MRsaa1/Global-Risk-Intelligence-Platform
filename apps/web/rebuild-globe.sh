#!/bin/bash
# Принудительная пересборка фронта, чтобы применились правки глобуса (города по чекбоксам, синие круги как риск-зоны, круги над рельефом).
# Запускать из корня репозитория: ./apps/web/rebuild-globe.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "🧹 Очистка кэша Vite..."
rm -rf node_modules/.vite
rm -rf dist
echo "✅ Кэш удалён"
echo ""
echo "▶️  Запустите dev-сервер в ЭТОМ терминале:"
echo "   npm run dev"
echo ""
echo "▶️  В браузере после загрузки страницы:"
echo "   1. Откройте /command"
echo "   2. Нажмите Cmd+Shift+R (Mac) или Ctrl+Shift+R (Win/Linux) — жёсткое обновление"
echo "   3. Включите чекбоксы Flood / Wind / Heat и т.д. — должны появиться синие круги по всем городам слоя"
echo "   4. В консоли (F12 → Console) должно быть сообщение: [CesiumGlobe] Climate markers: N cities at 5000m altitude"
echo ""
