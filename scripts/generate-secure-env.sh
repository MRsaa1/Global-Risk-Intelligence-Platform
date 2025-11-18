#!/bin/bash
# Generate secure environment variables for production

set -e

echo "🔐 Generating Secure Environment Variables"
echo "============================================"
echo ""

# Generate JWT secret (64 characters)
JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)

# Generate database password
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)

# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)

cat > .env <<EOF
# Generated Secure Environment Variables
# Generated on: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Server Configuration
SERVER_IP=${SERVER_IP:-104.248.70.69}
API_PORT=9002
UI_PORT=9010

# Security
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=*
CORS_ORIGINS=*

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_ENABLED=true

# Database
POSTGRES_DB=risk_platform
POSTGRES_USER=risk_user
DB_PASSWORD=${DB_PASSWORD}
POSTGRES_PORT=5433

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Application URLs
DATABASE_URL=postgresql://risk_user:${DB_PASSWORD}@postgres:5432/risk_platform
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REG_CALCULATOR_URL=http://reg-calculator-api:8080
EOF

echo "✅ Secure .env file generated"
echo ""
echo "📋 Generated Secrets:"
echo "  JWT_SECRET: ${JWT_SECRET:0:20}... (64 chars)"
echo "  DB_PASSWORD: ${DB_PASSWORD:0:10}... (24 chars)"
echo "  REDIS_PASSWORD: ${REDIS_PASSWORD:0:10}... (24 chars)"
echo ""
echo "⚠️  IMPORTANT:"
echo "  - Keep .env file secure"
echo "  - Do not commit .env to version control"
echo "  - Store secrets in a secrets manager for production"
echo ""

