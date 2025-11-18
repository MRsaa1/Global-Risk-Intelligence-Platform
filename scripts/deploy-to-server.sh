#!/bin/bash
# Production Deployment Script for Global Risk Platform
# Server: 104.248.70.69 (8GB RAM, Ubuntu 24.04)

set -e

SERVER_IP="104.248.70.69"
SERVER_USER="${SERVER_USER:-root}"
APP_DIR="/opt/risk-platform"
PROJECT_ROOT="/Users/artur220513timur110415gmail.com/global-risk-platform"

echo "🚀 Production Deployment - Global Risk Platform"
echo "==============================================="
echo "Server: $SERVER_IP"
echo "RAM: 8GB (✅ Production-ready)"
echo ""

# Check SSH access
echo "📡 Checking SSH connection..."
if ! ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_IP" "echo 'Connection OK'" &>/dev/null; then
    echo "❌ Cannot connect to server"
    echo "Please ensure:"
    echo "  1. SSH key is configured"
    echo "  2. Server is accessible"
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

# Step 1: Server Setup
echo "🔧 Step 1: Setting up server..."
ssh "$SERVER_USER@$SERVER_IP" <<'SETUP'
set -e

echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker $USER 2>/dev/null || true
else
    echo "✅ Docker already installed"
fi

echo "📦 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
else
    echo "✅ Docker Compose already installed"
fi

echo "🛠️  Installing required tools..."
apt-get install -y -qq git curl wget htop net-tools openssl

echo "📁 Creating application directory..."
mkdir -p /opt/risk-platform
chmod 755 /opt/risk-platform

echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 9002/tcp  # API Gateway
    ufw allow 9010/tcp  # UI
    ufw allow 8080/tcp  # Reg Calculator
    ufw --force enable 2>/dev/null || true
    echo "✅ Firewall configured"
fi

echo "✅ Server setup complete"
SETUP

echo "✅ Step 1 complete"
echo ""

# Step 2: Upload project files
echo "📤 Step 2: Uploading project files..."
cd "$PROJECT_ROOT"

# Create deployment package
echo "📦 Creating deployment package..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.env' \
    --exclude 'dist' \
    --exclude 'build' \
    "$PROJECT_ROOT/" "$SERVER_USER@$SERVER_IP:$APP_DIR/"

echo "✅ Step 2 complete"
echo ""

# Step 3: Setup and deploy
echo "🚀 Step 3: Setting up and deploying..."
ssh "$SERVER_USER@$SERVER_IP" <<DEPLOY
set -e

cd $APP_DIR

echo "📝 Creating .env file..."
if [ ! -f .env ]; then
    DB_PASS=\$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
    JWT_SECRET=\$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    cat > .env <<EOF
# Server Configuration
SERVER_IP=104.248.70.69

# Database
DB_PASSWORD=\$DB_PASS

# JWT
JWT_SECRET=\$JWT_SECRET

# Application URLs
API_URL=http://104.248.70.69:9002
UI_URL=http://104.248.70.69:9010
EOF
    echo "✅ .env file created with generated passwords"
else
    echo "✅ .env file already exists"
fi

echo "🐳 Building Docker images..."
docker-compose -f docker-compose.production.yml build --no-cache

echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

echo "▶️  Starting services..."
docker-compose -f docker-compose.production.yml up -d

echo "⏳ Waiting for services to start..."
sleep 20

echo "📊 Service status:"
docker-compose -f docker-compose.production.yml ps

echo ""
echo "💾 Resource usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "✅ Deployment complete!"
DEPLOY

echo "✅ Step 3 complete"
echo ""

# Step 4: Verify deployment
echo "🔍 Step 4: Verifying deployment..."
sleep 10

ssh "$SERVER_USER@$SERVER_IP" <<'VERIFY'
cd /opt/risk-platform

echo "📊 Container status:"
docker-compose -f docker-compose.production.yml ps

echo ""
echo "🔍 Health checks:"
echo "Testing API Gateway..."
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:9002/health || echo "  ⚠️  Not ready yet"

echo ""
echo "📋 Recent logs (last 10 lines):"
docker-compose -f docker-compose.production.yml logs --tail=10
VERIFY

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application:"
echo "  API Gateway: http://$SERVER_IP:9002"
echo "  UI: http://$SERVER_IP:9010"
echo "  Health: http://$SERVER_IP:9002/health"
echo ""
echo "📊 Management commands:"
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && docker-compose -f docker-compose.production.yml logs -f'"
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && docker-compose -f docker-compose.production.yml restart'"
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && docker-compose -f docker-compose.production.yml down'"
echo ""

