# VibeScan - Provider-Aware Vulnerability Scanning Platform

See `docs/ARCHITECTURE.md` for the current repo layout and active/archive boundaries.

A SaaS vulnerability scanning platform with provider-aware scan orchestration, source-level result breakdowns, delta comparison, tiered pricing, GitHub integration, webhook notifications, and API keys for CI/CD integration.

[![CI/CD](https://github.com/vibescan/vibescan/actions/workflows/ci.yml/badge.svg)](https://github.com/vibescan/vibescan/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-37%20passed-brightgreen.svg)](https://github.com/vibescan/vibescan/actions)

## Features

- **Provider-Aware Scanner Planning**: Resolve planned providers per scan instead of hardcoding one static enterprise pair
- **Parallel Provider Execution**: Current enterprise comparison path can run `grype + snyk` in parallel when Snyk is enabled and ready
- **Workspace-Aware Data Scope**: scans, reports, API keys, webhooks, and dashboard data resolve through the active workspace
- **Guided Onboarding**: new users can move through onboarding -> first scan -> scan details without dead ends
- **Delta Comparison**: Identify vulnerabilities found only by enterprise scanner
- **Tiered Pricing**: free_trial, starter, pro, enterprise plans with regional discounts
- **GitHub Integration**: GitHub App-based automatic scanning on push/PR events with Checks
- **Webhook Notifications**: HMAC-SHA256 signed webhook delivery with exponential backoff
- **API Keys**: Bcrypt-hashed storage for CI/CD integration
- **Source Code Isolation**: Docker containers with --network=none, --read-only, --user=nobody
- **Quota Management**: Monthly scan limits with automatic resets
- **Regional Pricing**: 50% PPP discounts for India (IN) and Pakistan (PK)
- **Swagger Documentation**: Interactive API docs at `/docs` (dev mode)
- **E2E Testing**: Playwright-based API tests for all endpoints

## Current Product Model

The active product stage is no longer purely user-scoped.

- each user has an active workspace context
- onboarding is used to drive first-scan UX for new users
- GitHub App integration is split into:
  - backend lifecycle and webhook ingestion
  - workspace mapping and repository trigger settings
  - GitHub Checks linked back to VibeScan scan details

Current known gaps that still need hardening:

- polished workspace switcher verification across all surfaces
- polished GitHub install/connect UX beyond manual installation id entry
- final end-to-end verification for live GitHub App + private repository flows

For the manual live verification checklist, see:

- `docs/GITHUB_APP_VALIDATION_RUNBOOK.md`

## Architecture

```
Client Layer
    ├── Web UI (Wasp + React)
    ├── GitHub App
    └── CI/CD Pipeline
         ↓
API Gateway Layer
    ├── Wasp Framework (Full-stack)
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
    ├── Free Scanner Worker (Grype baseline)
    └── Enterprise Scanner Worker (provider-aware: Codescoring/Johnny or Snyk)
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

### Scanner runtime model

The current scanner runtime is provider-aware.

- non-enterprise plans run `grype`
- enterprise runs `grype + codescoring-johnny` when Snyk is disabled
- enterprise runs `grype + snyk` in parallel when `VIBESCAN_ENABLE_SNYK_SCANNER=true` and Snyk readiness is satisfied
- the exact provider list is persisted on each scan as `plannedSources`

This matters because lifecycle finalization and partial-failure handling are evaluated against the stored `plannedSources`, not against whatever provider policy is active later.

### Backend
- **Runtime**: Node.js 24.14.1+ with TypeScript (ES modules)
- **Framework**: Wasp 0.23+ (full-stack: Node.js + React)
- **Database**: PostgreSQL 15 with Prisma ORM (pgcrypto extension)
- **Cache/Queues**: Redis v4 with BullMQ 5.14.0
- **Container**: Docker for isolated scanning
- **Infrastructure**: Kubernetes, AWS S3/KMS

### Frontend
- **Framework**: Wasp (React + Vite)
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
./run.sh
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
cd wasp-app && npm install
cd ..

# Start everything (Docker services + frontend)
./run.sh

# or start the Wasp dev stack directly
cd wasp-app && PORT=3555 wasp start
```

The script will:
- Start Docker services (PostgreSQL, Redis, MinIO)
- Configure the Wasp client with your server's IP address
- Start the Wasp dev stack
- Display access URLs and demo credentials

### Manual Setup

**Prerequisites:**
- Node.js 24.14.1+ (use `nvm use 24.14.1`)
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
   cd wasp-app
   PORT=3555 wasp start
```

**Step 5: Configure API URL for remote access**
```bash
# Replace <host-ip> with your server's IP
echo "REACT_APP_API_URL=http://<host-ip>:3555" > .env.local
```

Then access the frontend at the URL shown in your terminal.
   ```bash
   docker compose exec vibescan npm run migrate
   ```

5. Access the API:
   - API: http://<host-ip>:3555
   - Swagger UI: http://<host-ip>:3555/docs (dev mode)

### Local Development

**Dev port convention (fixed):**
- Frontend: `http://<host-ip>:3000`
- Backend API: `http://<host-ip>:3555`

1. Install dependencies:
   ```bash
   npm install
   cd wasp-app && npm install
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

## Configuration map

If you are unsure where to change a setting, use this map:

| Setting | File | Notes |
|---------|------|-------|
| Backend port and backend base URL | `wasp-app/.env.server` | `PORT`, `WASP_SERVER_URL`; keep them on the same host/IP. |
| Browser-facing auth/API URL | `wasp-app/.env.local` | `REACT_APP_API_URL`, `NEXT_PUBLIC_API_URL`; point these at the frontend origin so the Wasp client API stays same-origin through the Vite proxy. |
| Vite dev proxy target | `wasp-app/.env.local` | `VITE_API_PROXY_TARGET`; used by the frontend dev server to reach the backend. |
| Dev proxy from the Vite frontend to the backend | `wasp-app/vite.config.ts` | Proxies `/api/v1`, `/operations`, `/auth`, `/health`, and `/docs`. |
| Swagger/OpenAPI server URL | `wasp-app/src/server/swaggerHandlers.ts` | Uses `WASP_SERVER_URL` when generating docs. |
| Auth pages and compatibility endpoints | `wasp-app/main.wasp` | `/login` is the browser page; `/auth/email/login` and `/auth/email/signup` are POST-only compatibility routes. |
| Client API fallback URL | `wasp-app/src/client/utils/api.ts` | Used only when the browser env var is missing. |

## Plan files

Use `plan.md` as the only active plan. The `MVP_*.md`, `PHASE_*.md`, and `*_COMPLETION*.md` files are historical notes and should be treated as archive, not live task tracking.

## Environment Variables

See `wasp-app/.env.server`, `wasp-app/.env.local`, and `wasp-app/.env.server.example` for the actual values. The repo currently uses these variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Wasp backend port |
| `WASP_SERVER_URL` | Backend URL exposed to the app and tooling |
| `WASP_WEB_CLIENT_URL` | Browser URL used in docs and auth redirects |
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_S3_ENDPOINT`, `AWS_S3_REGION`, `AWS_S3_IAM_ACCESS_KEY`, `AWS_S3_IAM_SECRET_KEY`, `AWS_S3_FILES_BUCKET`, `AWS_S3_FORCE_PATH_STYLE` | S3/MinIO storage settings |
| `JWT_SECRET`, `ENCRYPTION_KEY` | Auth token signing and secret encryption |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe billing integration |
| `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` | Lemon Squeezy billing integration |
| `POLAR_ORGANIZATION_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SANDBOX_MODE` | Polar billing integration |
| `REACT_APP_API_URL`, `NEXT_PUBLIC_API_URL` | Frontend API base URL |
| `SKIP_EMAIL_VERIFICATION_IN_DEV` | Disable email verification in local dev |
| `ADMIN_EMAILS` | Comma-separated bootstrap admin emails |
| `PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`, `PLAUSIBLE_BASE_URL` | Analytics configuration |
| `GOOGLE_ANALYTICS_CLIENT_EMAIL`, `GOOGLE_ANALYTICS_PRIVATE_KEY`, `GOOGLE_ANALYTICS_PROPERTY_ID` | Google Analytics service-account settings |
| `OPENAI_API_KEY` | Optional OpenAI integration |
| `VIBESCAN_ENABLE_SNYK_SCANNER` | Enables Snyk provider planning for enterprise scans |
| `VIBESCAN_SNYK_CREDENTIAL_MODE` | Snyk credential readiness mode: `auto`, `environment`, or `user-secret` |
| `SNYK_TOKEN` | Shared Snyk API token used in `environment` mode and preferred by `auto` mode |
| `SNYK_ORG_ID` | Optional Snyk organization id forwarded to the Snyk runtime |
| `SNYK_TIMEOUT_MS` | Timeout for Snyk execution |
| `SNYK_RUNTIME` | Snyk runtime mode: `local`, `ssh`, or `mock` |

## API Endpoints

### Authentication
- `GET /login` - Browser login page
- `POST /auth/email/signup` - User registration compat route
- `POST /auth/email/login` - User login compat route
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
- `GET /docs/swagger.json` - OpenAPI spec (dev mode)
- `GET /health` - Health check

## Testing

All tests pass after major changes via CI/CD pipeline.

```bash
# Run all tests
npm test

# Run tests with coverage report only (no gate)
npm run test:coverage

# Run staged coverage gate (used by CI)
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
- API: `http://<host-ip>:3555` (health endpoint)
- Frontend: `http://<host-ip>:3000` (login page)

Override endpoints when needed:
```bash
API_URL=http://<host-ip>:3555 FRONTEND_URL=http://<host-ip>:3000 npm run test:e2e
```

If you are accessing the app from another device on your LAN, set the same host/IP in `wasp-app/.env.server` and `wasp-app/.env.local` instead of loopback defaults.

Disable auto-orchestration if you want manual control:
```bash
E2E_AUTO_START=false npm run test:e2e
```

### Test Coverage

Coverage gating is staged to keep CI deterministic while ts-jest/ESM coverage collection is still limited for a small set of entrypoint files.

- `test:coverage`: coverage report only (no threshold gate)
- `test:coverage:gate`: enforced staged gate (`lines >= 6`, `branches >= 3`) to prevent regressions
- `test:coverage:strict`: enforced target gate (`lines >= 70`, `branches >= 70`)

CI currently runs `test:coverage:gate`. Once strict 70/70 is achievable, make `test:coverage:strict` the default CI coverage command.

| Test Type | Count | Location |
|-----------|-------|----------|
| Property-based tests | 20 | `test/unit/property-tests.test.ts` |
| Integration tests | 17 | `test/integration/integration-tests.test.ts` |
| E2E API tests | 14 | `test/e2e/api.test.ts` |

**Total: 51 tests (37 unit/integration, 14 E2E)**

## Provider-aware scanner orchestration

Provider planning lives in `wasp-app/src/server/lib/scanners/providerSelection.ts`.

Key behaviors:

1. submission resolves the concrete provider executions for the scan
2. `plannedSources` is persisted on the `Scan`
3. each provider writes its own `ScanResult.source`
4. scan detail/dashboard/stats responses build source breakdowns from `ScanResult`

Important compatibility note:

- `free_count` still maps to `grype`
- `enterprise_count` is a derived sum of all non-`grype` sources
- `counts_by_source` is the real provider-aware source of truth

## OpenAPI policy

The `/api/v1/*` contract is enforced by a manifest + `main.wasp` parity policy.

- `wasp-app/src/server/swagger/v1EndpointManifest.ts` defines the declared `/api/v1` surface
- `wasp-app/main.wasp` must expose the same routes
- OpenAPI generation uses manifest-primary source files first, then fallback globs
- contract validation requires `operationId`, `security`, request bodies where mandated by the manifest, and `2xx/4xx/5xx` responses with the shared `ErrorResponse` schema

Use `npm run openapi:contract` as the hard gate for this policy.

## Development

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build production bundle
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run migrate      # Run database migrations
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
