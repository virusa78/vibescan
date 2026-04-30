# Dev Environment Bootstrap - Complete Setup Guide

## Overview

The VibeScan dev environment is now fully orchestrated with:
- **Automated infrastructure** (Docker services: PostgreSQL, Redis, MinIO)
- **Database seeding** (6 months of demo data with 3 test users)
- **Environment profiles** (.env.dev, .env.test, .env.ci)
- **Smoke tests** (basic health checks and API validation)
- **Build verification** (wasp build + tsc + npm test gates)

## Quick Start

### Full setup (recommended for first run):
```bash
./scripts/dev-bootstrap.sh --full
```

This:
1. Starts Docker stack (PostgreSQL, Redis, MinIO)
2. Applies database migrations
3. Seeds 6 months of mock data with 3 demo users
4. Builds and starts Wasp app
5. Runs basic smoke tests

**Expected time**: ~5-10 minutes

### Development mode (after bootstrap):
```bash
cd wasp-app
PORT=3555 wasp start
```

### Stop dev environment:
```bash
./scripts/dev-down.sh
```

## Environment Files

### .env.server (Development)
**Location**: `wasp-app/.env.server`
- **Port**: 3555 (Backend)
- **Database**: vibescan_wasp (PostgreSQL)
- **Storage**: MinIO on localhost:9000
- **Use case**: Local development with real-time Wasp hot reload

### .env.test (Testing)
**Location**: `wasp-app/.env.test`
- **Port**: 3556 (Test server)
- **Database**: vibescan_test (isolated, cleaned per run)
- **Storage**: MinIO on localhost:9001 (separate bucket)
- **Use case**: Jest integration tests, Playwright E2E tests
- **Loaded by**: `npm test` (via jest.config.js)

### .env.ci (CI/CD Pipeline)
**Location**: `wasp-app/.env.ci`
- **Port**: 3557 (CI server)
- **Database**: vibescan_ci (ephemeral in CI runner)
- **Storage**: Mock S3 (disabled in CI)
- **Use case**: GitHub Actions, automated builds
- **Loaded by**: GitHub Actions workflows

## Demo Users

Three seeded users with different plans and activity levels:

| Email | Password | Plan | Activity |
|-------|----------|------|----------|
| arjun.mehta@finstack.io | vs_demo_pro_2026 | Pro | 50-100 scans/month |
| priya.sharma@devcraft.in | vs_demo_starter_2026 | Starter | 10-30 scans/month |
| rafael.torres@securecorp.com | vs_demo_ent_2026 | Enterprise | 30-60 scans/month |

Each user has:
- 6 months of scan history
- 5-20 CVEs per scan
- Free and enterprise scanner results
- Calculated scan deltas (delta counts & severity breakdown)
- Webhook configurations
- API keys

## Scripts

### dev-bootstrap.sh
**Full environment setup with orchestration**

Options:
```bash
./scripts/dev-bootstrap.sh              # Start infra + app only
./scripts/dev-bootstrap.sh --seed       # + seed mock data
./scripts/dev-bootstrap.sh --smoke      # + run smoke tests
./scripts/dev-bootstrap.sh --full       # Everything (recommended)
./scripts/dev-bootstrap.sh --help       # Show help
```

Output logs:
- `wasp-startup.log` - Full Wasp build output
- `smoke-flow.log` - Test execution report

### dev-down.sh
**Cleanup and stop all services**

```bash
./scripts/dev-down.sh
```

Stops:
- Wasp development server
- Docker containers (PostgreSQL, Redis, MinIO)

### smoke-flow.sh
**Validation of core user journeys**

```bash
./scripts/smoke-flow.sh
```

Tests:
- Backend health check
- Dashboard API response
- Scans list endpoint
- OpenAPI schema availability

Requires: Backend running (`wasp start`)

### fill-mock-data.ts
**Database seeding with demo data**

```bash
# Seed with 6 months of data
DEMO_MONTHS=6 RESET_DEMO_DATA=true npx ts-node scripts/fill-mock-data.ts

# Seed with 12 months of data
DEMO_MONTHS=12 RESET_DEMO_DATA=true npx ts-node scripts/fill-mock-data.ts
```

## Build & Test Gates

### Continuous Build Requirement
**All changes must pass**:

```bash
# 1. Build Wasp
npm run build

# 2. Type check
npx tsc --noEmit

# 3. Lint
npm run lint

# 4. Tests
npm test
```

### Local verification before commit:
```bash
# Quick check (build + types)
npm run build && npx tsc --noEmit

# Full check (+ linting + tests)
npm run build && npx tsc --noEmit && npm run lint && npm test
```

## Fail-Fast Rules

These conditions indicate a broken dev environment:

1. **Build fails**: `npm run build` exits non-zero
   - **Fix**: `cd wasp-app && wasp clean && npm install && npm run build`

