#!/bin/bash
# Database Migration Script for PFRP

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Change to API directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed
if ! python -c "import alembic" 2>/dev/null; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -e . --quiet
fi

# Parse arguments
COMMAND=${1:-"upgrade"}
REVISION=${2:-"head"}

case $COMMAND in
    upgrade)
        echo -e "${GREEN}Running migrations (upgrade to $REVISION)...${NC}"
        alembic upgrade $REVISION
        echo -e "${GREEN}✅ Migrations complete!${NC}"
        ;;
    downgrade)
        echo -e "${YELLOW}Running downgrade to $REVISION...${NC}"
        alembic downgrade $REVISION
        echo -e "${GREEN}✅ Downgrade complete!${NC}"
        ;;
    revision)
        MESSAGE=${2:-"auto migration"}
        echo -e "${GREEN}Creating new migration: $MESSAGE${NC}"
        alembic revision --autogenerate -m "$MESSAGE"
        echo -e "${GREEN}✅ Migration created!${NC}"
        ;;
    history)
        echo -e "${GREEN}Migration history:${NC}"
        alembic history
        ;;
    current)
        echo -e "${GREEN}Current revision:${NC}"
        alembic current
        ;;
    heads)
        echo -e "${GREEN}Available heads:${NC}"
        alembic heads
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo "Usage: ./migrate.sh [upgrade|downgrade|revision|history|current|heads] [revision]"
        echo ""
        echo "Examples:"
        echo "  ./migrate.sh upgrade head     # Apply all migrations"
        echo "  ./migrate.sh upgrade 001      # Upgrade to specific revision"
        echo "  ./migrate.sh downgrade -1     # Rollback one migration"
        echo "  ./migrate.sh revision 'add indexes'  # Create new migration"
        echo "  ./migrate.sh history          # Show migration history"
        exit 1
        ;;
esac
