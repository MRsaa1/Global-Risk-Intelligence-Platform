# 🚀 Production Deployment Guide

**Global Risk Intelligence Platform - Production Deployment**

**Version:** 1.0.0  
**Last Updated:** 2024-01-15

---

## 📋 Pre-Deployment Checklist

### 1. Security & Authentication ✅

- [ ] **SSL/TLS Certificates**
  - Obtain SSL certificates (Let's Encrypt, AWS ACM, or internal CA)
  - Configure TLS termination at load balancer
  - Enable HTTPS only (redirect HTTP to HTTPS)
  - Set up certificate auto-renewal

- [ ] **Secrets Management**
  - Configure HashiCorp Vault or AWS Secrets Manager
  - Store all sensitive credentials (DB passwords, JWT secrets, API keys)
  - Rotate secrets regularly
  - Use Kubernetes Secrets with encryption at rest

- [ ] **Authentication & Authorization**
  - Configure OIDC/SAML providers
  - Set up JWT token validation
  - Implement RBAC policies
  - Enable MFA for admin accounts

- [ ] **Network Security**
  - Configure firewall rules
  - Set up VPC with private subnets
  - Enable DDoS protection
  - Configure rate limiting (100 req/min per user)

### 2. Infrastructure Setup ✅

- [ ] **Kubernetes Cluster**
  - Deploy EKS/GKE/AKS cluster
  - Configure node groups (min: 3, max: 10 nodes)
  - Set up autoscaling
  - Configure resource quotas

- [ ] **Database (PostgreSQL)**
  - Set up RDS/Aurora PostgreSQL (multi-AZ)
  - Configure automated backups (daily, 7-day retention)
  - Enable point-in-time recovery
  - Set up read replicas for scaling
  - Configure connection pooling (PgBouncer)

- [ ] **Redis Cluster**
  - Deploy Redis cluster (ElastiCache or self-managed)
  - Enable persistence (AOF)
  - Configure replication (3 replicas)
  - Set up Redis Sentinel for HA

- [ ] **Load Balancer**
  - Configure Application Load Balancer (ALB)
  - Set up health checks
  - Configure SSL termination
  - Enable WAF rules

### 3. Monitoring & Observability ✅

- [ ] **Metrics (Prometheus)**
  - Deploy Prometheus operator
  - Configure service monitors
  - Set up alerting rules
  - Configure retention (30 days)

- [ ] **Visualization (Grafana)**
  - Deploy Grafana
  - Import dashboards
  - Configure data sources
  - Set up alert notifications

- [ ] **Logging (ELK/Loki)**
  - Deploy Elasticsearch/Logstash/Kibana or Loki
  - Configure log aggregation
  - Set up log retention (90 days)
  - Configure log parsing and indexing

- [ ] **Tracing (OpenTelemetry)**
  - Configure distributed tracing
  - Set up trace collection
  - Configure sampling (10% for production)

- [ ] **Health Checks**
  - Configure liveness probes
  - Configure readiness probes
  - Set up external health check endpoint

### 4. CI/CD Pipeline ✅

- [ ] **GitHub Actions / GitLab CI**
  - Configure production deployment workflow
  - Set up automated testing
  - Configure deployment approvals
  - Set up rollback procedures

- [ ] **Container Registry**
  - Set up private container registry
  - Configure image scanning
  - Enable image signing
  - Set up retention policies

- [ ] **Deployment Strategy**
  - Configure blue-green or canary deployments
  - Set up automated rollback on failure
  - Configure deployment windows

### 5. Data Management ✅

- [ ] **Database Migrations**
  - Run production migrations
  - Test migrations on staging first
  - Set up migration rollback procedures
  - Document migration history

- [ ] **Backup Strategy**
  - Configure automated daily backups
  - Test backup restoration
  - Set up off-site backup storage
  - Document recovery procedures

- [ ] **Data Retention**
  - Configure data retention policies
  - Set up automated data archival
  - Configure GDPR compliance (data deletion)

---

## 🔧 Production Configuration

### Environment Variables

Create `.env.production` file:

```bash
# Application
NODE_ENV=production
PORT=8000

# Database
DATABASE_URL=postgresql://user:password@rds-endpoint:5432/risk_platform
DATABASE_POOL_SIZE=20
DATABASE_POOL_MAX=50

# Redis
REDIS_URL=redis://redis-cluster:6379
REDIS_PASSWORD=secure-redis-password

# JWT
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# API Gateway
REG_CALCULATOR_URL=http://reg-calculator-api:8080
RAY_ADDRESS=ray://ray-head:10001

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Kubernetes Secrets

Create secrets in Kubernetes:

```bash
kubectl create namespace risk-platform
kubectl create secret generic risk-platform-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=redis-url='redis://...' \
  --from-literal=jwt-secret='<strong-secret>' \
  --namespace=risk-platform
```

---

## 📦 Deployment Steps

### Step 1: Infrastructure Provisioning

```bash
# Using Terraform
cd infra/terraform
terraform init
terraform plan -var-file=production.tfvars
terraform apply -var-file=production.tfvars
```

### Step 2: Database Setup

```bash
# Run migrations
cd apps/api-gateway
npx prisma migrate deploy

# Verify database
npx prisma studio
```

### Step 3: Deploy to Kubernetes

```bash
# Apply namespace
kubectl apply -f infra/k8s/namespace.yaml

# Apply secrets
kubectl apply -f infra/k8s/secrets.yaml

# Deploy services
kubectl apply -f infra/k8s/postgres-deployment.yaml
kubectl apply -f infra/k8s/redis-deployment.yaml
kubectl apply -f infra/k8s/ray-head-deployment.yaml
kubectl apply -f infra/k8s/reg-calculator-deployment.yaml
kubectl apply -f infra/k8s/api-gateway-deployment.yaml
```

### Step 4: Configure Load Balancer

```bash
# Get load balancer endpoint
kubectl get svc api-gateway -n risk-platform

# Configure DNS
# Point your domain to the load balancer IP
```

### Step 5: Verify Deployment

```bash
# Check pod status
kubectl get pods -n risk-platform

# Check services
kubectl get svc -n risk-platform

# Check logs
kubectl logs -f deployment/api-gateway -n risk-platform

# Test health endpoint
curl https://your-domain.com/health
```

---

## 🔒 Security Hardening

### 1. Network Security

- Use private subnets for all services
- Configure security groups (only allow necessary ports)
- Enable VPC flow logs
- Use VPN for admin access

### 2. Application Security

- Enable HTTPS only
- Configure CORS properly
- Implement rate limiting
- Enable request validation
- Sanitize all inputs

### 3. Database Security

- Use encrypted connections (SSL/TLS)
- Enable database encryption at rest
- Use strong passwords
- Limit database access (IP whitelist)
- Enable audit logging

### 4. Secrets Management

- Never commit secrets to Git
- Use secrets management service
- Rotate secrets regularly
- Use least privilege principle
- Audit secret access

---

## 📊 Monitoring Setup

### Prometheus Metrics

Key metrics to monitor:

- **API Gateway**: Request rate, latency, error rate
- **Database**: Connection pool, query time, replication lag
- **Redis**: Memory usage, hit rate, connection count
- **Ray**: Worker count, task queue, CPU usage

### Grafana Dashboards

Create dashboards for:

- System overview
- API performance
- Database performance
- Error tracking
- User activity

### Alerting Rules

Configure alerts for:

- High error rate (> 1%)
- High latency (p95 > 1s)
- Low availability (< 99.9%)
- High resource usage (> 80%)
- Database connection issues

---

## 🔄 Backup & Recovery

### Backup Schedule

- **Database**: Daily full backup, hourly incremental
- **Redis**: Daily snapshot
- **Configuration**: Version controlled in Git

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from backup
   pg_restore -d risk_platform backup.dump
   ```

2. **Application Rollback**
   ```bash
   # Rollback deployment
   kubectl rollout undo deployment/api-gateway -n risk-platform
   ```

3. **Disaster Recovery**
   - RTO: 30 minutes
   - RPO: 5 minutes
   - Multi-region failover

---

## 🚨 Incident Response

### Runbook

1. **Identify Issue**
   - Check monitoring dashboards
   - Review logs
   - Check health endpoints

2. **Assess Impact**
   - Number of affected users
   - Severity level
   - Business impact

3. **Mitigate**
   - Apply hotfix if needed
   - Scale resources if needed
   - Rollback if necessary

4. **Communicate**
   - Notify stakeholders
   - Update status page
   - Document incident

5. **Post-Mortem**
   - Root cause analysis
   - Action items
   - Process improvements

---

## 📈 Performance Targets (SLOs)

- **Availability**: 99.95% uptime
- **Latency**: p95 < 1s for API calls
- **Throughput**: 1000 req/s per instance
- **Error Rate**: < 0.1%
- **Recovery Time**: < 30 minutes

---

## ✅ Post-Deployment Verification

- [ ] All services are running
- [ ] Health checks are passing
- [ ] SSL certificates are valid
- [ ] Monitoring is working
- [ ] Logs are being collected
- [ ] Backups are configured
- [ ] Alerts are configured
- [ ] Documentation is updated

---

## 📞 Support & Escalation

- **On-Call Rotation**: 24/7 coverage
- **Escalation Path**: Engineer → Lead → Manager → CTO
- **Status Page**: https://status.your-domain.com
- **Support Email**: support@your-domain.com

---

## 📚 Additional Resources

- [Kubernetes Best Practices](./KUBERNETES_BEST_PRACTICES.md)
- [Security Guidelines](./SECURITY_GUIDELINES.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

**Last Updated**: 2024-01-15  
**Maintained By**: Platform Team

