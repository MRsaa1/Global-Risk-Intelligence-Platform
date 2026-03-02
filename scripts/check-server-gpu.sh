#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
API_URL="${API_URL:-http://localhost:9002}"
echo "=== GPU server check ==="
echo -n "NIM (:8001): "; curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready" && echo "ready" || echo "not ready"
echo -n "API (:9002): "; curl -sf "$API_URL/api/v1/health" -o /dev/null 2>/dev/null && echo "up" || echo "down"
echo -n "Front (:5180): "; curl -sf http://localhost:5180 -o /dev/null 2>/dev/null && echo "up" || echo "down"
echo ""