2. **Type errors**: `npx tsc --noEmit` shows errors
   - **Fix**: Check tsconfig.json paths, verify import statements

3. **Linting errors**: `npm run lint` fails
   - **Fix**: Run `npm run lint:fix` to auto-fix style issues

4. **Tests fail**: `npm test` has failing suites
   - **Fix**: Check .env.test is set, run `wasp db migrate-dev`

5. **Wasp dev server won't start**: Backend not responding
   - **Fix**: Check PORT 3555 is free, review wasp-startup.log

6. **Database errors**: Connection refused or schema mismatch
   - **Fix**: Ensure PostgreSQL is running, run migrations: `wasp db migrate-dev`

7. **Smoke tests fail**: Health checks not passing
   - **Fix**: Verify backend is running on 3555, check Docker services

## Seeded Data Structure

After running `--seed`, database contains:

### Users (3 total)
- Email, hashed password, region, plan (Pro/Starter/Enterprise)
- Quota ledger entries
- API keys with bcrypt-hashed secrets

### Scans (270-480 total)
- Distributed across 6 months for each user
- Random input types: source_zip, github_app, sbom_upload, ci_plugin
- Status: all marked as 'done'
- Repository references and branch names

### Findings (2,700-4,800 total)
- Sourced from 25 real CVE examples
- Severity distribution: CRITICAL, HIGH, MEDIUM, LOW
- CVSS scores, EPSS scores, exploitability flags
- References to NVD

### Scan Results (540-960 total)
- Free scanner results (Grype)
- Enterprise scanner results (Codescoring)
- Raw output JSON blobs
- Duration metrics

### Scan Deltas
- Delta counts (enterprise-only findings)
- Severity breakdowns
- Delta history per scan

### Webhooks & API Keys
- Example webhook URLs
- Signed secrets (HMAC-SHA256)
- API key hashes and usage timestamps

## Post-Bootstrap Verification

After running `--full`, verify:

```bash
# 1. Check frontend loads
curl -s http://localhost:3000 | head -20

# 2. Check backend health
curl -s http://localhost:3555/health | jq .

# 3. Check API is working
curl -s http://localhost:3555/api/v1/scans | jq . | head -20

# 4. Check database has data
docker-compose exec -T postgres psql -U postgres -d vibescan_wasp \
  -c "SELECT COUNT(*) as user_count FROM \"User\";"

# 5. Check demo users exist
docker-compose exec -T postgres psql -U postgres -d vibescan_wasp \
  -c "SELECT email, plan FROM \"User\" WHERE email LIKE '%@%';"
```

## Troubleshooting

### "Port 3555 already in use"
```bash
lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9
# Or use different port:
PORT=3556 wasp start
```

### "Cannot connect to PostgreSQL"
```bash
# Check if container is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### "Wasp build fails with module errors"
```bash
cd wasp-app
wasp clean
npm install
npm run build
```

### "Tests timeout or hang"
```bash
# Kill stale test processes
pkill -f "node.*jest" || true
pkill -f "node.*vitest" || true

# Run tests with verbose output
npm test -- --verbose

# Run single test file
npm test -- test/unit/auth.test.ts
```

### "Database schema mismatch"
```bash
# Apply pending migrations
cd wasp-app
wasp db migrate-dev

# Or reset to clean slate (⚠️ deletes all data)
docker-compose exec -T postgres psql -U postgres -c \
  "DROP DATABASE vibescan_wasp; CREATE DATABASE vibescan_wasp;"
wasp db migrate-dev
```

## Advanced Usage

### Run specific test suite
```bash
npm test -- test/integration/dashboard.test.ts
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Generate type definitions
```bash
cd wasp-app
npx tsc --emitDeclarationOnly
```

### Debug with VS Code
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Wasp Server",
      "program": "${workspaceFolder}/wasp-app/.wasp/out/server/app.js",
      "cwd": "${workspaceFolder}/wasp-app"
    }
  ]
}
```

## CI/CD Integration

### GitHub Actions
Uses `npm run build && npm test` with:
- `.env.ci` for environment
- Parallel test suites
- Coverage reporting
- Build artifact caching

### Database for CI
Set `DATABASE_URL` in GitHub Secrets:
```
postgresql://user:password@ci-db-host:5432/vibescan_ci
```

## Related Documentation

- **Operations Reference**: `OPERATIONS.md` - All 20 Wasp operations
- **Developer Guide**: `CLAUDE.md` - Full tech stack and patterns
- **Contributing**: `CONTRIBUTING.md` - PR workflow
- **Deployment**: `PRODUCTION_CHECKLIST.md` - Production setup

---

**Last Updated**: April 22, 2026  
**Status**: ✅ Ready for development  
**Build Gate**: ✅ Enforced (wasp build + tsc + lint + tests)
