# VibeScan Scripts Reference Card

## 🎯 Quick Start

```bash
./run.sh        # Start everything (recommended)
./run.sh --stop # Stop everything
```

---

## 📋 Root Scripts (Primary Entry Points)

### `./run.sh` ⭐ PRIMARY
Full project startup
```bash
./run.sh                    # Start full stack
./run.sh --stop            # Stop all services
./run.sh --help            # Show all options
```
- Docker infrastructure
- Backend API
- Frontend development server
- Automatic logging

### `./run-wasp.sh`
Wasp framework development
```bash
npm run wasp:dev           # Same as ./run-wasp.sh
```
- Validates Wasp CLI
- Starts Wasp dev server
- Hot reload enabled

### `./install-deps.sh`
Environment setup (one-time)
```bash
./install-deps.sh
```
- System dependencies
- Node.js environment
- npm packages

---

## 🛠️ Supporting Scripts (in ./scripts/)

### `./scripts/dev-up.sh`
Backend + Docker only
```bash
npm run dev:up             # Start backend
npm run dev:stop           # Stop backend
```

### `./scripts/wasp-dev.sh`
Wasp backend + Docker
```bash
npm run wasp:up            # Start Wasp backend
npm run wasp:down          # Stop Wasp backend
```

### `./scripts/start.sh`
Production-like setup
```bash
./scripts/start.sh
```
- Server IP detection
- Production config
- Full Docker stack

### `./scripts/run-tests.sh`
Test runner
```bash
npm test
```

### `./scripts/cleanup.sh`
Remove temporary files

### `./scripts/simulate-grype-sbom-scan.sh`
Mock Grype scanner for testing

### `./scripts/simulate-blackduck-sbom-scan.sh`
Mock BlackDuck scanner for testing

---

## 📦 npm Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start backend API only |
| `npm run dev:up` | Start backend + Docker |
| `npm run dev:stop` | Stop backend |
| `npm run wasp:dev` | Start Wasp dev server |
| `npm run wasp:up` | Start Wasp + Docker |
| `npm run wasp:down` | Stop Wasp |
| `npm run migrate` | Run migrations |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:e2e:wasp` | E2E tests with Wasp |
| `npm run lint` | Run linter |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run seed:mock-data` | Generate mock data |

---

## 🔄 Workflow Recipes

### Full Stack Development
```bash
./run.sh
# Access:
# - Frontend: http://192.168.1.17:3000
# - API: http://192.168.1.17:3555
# - API Docs: http://192.168.1.17:3555/swagger
```

### Backend Only
```bash
npm run dev:up
# Access: http://192.168.1.17:3555
```

### Wasp Development
```bash
npm run wasp:dev
# Access: http://192.168.1.17:3000
# Wasp code: wasp-app/src/**
```

### Testing
```bash
npm test                        # All tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage
npm run test:e2e               # E2E tests
```

### Stop All Services
```bash
./run.sh --stop
```

---

## 📍 Log Locations

| Service | Log File |
|---------|----------|
| Backend | `.logs/dev/backend.log` |
| Frontend | `.logs/dev/frontend.log` |
| Wasp | `.logs/wasp-dev/wasp-dev.log` |

View logs:
```bash
tail -f .logs/dev/backend.log
tail -f .logs/dev/frontend.log
```

---

## 🗑️ Deleted Scripts (⚠️ No longer available)

| Script | Reason |
|--------|--------|
| `d.sh` | OS Docker setup (use Docker docs) |
| `clazai.sh` | Claude CLI setup (security risk) |

See `STARTUP_GUIDE.md` for details.

---

## ✅ Status Indicators

✅ = Keep using  
⭐ = Recommended/Primary  
📌 = One-time setup  
🔧 = Utility/Support  

---

## 📖 For More Information

- Full guide: `STARTUP_GUIDE.md`
- Main docs: `README.md`
- Contributing: `CONTRIBUTING.md`
- Wasp docs: `wasp-app/main.wasp`

---

## 🆘 Quick Troubleshooting

### Port in use?
```bash
./run.sh --stop  # Stop existing services
```

### Check processes?
```bash
ps aux | grep "node\|wasp"
```

### View detailed logs?
```bash
tail -100 .logs/dev/backend.log  # Last 100 lines
```

### Reset everything?
```bash
./run.sh --stop
docker-compose down -v  # Remove volumes
./run.sh                # Fresh start
```

---

**Last updated**: April 2026  
**Status**: Production Ready ✅  
**Primary Script**: `./run.sh`
