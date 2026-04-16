# VibeScan Project Startup Guide

This document explains the proper startup procedures and available scripts.

## Quick Start (Recommended)

```bash
# 1. Install dependencies
./install-deps.sh

# 2. Start everything with one command
./run.sh
```

This starts:
- ✅ Docker services (PostgreSQL, Redis, MinIO)
- ✅ Backend API (Node.js 24.14.1)
- ✅ Frontend (Next.js)
- ✅ Log collection

**Stop everything**: `./run.sh --stop`

---

## Available Startup Scripts

### 1. `./run.sh` - Full Project Startup ⭐ PRIMARY

**Use case**: Local development with everything running

```bash
./run.sh                    # Start full stack
./run.sh --stop            # Stop all services
./run.sh --help            # Show options
```

**What it does**:
- Starts Docker infrastructure (PostgreSQL, Redis, MinIO)
- Starts backend API server
- Starts frontend development server
- Manages logs and PIDs

**Documentation**: See README.md "Quick Start" section

---

### 2. `./run-wasp.sh` - Wasp Framework Development

**Use case**: When developing with Wasp framework

```bash
npm run wasp:dev           # Runs ./run-wasp.sh
```

**What it does**:
- Validates Wasp CLI installation
- Checks wasp-app structure
- Starts Wasp dev server

**Wasp location**: `wasp-app/main.wasp`

---

### 3. `./scripts/dev-up.sh` - Backend Only

**Use case**: Backend development without full stack

```bash
npm run dev:up             # Start backend + Docker infra
npm run dev:stop           # Stop backend
```

**What it does**:
- Starts Docker services (PostgreSQL, Redis, MinIO)
- Starts backend API on port 3001
- Keeps frontend stopped

---

### 4. `./scripts/wasp-dev.sh` - Wasp Backend Only

**Use case**: Wasp backend development

```bash
npm run wasp:up            # Start Wasp backend + Docker
npm run wasp:down          # Stop Wasp backend
```

**What it does**:
- Starts Docker services
- Starts Wasp dev server
- Keeps frontend stopped

---

### 5. `./scripts/start.sh` - Production-like Setup

**Use case**: Testing production-like setup locally

```bash
./scripts/start.sh
```

**What it does**:
- Starts Docker services with production config
- Detects server IP address
- Configures frontend with server IP

---

### 6. `./install-deps.sh` - Environment Setup

**Use case**: One-time environment setup

```bash
./install-deps.sh
```

**What it does**:
- Installs system dependencies
- Sets up Node.js environment
- Installs npm packages

---

## npm Scripts Reference

```bash
npm run dev              # Start backend API (development mode)
npm run dev:up          # Start backend + Docker infrastructure
npm run dev:stop        # Stop backend and infrastructure
npm run wasp:dev        # Start Wasp development server
npm run wasp:up         # Start Wasp backend + Docker
npm run wasp:down       # Stop Wasp backend
npm run migrate         # Run database migrations
npm run test            # Run tests
npm run test:e2e        # Run end-to-end tests
npm run lint            # Run linter
npm run seed:mock-data  # Generate mock data
```

---

## Recommended Workflows

### 1. Full Stack Development (Recommended)

```bash
./run.sh
```

- Starts: PostgreSQL + Redis + MinIO + Backend + Frontend
- Logs: `.logs/dev/backend.log` and `.logs/dev/frontend.log`
- Stop: `./run.sh --stop`

### 2. Backend Development Only

```bash
npm run dev:up
cd vibescan-ui && npm run dev  # Optionally start frontend separately
```

- Starts: PostgreSQL + Redis + MinIO + Backend
- Test changes: `npm test`
- Restart: `npm run dev:stop && npm run dev:up`

### 3. Wasp Development

```bash
npm run wasp:dev
```

- Starts: Wasp dev server with hot reload
- Location: `wasp-app/src/**`
- Test: `npm run test:e2e:wasp`

### 4. Production-like Setup

```bash
./scripts/start.sh
```

- Simulates production environment
- Uses server IP detection
- All services in Docker

---

## Troubleshooting

### Port Already in Use

```bash
# Stop existing processes
./run.sh --stop

# Check what's running on ports
netstat -tlnp | grep :3000  # Frontend
netstat -tlnp | grep :3001  # Backend
```

### Docker Issues

```bash
# Restart Docker
docker-compose down -v  # Remove volumes
./run.sh                # Restart fresh
```

### Database Migration Errors

```bash
npm run migrate:rollback  # Rollback last migration
npm run migrate          # Run migrations again
```

### Logs Location

- Backend: `.logs/dev/backend.log`
- Frontend: `.logs/dev/frontend.log`
- Wasp: `.logs/wasp-dev/wasp-dev.log`

---

## Script Hierarchy

```
./run.sh (Primary Entry Point)
├── Calls: ./scripts/dev-up.sh
│   ├── Docker services (PostgreSQL, Redis, MinIO)
│   └── Backend API
└── Frontend (separately)

./run-wasp.sh (Wasp Development)
└── Wasp dev server

./scripts/wasp-dev.sh (Wasp Backend)
├── Docker services
└── Wasp server

./scripts/start.sh (Production Simulation)
├── Docker services (production config)
├── Backend API
└── Frontend

./install-deps.sh (One-time Setup)
├── System dependencies
├── Node.js environment
└── npm packages
```

---

## Deleted/Deprecated Scripts

❌ **Removed**:
- `d.sh` - OS-level Docker installation (use Docker docs instead)
- `clazai.sh` - Claude CLI setup (not project startup)

**Why**: These were:
1. Not project startup-related
2. Not referenced in README or package.json
3. Not part of the standard development workflow

---

## Next Steps

After startup, see:
- 📖 README.md - Full project documentation
- 🚀 CONTRIBUTING.md - Development guidelines
- 🧪 Testing - Run `npm test` for unit tests
- 🌐 Frontend - Access at http://localhost:3000
- 🔧 API - Docs at http://localhost:3001/swagger

---

## Quick Reference

| Need | Command |
|------|---------|
| Full stack | `./run.sh` |
| Stop everything | `./run.sh --stop` |
| Backend only | `npm run dev:up` |
| Wasp development | `npm run wasp:dev` |
| Run tests | `npm test` |
| View logs | `tail -f .logs/dev/backend.log` |
