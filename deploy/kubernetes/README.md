# VibeScan Kubernetes Deployment

## Overview
This directory contains Kubernetes deployment manifests for VibeScan.

## Prerequisites
- Kubernetes cluster (1.25+)
- kubectl configured with cluster access
- Helm 3+ (optional)

## Deployment

### 1. Create Namespace
```bash
kubectl apply -f namespace.yaml
```

### 2. Create Secrets
```bash
# Edit secret.yaml with your values first
kubectl apply -f secret.yaml
```

### 3. Create ConfigMap
```bash
kubectl apply -f configmap.yaml
```

### 4. Deploy Services
```bash
# PostgreSQL
kubectl apply -f postgres-deployment.yaml

# Redis
kubectl apply -f redis-deployment.yaml

# API Gateway
kubectl apply -f api-deployment.yaml

# Scan Orchestrator
kubectl apply -f scan-orchestrator-deployment.yaml

# Free Scanner Worker
kubectl apply -f free-worker-deployment.yaml

# Enterprise Scanner Worker
kubectl apply -f enterprise-worker-deployment.yaml

# Auth Service
kubectl apply -f auth-service-deployment.yaml
```

### 5. Apply Network Policies
```bash
kubectl apply -f network-policy.yaml
```

## Service Ports

| Service | Port | Type |
|---------|------|------|
| API Gateway | 3000 | ClusterIP |
| PostgreSQL | 5432 | ClusterIP |
| Redis | 6379 | ClusterIP |

## Ingress (Optional)
For external access, configure an Ingress controller:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibescan-ingress
  namespace: vibescan
spec:
  rules:
    - host: vibescan.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: vibescan-api
                port:
                  number: 3000
```

## Monitoring
Prometheus metrics are available at `/metrics` on the API service.

## Alerting
Alerting rules are defined in `src/alerting/rules.ts`.

## Cleanup
```bash
kubectl delete -f namespace.yaml
```
