#!/bin/bash

# Quick start script for demo

echo "🚀 Starting Global Risk Platform Demo..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

# Start API Gateway in background
echo "📡 Starting API Gateway..."
cd apps/api-gateway
npm run dev > /tmp/api-gateway.log 2>&1 &
API_PID=$!
echo "API Gateway started (PID: $API_PID)"
echo "Logs: tail -f /tmp/api-gateway.log"

# Wait for API Gateway to start
sleep 3

# Start Control Tower UI
echo "🎨 Starting Control Tower UI..."
cd ../control-tower
npm run dev > /tmp/control-tower.log 2>&1 &
UI_PID=$!
echo "Control Tower UI started (PID: $UI_PID)"
echo "Logs: tail -f /tmp/control-tower.log"

echo ""
echo "✅ System started!"
echo ""
echo "📊 API Gateway: http://localhost:8000"
echo "🎯 Control Tower UI: http://localhost:3000 (или порт, указанный Vite)"
echo "🎯 Demo Page: http://localhost:3000/demo"
echo ""
echo "Для остановки: kill $API_PID $UI_PID"
echo ""
echo "Проверка статуса:"
echo "  curl http://localhost:8000/health"
echo "  curl http://localhost:8000/api/v1/demo/data"

cd ../..

