#!/bin/bash
# PHYSICAL-FINANCIAL RISK PLATFORM - Local Development Startup

set -e

echo "🌍 PHYSICAL-FINANCIAL RISK PLATFORM"
echo "   The Operating System for the Physical Economy"
echo "=============================================="
echo ""

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"

# Start infrastructure
echo ""
echo "🐳 Starting infrastructure..."
docker-compose up -d postgres redis neo4j minio

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check services
echo ""
echo "📊 Checking services:"

if docker-compose ps postgres | grep -q "Up"; then
    echo -e "   ${GREEN}✓${NC} PostgreSQL + PostGIS"
else
    echo -e "   ${YELLOW}⚠${NC} PostgreSQL starting..."
fi

if docker-compose ps redis | grep -q "Up"; then
    echo -e "   ${GREEN}✓${NC} Redis"
else
    echo -e "   ${YELLOW}⚠${NC} Redis starting..."
fi

if docker-compose ps neo4j | grep -q "Up"; then
    echo -e "   ${GREEN}✓${NC} Neo4j (Knowledge Graph)"
else
    echo -e "   ${YELLOW}⚠${NC} Neo4j starting..."
fi

if docker-compose ps minio | grep -q "Up"; then
    echo -e "   ${GREEN}✓${NC} MinIO (Object Storage)"
else
    echo -e "   ${YELLOW}⚠${NC} MinIO starting..."
fi

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Infrastructure ready!${NC}"
echo ""
echo "🌐 Services:"
echo "   PostgreSQL:  localhost:5432"
echo "   Neo4j:       http://localhost:7474 (neo4j/pfrp_graph_2024)"
echo "   MinIO:       http://localhost:9001 (pfrp_minio/pfrp_minio_secret_2024)"
echo "   Redis:       localhost:6379"
echo ""
echo "📝 Next steps:"
echo ""
echo "   1. Start API Backend:"
echo "      cd apps/api"
echo "      pip install -e '.[dev]'"
echo "      uvicorn src.main:app --reload --port 9002"
echo ""
echo "   2. Start Web Frontend:"
echo "      cd apps/web"
echo "      npm install"
echo "      npm run dev"
echo ""
echo "   3. Open in browser:"
echo "      API:  http://localhost:9002/docs"
echo "      Web:  http://localhost:5173"
echo ""
echo "   4. (Optional) Seed demo data after API is running:"
echo "      POST /api/v1/seed/seed (requires admin auth)"
echo "      Or use 'Load demo data' on the Assets page when logged in as admin."
echo ""