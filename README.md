# VibeScan - Dual-Scanner Vulnerability Scanning Platform

A SaaS vulnerability scanning platform that provides dual-scanner architecture (Grype free + Codescoring/BlackDuck enterprise) with delta comparison, tiered pricing, GitHub integration, webhook notifications, and API keys for CI/CD integration.

[![CI/CD](https://github.com/vibescan/vibescan/actions/workflows/ci.yml/badge.svg)](https://github.com/vibescan/vibescan/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-37%20passed-brightgreen.svg)](https://github.com/vibescan/vibescan/actions)

## Features

- **Dual-Scanner Architecture**: Run both free (Grype) and enterprise (Codescoring/BlackDuck) scanners in parallel
- **Delta Comparison**: Identify vulnerabilities found only by enterprise scanner
- **Tiered Pricing**: free_trial, starter, pro, enterprise plans with regional discounts
- **GitHub Integration**: Automatic scanning on push/PR events
- **Webhook Notifications**: HMAC-SHA256 signed webhook delivery with exponential backoff
- **API Keys**: Bcrypt-hashed storage for CI/CD integration
- **Source Code Isolation**: Docker containers with --network=none, --read-only, --user=nobody
- **Quota Management**: Monthly scan limits with automatic resets
- **Regional Pricing**: 50% PPP discounts for India (IN) and Pakistan (PK)
- **Swagger Documentation**: Interactive API docs at `/docs` (dev mode)
- **E2E Testing**: Playwright-based API tests for all endpoints

## Architecture

```
Client Layer
    ├── Web UI (Next.js 15)
    ├── GitHub App
    └── CI/CD Pipeline
         ↓
API Gateway Layer
    ├── API Gateway (Fastify)
    ├── AuthService (JWT)
    └── Rate Limiter (100 req/min)
         ↓
Service Layer
    ├── ScanOrchestrator
    ├── QuotaService
    ├── ReportService
    ├── WebhookService
    ├── GithubIntegrationService
    └── BillingService (Stripe)
         ↓
Worker Layer
    ├── Free Scanner Worker (Grype)
    └── Enterprise Scanner Worker (Codescoring/BlackDuck)
         ↓
Queue Layer (BullMQ)
    ├── free_scan_queue (20 workers)
    ├── enterprise_scan_queue (3 workers max)
    ├── webhook_delivery_queue
    └── report_generation_queue
         ↓
Data Layer
    ├── PostgreSQL 15 (pgcrypto)
    ├── Redis 7
    └── S3 Storage (MinIO/AWS)
```

## Tech Stack

### Backend
- **Runtime**: Node.js 24.14.1 LTS/TypeScript with ES modules
- **Framework**: Fastify 4.28.1
- **Database**: PostgreSQL 15 with pgcrypto extension
- **Cache/Queues**: Redis v4 with BullMQ 5.14.0
- **Container**: Docker for isolated scanning
- **Infrastructure**: Kubernetes, AWS S3/KMS

### Frontend
- **Framework**: Next.js 15.1.0 with App Router
- **Styling**: Tailwind CSS with custom dark theme
- **Charts**: Recharts
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod

## Getting Started

### Wasp Project (new path)

Wasp app scaffold is in `wasp-app/`.

```bash
# install Wasp CLI first
curl -sSL https://get.wasp-lang.dev/installer.sh | sh

# run Wasp app
npm run wasp:dev
```

Main file: `wasp-app/main.wasp`
Core scan operations: `wasp-app/src/server/operations.ts`

### Quick Start (Recommended)

The easiest way to start VibeScan:

```bash
# Clone and install
git clone https://github.com/vibescan/vibescan.git
cd vibescan
npm install

# Start everything (Docker services + frontend)
./run.sh

# (or legacy wrapper)
./scripts/start.sh
```

The script will:
- Start Docker services (PostgreSQL, Redis, MinIO, Backend API)
- Configure the frontend with your server's IP address
- Start the frontend development server
- Display access URLs and demo credentials

### Manual Setup

**Prerequisites:**
- Node.js 24.14.1+ (use `nvm use 24`)
- Docker & Docker Compose

**Step 1: Start Docker services**
```bash
docker compose up -d
```

**Step 2: Run migrations**
```bash
npm run migrate
```

**Step 3: Generate demo data (optional)**
```bash
npm run seed:mock-data
```

By default this reseeds all 3 demo clients and rewrites their historical scan/quota data.
You can tune volume and reset behavior:
```bash
DEMO_MONTHS=3 RESET_DEMO_DATA=true npm run seed:mock-data
```

**Step 4: Start frontend**
```bash
cd vibescan-ui
npm run dev
```

**Step 5: Configure API URL for remote access**
```bash
# Replace 192.168.1.15 with your server's IP
echo "NEXT_PUBLIC_API_URL=http://192.168.1.15:3001" > .env.local
```

Then access the frontend at the URL shown in your terminal.
   ```bash
   docker compose exec vibescan npm run migrate
   ```

5. Access the API:
   - API: http://localhost:3001
   - Swagger UI: http://localhost:3001/docs (dev mode)

### Local Development

**Dev port convention (fixed):**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local services:
   ```bash
   docker compose up -d postgres redis minio
   ```

3. Run migrations:
   ```bash
   npm run migrate
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for all configurable variables. Key variables:

| Variable | Description |
|----------|-------------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `REDIS_URL` | Redis connection URL |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | AWS/S3 credentials |
| `ENCRYPTION_KEY` | 32+ char key for pgcrypto encryption |
| `JWT_SECRET` | 32+ char secret for JWT signing |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe integration |
| `CODESCORING_API_URL`, `CODESCORING_API_KEY` | BlackDuck integration |
| `REMOTE_SCANNER_ENABLED`, `REMOTE_SCANNER_API_URL`, `REMOTE_SCANNER_API_KEY`, `REMOTE_SCANNER_PROVIDER_ID` | Optional remote scanner provider integration |
| `OPENSAAS_MODE`, `OPENSAAS_PLATFORM_OWNED` | OpenSaaS/Wasp boundary gating for `auth,api_keys,billing,settings` (`OPENSAAS_MODE=false` keeps all routes in VibeScan; core scan workflow remains backend-owned in this cutover) |

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh (15 min access, 30 day refresh)
- `POST /auth/logout` - User logout

### API Keys
- `POST /api-keys` - Generate API key (bcrypt-hashed storage)
- `GET /api-keys` - List API keys
- `DELETE /api-keys/:id` - Revoke API key

### Scans
- `POST /scans` - Submit scan (source_zip, sbom_upload, github_app, ci_plugin)
- `GET /scans` - List scans with pagination
- `GET /scans/:id` - Get scan status
- `DELETE /scans/:id` - Cancel scan (quota refund)

### Reports
- `GET /reports/:scan_id` - Get full report (JSON)
- `GET /reports/:scan_id/summary` - Get summary (counts only)
- `POST /reports/:scan_id/pdf` - Request PDF generation
- `GET /reports/:scan_id/ci` - Get CI decision

### Webhooks
- `POST /webhooks` - Configure webhook URL
- `GET /webhooks` - List webhooks
- `DELETE /webhooks/:id` - Delete webhook

### Billing
- `POST /billing/checkout` - Create Stripe checkout session
- `GET /billing/subscription` - Get subscription details
- `POST /billing/cancel` - Cancel subscription
- `POST /billing/webhook` - Stripe webhook handler
- `GET /billing/regional-pricing` - Get regional pricing

### CVE Remediation Tracking
- `POST /remediation/:scanId/items` - Upsert CVE remediation status (`open`, `in_progress`, `resolved`, `accepted_risk`, `false_positive`)
- `GET /remediation/:scanId/items` - List tracked CVE remediation items for scan
- `GET /remediation/:scanId/progress` - Get remediation progress summary and completion percentage

### Documentation
- `GET /docs` - Swagger UI (dev mode)
- `GET /docs/json` - OpenAPI spec (dev mode)
- `GET /health` - Health check

## Testing

All tests pass after major changes via CI/CD pipeline.

```bash
# Run all tests
npm test

# Run tests with coverage report only (no gate)
npm run test:coverage

# Run staged coverage gate (current enforced baseline)
npm run test:coverage:gate

# Run strict coverage gate (target 70% lines/branches)
npm run test:coverage:strict

# Run tests in watch mode
npm run test:watch

# Run E2E API tests
npm run test:e2e

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### E2E Preconditions

`npm run test:e2e` now performs deterministic E2E orchestration from Playwright global setup:
- checks API (`/health`) and frontend (`/login`)
- auto-starts local Docker services (`postgres`, `redis`, `minio`, `vibescan`) if API is down
- auto-starts the frontend dev server on `FRONTEND_URL` if needed
- ensures required demo E2E users exist and can authenticate
- tears down only services/processes started by the test setup

Default endpoints (used when `API_URL`/`FRONTEND_URL` are not set):
- API: `http://127.0.0.1:3001` (health endpoint)
- Frontend: `http://127.0.0.1:3000` (login page)

Override endpoints when needed:
```bash
API_URL=http://localhost:3001 FRONTEND_URL=http://localhost:3000 npm run test:e2e
```

Disable auto-orchestration if you want manual control:
```bash
E2E_AUTO_START=false npm run test:e2e
```

### Test Coverage

Coverage gating is staged to keep CI deterministic while ts-jest/ESM coverage collection is still limited for a small set of entrypoint files.

- `test:coverage`: coverage report only (no threshold gate)
- `test:coverage:gate`: enforced staged gate (`lines >= 6`, `branches >= 3`) to prevent regressions
- `test:coverage:strict`: enforced target gate (`lines >= 70`, `branches >= 70`)

Once strict 70/70 is achievable, make `test:coverage:strict` the default CI coverage command.

| Test Type | Count | Location |
|-----------|-------|----------|
| Property-based tests | 20 | `test/unit/property-tests.test.ts` |
| Integration tests | 17 | `test/integration/integration-tests.test.ts` |
| E2E API tests | 14 | `test/e2e/api.test.ts` |

**Total: 51 tests (37 unit/integration, 14 E2E)**

## Remote Scanner Agent Abstraction

Use `src/services/remoteScannerAgent.ts` to normalize scenario inputs (`github_app`, `source_zip`, `sbom_upload`) into provider payloads, then convert provider responses into the same vulnerability shape used by existing workers/reporting.

Typical flow:
1. `normalizeScenarioRequest(...)`
2. `selectProvider('free')` (defaults to `grype_like`)
3. `toProviderPayload(...)`
4. `normalizeProviderResult(...)`

This abstraction is additive and keeps current scan wiring backward compatible.

## Development

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build production bundle
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run migrate      # Run database migrations
npm run migrate:rollback  # Rollback migrations
```

## Deployment

### Docker

```bash
# Build image
docker compose build

# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Kubernetes

```bash
kubectl apply -f deploy/kubernetes/
```

## Documentation

- [Requirements](.kiro/specs/vibescan/requirements.md)
- [Design Document](.kiro/specs/vibescan/design.md)
- [Implementation Tasks](.kiro/specs/vibescan/tasks.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
