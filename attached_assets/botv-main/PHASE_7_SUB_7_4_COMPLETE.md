# Phase 7, Sub-phase 7.4: Container & Deployment - Complete

## Overview

Sub-phase 7.4 provides production-ready containerization and deployment infrastructure. This includes Docker image, Docker Compose for local development, and Kubernetes manifests for production deployment.

## Deliverables

### 1. Dockerfile

**Base Image**: python:3.11-slim-alpine (minimal footprint)

**Build Stages**:
1. Install system dependencies (gcc, PostgreSQL client)
2. Copy and install Python requirements
3. Copy application code
4. Create non-root app user (security)
5. Configure health checks
6. Expose port 8000

**Key Features**:
- Alpine Linux for minimal size
- Non-root user execution
- Health check via HTTP endpoint
- Unbuffered Python output
- Production-ready settings

**Build and Run**:
```bash
# Build image
docker build -t langsense-api:latest .

# Run container
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://... \
  -e BOT_TOKEN=... \
  langsense-api:latest
```

### 2. Docker Compose (docker-compose.yml)

**Services**:

1. **postgres**
   - PostgreSQL 15 Alpine
   - Health checks
   - Persistent volume
   - Network isolation

2. **api**
   - Built from Dockerfile
   - Auto-initializes database
   - Hot reload enabled (development)
   - Depends on postgres
   - Health checks

3. **bot**
   - Telegram bot service
   - Depends on api and postgres
   - Separate container from API

4. **redis** (optional)
   - Enabled via profiles
   - For caching/queues
   - Optional in production

**Network**: langsense-network (bridge)

**Volumes**: postgres_data (persistent)

**Usage**:
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Reset database
docker-compose down -v

# With optional services
docker-compose --profile optional up -d
```

### 3. Kubernetes Manifests (k8s/deployment.yaml)

**Resources Defined**:

1. **Namespace**: langsense
   - Isolated environment
   - Resource management

2. **ConfigMap**: langsense-config
   - Non-sensitive configuration
   - Environment variables
   - 13 configuration values

3. **Secret**: langsense-secrets
   - Sensitive data (passwords, tokens)
   - Base64 encoded
   - Database URL, secret key, bot token

4. **StatefulSet**: postgres
   - Stateful database
   - Single replica
   - Persistent storage (10Gi)
   - Health checks (liveness/readiness)
   - Resource limits

5. **Service**: postgres-service
   - Headless service for StatefulSet
   - Internal DNS (postgres-service:5432)

6. **Deployment**: langsense-api
   - API server
   - 2 replicas (configurable)
   - Rolling updates
   - Pod anti-affinity (spread across nodes)
   - Health checks (liveness/readiness)
   - Resource limits

7. **Service**: langsense-api-service
   - LoadBalancer type
   - Port 80 → 8000
   - External access

8. **HorizontalPodAutoscaler**: langsense-api-hpa
   - Min 2 replicas
   - Max 10 replicas
   - CPU threshold: 70%
   - Memory threshold: 80%

9. **PodDisruptionBudget**: langsense-api-pdb
   - Minimum 1 pod available
   - Prevents disruption cascades

10. **ServiceAccount**: langsense-api
    - Kubernetes authentication

11. **Role** + **RoleBinding**
    - RBAC configuration
    - Access to ConfigMaps and Secrets

**Kubernetes Features**:
- Health checks (liveness/readiness probes)
- Automatic scaling (HPA)
- Pod disruption protection
- Anti-affinity for distribution
- Resource requests/limits
- RBAC security

## Deployment Strategies

### Local Development
```bash
# Using Docker Compose
docker-compose up -d

# Access API: http://localhost:8000
# Database: localhost:5432
```

### Staging
```bash
# Build image
docker build -t langsense-api:staging .

# Push to registry
docker tag langsense-api:staging myregistry.com/langsense-api:staging
docker push myregistry.com/langsense-api:staging

# Deploy to K8s
kubectl apply -f k8s/deployment.yaml
```

### Production
```bash
# Build and push
docker build -t langsense-api:v1.0.0 .
docker tag langsense-api:v1.0.0 myregistry.com/langsense-api:v1.0.0
docker push myregistry.com/langsense-api:v1.0.0

# Update K8s image
kubectl -n langsense set image deployment/langsense-api \
  api=myregistry.com/langsense-api:v1.0.0

# Monitor rollout
kubectl -n langsense rollout status deployment/langsense-api
```

## Kubernetes Deployment

### Prerequisites
- Kubernetes 1.20+
- kubectl configured
- Container registry (Docker Hub, ECR, GCR, etc.)

### Setup

1. **Create namespace**:
```bash
kubectl create namespace langsense
```

2. **Configure secrets**:
```bash
# Edit k8s/deployment.yaml with real values
# Or use:
kubectl -n langsense create secret generic langsense-secrets \
  --from-literal=DATABASE_URL=postgresql+asyncpg://... \
  --from-literal=SECRET_KEY=... \
  --from-literal=BOT_TOKEN=...
```

3. **Deploy**:
```bash
kubectl apply -f k8s/deployment.yaml
```

4. **Verify**:
```bash
# Check pods
kubectl -n langsense get pods

# Check services
kubectl -n langsense get svc

