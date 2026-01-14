#!/bin/bash
# Stop PHYSICAL-FINANCIAL RISK PLATFORM

echo "🛑 Stopping PHYSICAL-FINANCIAL RISK PLATFORM..."

cd "$(dirname "$0")"

# Stop Docker Compose
docker-compose down

echo ""
echo "✅ All services stopped"
