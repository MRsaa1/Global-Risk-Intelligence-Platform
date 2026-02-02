#!/bin/bash
# Seed stress test scenarios and print URLs for Command Center, Climate, Omniverse.
# Run after API is up on port 9002 (local or remote).

set -e

API_BASE="${API_BASE:-http://localhost:9002}"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}API base: $API_BASE${NC}"
echo ""

# Seed stress tests (idempotent)
echo "Seeding stress test scenarios..."
RESP=$(curl -sf -X POST "$API_BASE/api/v1/stress-tests/admin/seed" 2>/dev/null) || true
if echo "$RESP" | grep -q "inserted"; then
    echo -e "${GREEN}✓ Stress tests seeded${NC}"
else
    echo "  (seed skipped or already done)"
fi

echo ""
echo "--- URLs ---"
echo "  Stress scenarios library:  $API_BASE/api/v1/stress-tests/scenarios/library"
echo "  Stress scenarios extended: $API_BASE/api/v1/stress-tests/scenarios/extended"
echo "  Climate forecast:           $API_BASE/api/v1/climate/forecast?latitude=52.52&longitude=13.405&days=5"
echo "  Omniverse launch:          $API_BASE/api/v1/omniverse/launch?scenario=NGFS_SSP5_2050"
echo ""
echo "  Command Center (UI):  http://localhost:5180/command   (or your web base + /command)"
echo "  API Docs:             $API_BASE/docs"
echo ""
