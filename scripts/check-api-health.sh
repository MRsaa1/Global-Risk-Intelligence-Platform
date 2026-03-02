#!/usr/bin/env bash
# Check API health for monitoring/cron. Exit 0 = healthy, 1 = unhealthy.
# Usage: API_BASE_URL=https://risk.saa-alliance.com ./scripts/check-api-health.sh
# Optional: CHECK_BODY=1 to require "healthy" in response body (default: only HTTP 200).
set -e
BASE="${API_BASE_URL:-http://localhost:9002}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-10}"
body=$(curl -sf --connect-timeout 5 --max-time "$TIMEOUT" "$BASE/api/v1/health" 2>/dev/null || true)
if [ -z "$body" ]; then
  exit 1
fi
if [ "${CHECK_BODY:-0}" = "1" ]; then
  echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"healthy"' || exit 1
fi
exit 0