# Check deployments
kubectl -n langsense get deployments
```

### Access API

```bash
# Get external IP
kubectl -n langsense get svc langsense-api-service

# Access API
curl http://<EXTERNAL-IP>/health/live

# Port forward (if using ClusterIP)
kubectl -n langsense port-forward svc/langsense-api-service 8000:80
```

### Monitoring

```bash
# View logs
kubectl -n langsense logs -f deployment/langsense-api

# Check pod status
kubectl -n langsense describe pod <pod-name>

# Watch events
kubectl -n langsense get events -w

# Check HPA status
kubectl -n langsense get hpa
```

### Scaling

```bash
# Manual scale
kubectl -n langsense scale deployment langsense-api --replicas=5

# View HPA status
kubectl -n langsense get hpa langsense-api-hpa

# Edit HPA
kubectl -n langsense edit hpa langsense-api-hpa
```

### Updates

```bash
# Rolling update
kubectl -n langsense set image deployment/langsense-api \
  api=langsense-api:v1.1.0

# Check rollout status
kubectl -n langsense rollout status deployment/langsense-api

# Rollback if needed
kubectl -n langsense rollout undo deployment/langsense-api
```

## Docker Compose Commands

```bash
# Start in background
docker-compose up -d

# Start with specific service
docker-compose up -d api

# View logs
docker-compose logs -f api

# Execute command in container
docker-compose exec api bash

# Stop services
docker-compose stop

# Stop and remove
docker-compose down

# Remove volumes too
docker-compose down -v

# Rebuild image
docker-compose build --no-cache

# View running containers
docker-compose ps
```

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/db
SECRET_KEY=<32+ character secret>
BOT_TOKEN=<telegram bot token>
```

### Optional
```bash
ENVIRONMENT=production  # development|staging|production
DEBUG=false
LOG_LEVEL=INFO  # DEBUG|INFO|WARNING|ERROR|CRITICAL
API_WORKERS=4
DB_POOL_SIZE=10
```

## Health Check Endpoints

```bash
# Liveness (is pod alive)
GET /health/live → 200

# Readiness (can accept traffic)
GET /health/ready → 200

# Full check (detailed status)
GET /health/check → detailed JSON

# Security status
GET /health/security → abuse/DDoS info
```

## Resource Requirements

### Development
- API: 256Mi memory, 250m CPU
- Database: 256Mi memory, 250m CPU

### Production
- API: 512Mi memory, 500m CPU (× replicas)
- Database: 1Gi memory, 1000m CPU
- HPA scales 2-10 replicas based on load

## Security Best Practices

✅ Non-root user in containers
✅ Secrets not in ConfigMap
✅ RBAC roles limited to necessary permissions
✅ Resource limits to prevent resource exhaustion
✅ Health checks verify service readiness
✅ PodDisruptionBudget prevents cascading failures
✅ Pod anti-affinity spreads load across nodes
✅ Secret encryption in etcd (enable with K8s)

## Troubleshooting

### Pod won't start
```bash
kubectl -n langsense describe pod <pod-name>
kubectl -n langsense logs <pod-name>
```

### Database connection failing
```bash
# Check postgres pod
kubectl -n langsense get pods -l app=postgres

# Check logs
kubectl -n langsense logs <postgres-pod>

# Test connection from api pod
kubectl -n langsense exec -it <api-pod> -- \
  psql -h postgres-service -U langsense -d langsense
```

### Health check failing
```bash
# Check endpoint
curl http://<api-service>/health/check

# View health details
kubectl -n langsense exec <api-pod> -- \
  curl http://localhost:8000/health/check
```

### Scaling not working
```bash
# Check metrics server
kubectl get deployment metrics-server -n kube-system

# Install if missing:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Check HPA status
kubectl -n langsense describe hpa langsense-api-hpa
```

## Files Created

1. `Dockerfile` (45 lines)
   - Production-ready image definition

2. `docker-compose.yml` (updated, 100+ lines)
   - Development environment orchestration

3. `k8s/deployment.yaml` (280+ lines)
   - Kubernetes manifests
   - Namespace, ConfigMap, Secret
   - StatefulSet (database), Deployment (API)
   - Services, HPA, PDB
   - RBAC (ServiceAccount, Role, RoleBinding)

**Total: 425+ lines of deployment infrastructure**

## Status

✅ Sub-phase 7.4 COMPLETE
- Dockerfile production-ready
- Docker Compose configured
- Kubernetes manifests complete
- StatefulSet for database
- Deployment with replicas
- Auto-scaling configured
- Health checks integrated
- RBAC security configured
- Pod disruption protection

## Key Features

✅ Multi-service orchestration
✅ Automatic database initialization
✅ Health checks (Kubernetes-compatible)
✅ Horizontal pod autoscaling
✅ Pod anti-affinity (node spreading)
✅ Resource limits and requests
✅ Secrets management
✅ RBAC security
✅ Rolling updates
✅ Rollback capability

## Phase 7 Complete

All 4 sub-phases complete:
1. ✅ Health & Monitoring (7.1)
2. ✅ Configuration Validation (7.2)
3. ✅ Database & Migrations (7.3)
4. ✅ Container & Deployment (7.4)

**Total Phase 7: 5,000+ lines of production infrastructure**

Ready for deployment to production environments.
