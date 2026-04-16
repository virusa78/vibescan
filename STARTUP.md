# VibeScan Startup Guide

## ⚡ Quick Start

```bash
./run.sh
```

This is the **ONLY** way to start the project. It handles:
1. ✅ Docker services (PostgreSQL, Redis, MinIO)
2. ✅ Backend (Fastify API on port 3001)
3. ✅ Frontend (Wasp on port 3000)

## 📋 Available Startup Options

### Primary: `./run.sh`
```bash
# Start everything (Docker + backend + Wasp frontend)
./run.sh

# Stop all processes started by run.sh
./run.sh --stop

# Show help
./run.sh --help
```

### Alternative: `./run-wasp.sh`
```bash
# Pure Wasp CLI (requires Wasp CLI installed globally)
./run-wasp.sh
# Note: You must start Docker services separately first:
# docker-compose up -d
```

### Backend Only (development)
```bash
# Start only Docker services
docker-compose up -d

# Start backend in watch mode (separate terminal)
npm run dev
```

## 📍 Service Ports

- **Frontend (Wasp):** http://localhost:3000
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379
- **MinIO Console:** http://localhost:9001

## 🧪 Testing

```bash
# Run all tests
npm test

# Run backend tests only
npm test

# Run Wasp tests only
cd wasp-app && npm test

# Run specific test file
npm test -- test/unit/property-tests.test.ts

# Run with coverage
npm run test:coverage
```

## 🛠️ Utility Scripts

```bash
# Run test suite with health checks
./scripts/run-tests.sh

# Simulate Grype scanner output
./scripts/simulate-grype-sbom-scan.sh <sbom_path> [output_path]

# Simulate Black Duck scanner output
./scripts/simulate-blackduck-sbom-scan.sh <sbom_path> [output_path]
```

## ⚠️ IMPORTANT - DO NOT USE THESE (DELETED)

These scripts were removed and should NOT be used:
- ❌ `install-deps.sh` - Use `npm install` instead
- ❌ `scripts/cleanup.sh` - Cleanup now handled by run.sh
- ❌ `scripts/start.sh` - Replaced by `run.sh`
- ❌ `scripts/wasp-dev.sh` - Replaced by `run-wasp.sh`

## 🐛 Troubleshooting

### "Address already in use" on ports 3000/3001
```bash
./run.sh --stop
# or manually: kill $(lsof -t -i :3000) $(lsof -t -i :3001)
```

### Docker services not responding
```bash
docker-compose down
docker-compose up -d
./run.sh
```

### Database migration issues
```bash
npm run migrate
npm run migrate:rollback
```

### Clear all caches
```bash
rm -rf node_modules wasp-app/node_modules
npm install
cd wasp-app && npm install
```

## 📊 Health Check

```bash
# Verify all services running
curl http://localhost:3001/health

# Expected response:
# {"status":"healthy","services":{"database":"ok","redis":"ok","s3":"ok",...}}
```

## 🚀 Deployment

For production deployment, see `/deploy/kubernetes/` for deployment manifests.
