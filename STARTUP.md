# VibeScan Startup Guide

## ⚡ Quick Start

```bash
./run.sh
```

This is the **ONLY** way to start the project. It handles:
1. ✅ Docker services (PostgreSQL, Redis, MinIO)
2. ✅ Wasp backend (Node.js on port 3555)
3. ✅ Frontend (React on port 3000)

## 📋 Available Startup Options

### Primary: `./run.sh`
```bash
# Start everything (Docker + Wasp full-stack)
./run.sh

# Stop all services
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

# Start Wasp backend in watch mode (separate terminal)
cd wasp-app
PORT=3555 wasp start
```

## 📍 Service Ports

- **Frontend (Wasp React):** http://localhost:3000
- **Backend API (Wasp Node.js):** http://localhost:3555
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379
- **MinIO Console:** http://localhost:9001

## 🧪 Testing

```bash
# Run all tests
npm test

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

## ⚠️ IMPORTANT - Fastify Removed (P0.2)

The legacy Fastify backend (/src/) has been completely removed.
All API routes are now served by Wasp only (port 3555).

## 🐛 Troubleshooting

### "Address already in use" on ports 3000/3555
```bash
./run.sh --stop
# or manually: kill $(lsof -t -i :3000) $(lsof -t -i :3555)
```

### Docker services not responding
```bash
docker-compose down
docker-compose up -d
./run.sh
```

### Database migration issues
```bash
cd wasp-app
wasp db migrate-dev
```

### Clear all caches
```bash
rm -rf node_modules wasp-app/node_modules
npm install
cd wasp-app && npm install
```

## 📊 Health Check

```bash
# Verify backend is running
curl http://localhost:3555/health

# Expected response:
# OK or {status:"ok",...}
```

## 🚀 Deployment

For production deployment, see `/deploy/kubernetes/` for deployment manifests.
