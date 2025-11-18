#!/bin/bash
# Migrate from simple to secure version

set -e

echo "🔒 Migrating to Secure Version"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Generating secure .env file..."
    ./scripts/generate-secure-env.sh
else
    echo "✅ .env file exists"
fi

# Backup current docker-compose
if [ -f docker-compose.yml ]; then
    echo "💾 Backing up docker-compose.yml..."
    cp docker-compose.yml docker-compose.yml.backup
fi

# Copy secure docker-compose
echo "📋 Copying secure docker-compose..."
cp docker-compose.secure.yml docker-compose.yml

# Update API Gateway Dockerfile to use secure version
echo "🔧 Updating API Gateway to use secure version..."
sed -i.bak 's/main-simple/main-secure/g' apps/api-gateway/Dockerfile 2>/dev/null || true

# Update reg-calculator Dockerfile to use secure version
echo "🔧 Updating Reg Calculator to use secure version..."
sed -i.bak 's/api\.py/api_secure.py/g' apps/reg-calculator/Dockerfile 2>/dev/null || true

echo ""
echo "✅ Migration complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review .env file and update CORS_ORIGIN if needed"
echo "  2. Rebuild containers: docker-compose build"
echo "  3. Restart services: docker-compose up -d"
echo ""
echo "⚠️  Important:"
echo "  - JWT_SECRET must be at least 32 characters"
echo "  - Update CORS_ORIGIN to your domain in production"
echo "  - Review rate limiting settings"
echo ""

