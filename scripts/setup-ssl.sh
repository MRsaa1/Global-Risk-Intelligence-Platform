#!/bin/bash
# SSL/TLS Setup Script for Global Risk Platform

set -e

echo "🔒 SSL/TLS Setup for Global Risk Platform"
echo "=========================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if cert-manager is installed
echo "📦 Checking cert-manager installation..."
if ! kubectl get namespace cert-manager &> /dev/null; then
    echo "Installing cert-manager..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    echo "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
else
    echo "✅ cert-manager already installed"
fi

# Prompt for domain
read -p "Enter your domain (e.g., api.your-domain.com): " DOMAIN
read -p "Enter your email for Let's Encrypt: " EMAIL

# Create namespace if not exists
kubectl create namespace risk-platform --dry-run=client -o yaml | kubectl apply -f -

# Update ingress.yaml with domain and email
echo "📝 Updating ingress configuration..."
sed -i.bak "s/your-domain.com/$DOMAIN/g" infra/k8s/ingress.yaml
sed -i.bak "s/admin@your-domain.com/$EMAIL/g" infra/k8s/ingress.yaml

# Apply ingress configuration
echo "🚀 Applying ingress configuration..."
kubectl apply -f infra/k8s/ingress.yaml

# Wait for certificate
echo "⏳ Waiting for certificate to be issued (this may take a few minutes)..."
kubectl wait --for=condition=ready certificate risk-platform-tls -n risk-platform --timeout=600s || {
    echo "⚠️  Certificate not ready. Checking status..."
    kubectl describe certificate risk-platform-tls -n risk-platform
    exit 1
}

echo ""
echo "✅ SSL/TLS setup complete!"
echo ""
echo "Certificate details:"
kubectl get certificate -n risk-platform
echo ""
echo "Test your endpoint:"
echo "curl -I https://$DOMAIN/health"
echo ""

