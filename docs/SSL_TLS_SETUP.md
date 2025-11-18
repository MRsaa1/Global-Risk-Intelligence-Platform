# 🔒 SSL/TLS Setup Guide

## Overview

This guide covers SSL/TLS certificate setup for the Global Risk Platform using:
- **Let's Encrypt** (free, automated)
- **AWS Certificate Manager (ACM)** (AWS-native)
- **Cert-Manager** (Kubernetes operator)

---

## Option 1: Let's Encrypt with Cert-Manager (Recommended)

### Prerequisites

- Kubernetes cluster with ingress controller
- Domain name pointing to your cluster
- Cert-Manager installed

### Step 1: Install Cert-Manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify installation
kubectl get pods -n cert-manager
```

### Step 2: Configure ClusterIssuer

```bash
# Apply ClusterIssuer configuration
kubectl apply -f infra/k8s/ingress.yaml

# Verify
kubectl get clusterissuer
```

### Step 3: Update Ingress with TLS

Edit `infra/k8s/ingress.yaml`:

1. Replace `your-domain.com` with your actual domain
2. Update email in ClusterIssuer
3. Apply:

```bash
kubectl apply -f infra/k8s/ingress.yaml
```

### Step 4: Verify Certificate

```bash
# Check certificate status
kubectl get certificate -n risk-platform

# Check certificate details
kubectl describe certificate risk-platform-tls -n risk-platform

# Verify TLS secret
kubectl get secret risk-platform-tls -n risk-platform
```

### Step 5: Test HTTPS

```bash
# Test endpoint
curl -I https://api.your-domain.com/health

# Should return 200 OK with valid certificate
```

---

## Option 2: AWS Certificate Manager (ACM)

### Step 1: Request Certificate in AWS

```bash
# Using AWS CLI
aws acm request-certificate \
  --domain-name api.your-domain.com \
  --subject-alternative-names dashboard.your-domain.com \
  --validation-method DNS \
  --region us-east-1

# Note the Certificate ARN
```

### Step 2: Validate Certificate

```bash
# Get validation records
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:account:certificate/cert-id \
  --region us-east-1

# Add DNS validation records to your domain
```

### Step 3: Configure ALB Ingress

Update `infra/k8s/ingress.yaml`:

```yaml
annotations:
  alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:us-east-1:account:certificate/cert-id"
  alb.ingress.kubernetes.io/ssl-redirect: '443'
```

### Step 4: Apply Configuration

```bash
kubectl apply -f infra/k8s/ingress.yaml
```

---

## Option 3: Self-Signed Certificate (Development Only)

### Generate Self-Signed Certificate

```bash
# Create certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=api.your-domain.com"

# Create Kubernetes secret
kubectl create secret tls risk-platform-tls \
  --cert=tls.crt \
  --key=tls.key \
  -n risk-platform
```

---

## Certificate Renewal

### Let's Encrypt (Automatic)

Cert-Manager automatically renews certificates before expiration (30 days before).

### AWS ACM (Automatic)

AWS ACM automatically renews certificates.

### Manual Renewal

```bash
# For Let's Encrypt
kubectl delete certificate risk-platform-tls -n risk-platform
kubectl apply -f infra/k8s/ingress.yaml

# For AWS ACM
# Request new certificate and update ARN
```

---

## Troubleshooting

### Certificate Not Issued

```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check certificate status
kubectl describe certificate risk-platform-tls -n risk-platform

# Check challenges
kubectl get challenges -n risk-platform
```

### Certificate Expired

```bash
# Check certificate expiration
kubectl get certificate -n risk-platform -o yaml | grep -A 5 notAfter

# Force renewal
kubectl delete certificate risk-platform-tls -n risk-platform
```

### DNS Validation Issues

- Ensure DNS records are correct
- Wait for DNS propagation (up to 48 hours)
- Check DNS with: `dig your-domain.com`

---

## Security Best Practices

1. **Use Strong Cipher Suites**
   - Configure TLS 1.2+ only
   - Disable weak ciphers

2. **Enable HSTS**
   ```yaml
   annotations:
     nginx.ingress.kubernetes.io/ssl-redirect: "true"
     nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
     nginx.ingress.kubernetes.io/hsts: "true"
   ```

3. **Certificate Pinning** (for mobile apps)
   - Pin certificate in mobile applications

4. **Regular Monitoring**
   - Monitor certificate expiration
   - Set up alerts for certificate issues

---

## Checklist

- [ ] Cert-Manager installed
- [ ] ClusterIssuer configured
- [ ] Ingress with TLS configured
- [ ] Certificate issued and valid
- [ ] HTTPS redirect working
- [ ] Certificate auto-renewal configured
- [ ] Monitoring alerts set up

---

**Next Step**: Configure Secrets Management

