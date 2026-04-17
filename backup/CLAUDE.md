# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeScan is a SaaS vulnerability scanning platform with dual-scanner architecture (Grype free + Codescoring/BlackDuck enterprise). All 9 phases of development are complete.

## Current Implementation Status

**Phase 5 (Delta & Reporting) - Complete**

Completed:
- AuthService with JWT (15 min access, 30 day refresh) and API key management
- API Gateway middleware (rate limiting, API key auth, ownership verification, request validation)
- All API endpoints for auth, API keys, and scans
- QuotaService with checkQuota, consumeQuota, refundQuota, resetMonthlyQuota
- ScanOrchestrator with submitScan, handleWorkerResult, cancelScan, getScan, listScans
- InputAdapterService with source ZIP extraction, GitHub cloning, SBOM validation
- FreeScannerWorker (Grype) with container isolation and CVE update scheduler
- EnterpriseScannerWorker (Codescoring/BlackDuck) with distributed locking
- DiffEngine with merge, computeDelta, computeSeverityBreakdown, rankVulnerabilities
- ReportService with buildReportView, buildLockedView, buildFullView, generatePDF, getCiDecision
- WebhookService with HMAC-SHA256 signing and exponential backoff retries
- GitHub integration service for installation events and push/PR triggers

**Phase 6 (Webhooks & GitHub) - Complete**

Completed:
- Webhook API endpoints for configuration and delivery tracking
- GitHub App token generation and repo authorization

**Phase 7 (Billing & Regional) - Complete**

Completed:
- BillingService with Stripe checkout sessions and regional pricing (50% discount for IN/PK)
- Stripe webhook handling for subscription lifecycle events
- Payment failure tracking with downgrade after 3 failures
- Billing API endpoints: checkout, subscription, webhook, cancel, regional-pricing

**Phase 8 (Testing & Security) - Complete**

Completed:
- Property-based tests for all 20 properties in `test/unit/property-tests.test.ts`
- Integration tests for full scan flow, GitHub, billing, and error recovery
- Security audit: authentication, encryption, webhooks, rate limiting verified

**Phase 9 (Monitoring & Deployment) - Complete**

Completed:
- Prometheus metrics (queue depth, worker latency, error rate, quota usage, scan duration)
- Alerting rules for queue backlog, error rate, quota exhaustion, worker failures
- Kubernetes deployment manifests for all services
- CI/CD pipeline with tests, Docker builds, and K8s deployment

## Project Structure

```
src/
├── config/           # Configuration management
├── database/         # PostgreSQL migrations and client
│   └── migrations/   # 14 migration files
├── redis/            # Redis utilities
│   ├── lock.ts       # Distributed locking
│   ├── quota.ts      # Quota management
│   ├── sessions.ts   # Session management
│   └── pubsub.ts     # WebSocket notifications
├── s3/               # S3 client and utilities
├── queues/           # BullMQ queue configuration
├── services/         # Business logic services
│   ├── authService.ts
│   ├── quotaService.ts
│   ├── scanOrchestrator.ts
│   ├── inputAdapterService.ts
│   ├── diffEngine.ts
│   ├── reportService.ts
│   ├── webhookService.ts
│   ├── billingService.ts
│   ├── alerting/     # Alerting rules and manager
│   └── metrics/      # Prometheus metrics
├── workers/          # Scanner workers
│   ├── freeScannerWorker.ts
│   └── enterpriseScannerWorker.ts
├── middleware/       # Fastify middleware
│   └── apiGateway.ts
├── handlers/         # API request handlers
│   ├── authHandlers.ts
│   ├── apiKeyHandlers.ts
│   ├── scanHandlers.ts
│   └── billingHandlers.ts
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── index.ts          # Main application entry point

test/
├── helpers/          # Test helper modules
├── integration/      # Integration tests
├── migrations/       # Migration tests
└── unit/             # Unit tests

vibescan-ui/        # Frontend (Next.js 15)
├── src/
│   ├── app/          # App Router pages
│   │   ├── (auth)/   # Auth pages (login, register)
│   │   ├── dashboard/    # Main dashboard
│   │   ├── vulnerabilities/  # Vulnerability reports
│   │   └── api-reference/    # API documentation
│   └── components/   # Shared components
└── tailwind.config.ts

deploy/kubernetes/  # Kubernetes deployment manifests
.github/workflows/  # CI/CD pipeline configurations
```

## Tech Stack

### Backend
- **Runtime**: Node.js 24.14.1 LTS/TypeScript with Fastify
- **Database**: PostgreSQL 15 with pgcrypto extension
- **Cache/Queues**: Redis v4 with BullMQ
- **Storage**: S3-compatible (AWS S3 or MinIO)
- **Container**: Docker for isolated scanning
- **Infrastructure**: Kubernetes (production)
- **Monitoring**: Prometheus metrics, alerting rules

**Note:** The backend uses ES modules (`"type": "module"` in package.json) and `tsx` for development. Path aliases like `@redis/*` can conflict with npm packages - use explicit paths like `import('redis')` from `node_modules` when needed.

### Frontend
- **Framework**: Next.js 15.1.0 with App Router and Turbopack
- **Styling**: Tailwind CSS with custom dark theme
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Notifications**: Sonner toasts

## Key Commands

```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Run migrations with rollback
npm run migrate:rollback

# Start backend development server (Node.js 24)
npm run dev

# Build for production
npm run build

# Run tests
npm test
npm run test:coverage
npm run test:watch      # Watch mode for development

# Lint
npm run lint
npm run lint:fix

# Frontend
cd vibescan-ui && npm run dev
```

**Note:** The backend requires Node.js 24.14.1+ with ES modules support. Use nvm to switch: `nvm use 24`

## TypeScript Path Aliases

The project uses TypeScript path aliases defined in `tsconfig.json`. Note: The `@redis/*` alias can conflict with the `redis` npm package when using dynamic imports - use explicit paths or rename the local redis module.

| Alias | Maps To |
|-------|---------|
| `@/*` | `src/*` |
| `@services/*` | `src/services/*` |
| `@db/*` | `src/database/*` |
| `@redis/*` | `src/redis/*` |
| `@queues/*` | `src/queues/*` |
| `@s3/*` | `src/s3/*` |
| `@types/*` | `src/types/*` |
| `@utils/*` | `src/utils/*` |

## Docker Setup

```bash
# Start all services (PostgreSQL, Redis, MinIO, VibeScan)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Run migrations in container
docker-compose exec vibescan npm run migrate
```

### Service Ports

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5432 | Default PostgreSQL port |
| Redis | 6379 | Default Redis port |
| MinIO (S3 API) | 9000 | S3-compatible storage |
| MinIO (Console) | 9001 | Web-based admin UI |
| VibeScan API | 3000 | Application API |

## Frontend Development

The VibeScan UI is a Next.js 15 application in the `vibescan-ui/` directory:

```bash
# Navigate to frontend
cd vibescan-ui

# Install dependencies
npm install

# Start dev server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build
```

### UI Features
- Dark theme with zinc color palette
- Responsive dashboard with metrics, charts, and activity feed
- Vulnerability reports with delta analysis
- Interactive API reference documentation

## Database Schema

13 tables with encrypted fields via pgcrypto:
- `users` - User accounts with encrypted Stripe IDs
- `organizations` - Team entities for enterprise plans
- `scans` - Main scan entity with monthly partitioning
- `scan_results` - Dual-scanner support (free + enterprise)
- `scan_deltas` - Delta comparison results
- `api_keys` - API keys with bcrypt-hashed storage
- `webhooks` - Webhook configuration
- `webhook_deliveries` - Delivery tracking
- `github_installations` - GitHub App installation
- `quota_ledger` - Monthly quota tracking
- `sbom_documents` - SBOM audit storage
- `payment_failures` - Failed payment tracking
- `alerts` - Alert system storage

## Queue Configuration

| Queue | Workers | Priority | Notes |
|-------|---------|----------|-------|
| `free_scan_queue` | 20 | High | Grype scanning |
| `enterprise_scan_queue` | 3 | Medium | Codescoring/BlackDuck (concurrent) |
| `webhook_delivery_queue` | 10 | Low | Webhook retries with exponential backoff |
| `report_generation_queue` | 5 | Low | PDF generation |

See `queues/config.ts` for worker configuration. Enterprise scans are limited to 3 concurrent via distributed lock.

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout

### API Keys
- `POST /api-keys` - Generate API key
- `GET /api-keys` - List API keys
- `DELETE /api-keys/:id` - Revoke API key

### Scans
- `POST /scans` - Submit scan (source_zip, sbom_upload, github_app, ci_plugin)
- `GET /scans` - List scans with pagination
- `GET /scans/:id` - Get scan status
- `DELETE /scans/:id` - Cancel scan

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

## Environment Variables

See `.env.example` for all configurable variables. Key variables:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_URL`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `ENCRYPTION_KEY` - For pgcrypto encryption
- `JWT_SECRET` - For JWT token signing
- `CODESCORING_API_URL`, `CODESCORING_API_KEY` - For BlackDuck integration
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - For Stripe integration
- `FRONTEND_URL` - For redirect URLs

## Important Invariants

These invariants are enforced throughout the codebase:

1. **Quota**: Decrement on job submission (in `ScanOrchestrator.submitScan`), not completion. Refund on cancellation via `QuotaService.refundQuota`.

2. **Source Code Isolation**: Source code never leaves isolated Docker containers. Workers use `--network=none`, `--read-only`, and `--user=nobody` flags.

3. **Delta Paywall**: Enterprise-only vulnerabilities are never exposed to `starter` plan. `ReportService.buildLockedView` returns only counts, not details.

4. **API Key Security**: API keys stored only as bcrypt hashes (`api_keys.key_hash`). Raw keys returned once on generation, never stored.

5. **Concurrency**: Max 3 parallel enterprise scanner requests via `RedisEnterpriseLockManager` in `redis/lock.ts`.

6. **Redis as Cache**: Redis is used for fast reads (quota, locks) but PostgreSQL is the source of truth. `syncQuotaWithDatabase` recovers from Redis restarts.

7. **HMAC Verification**: Webhook payloads signed with HMAC-SHA256 using user's API key. Clients verify via `X-VibeScan-Signature` header.

8. **ES Module Imports**: When importing from `node_modules` in `src/redis/`, use explicit paths like `import('redis')` to avoid conflicts with the `@redis/*` path alias. The Redis v4 API uses `createClient()` directly from the package export.

## Security Considerations

### Authentication & Authorization
- **All API endpoints require authentication** via JWT access token (15 min expiry) or API key (bcrypt-hashed storage)
- **Ownership verification**: Endpoints verify the authenticated user owns the resource being accessed
- **Refresh tokens** stored in Redis with 30-day expiry, invalidated on logout/refresh

### Data Encryption
- **Sensitive data at rest**: Stripe customer IDs and subscription IDs encrypted with PostgreSQL `pgp_sym_encrypt` using `ENCRYPTION_KEY`
- **Passwords**: bcrypt-hashed with 10 rounds
- **API keys**: bcrypt-hashed, raw key never stored

### Webhook Security
- **Stripe webhooks**: Signature verification via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`
- **VibeScan webhooks**: HMAC-SHA256 signing of payloads using user's API key

### Input Validation
- **Plan validation**: Only `free_trial`, `starter`, `pro`, `enterprise` accepted
- **Region validation**: Only `IN`, `PK`, `OTHER` accepted
- **Rate limiting**: 100 requests per minute per IP

### Billing Security (Phase 7)
- **Stripe checkout sessions**: User ID validated before session creation
- **Payment failure tracking**: Downgrade after 3 failures within 30 days
- **Regional pricing**: Automatic discount applied based on user's `region` field

## Implementation Status

| Phase | Status |
|-------|--------|
| Phase 1 (Infrastructure) | Complete |
| Phase 2 (Auth & API) | Complete |
| Phase 3 (Scan Orchestration) | Complete |
| Phase 4 (Workers) | Complete |
| Phase 5 (Delta & Reporting) | Complete |
| Phase 6 (Webhooks & GitHub) | Complete |
| Phase 7 (Billing & Regional) | Complete |
| Phase 8 (Testing & Security) | Complete |
| Phase 9 (Monitoring & Deployment) | Complete |
| Node.js 24 Migration | In Progress |
| Redis v4 Client Fix | In Progress |

## Database Migrations

Migrations are stored in `src/database/migrations/` and use PostgreSQL's pgcrypto extension for encrypted fields. Run with `npm run migrate` or `npm run migrate:rollback`.

| Migration | Description |
|-----------|-------------|
| 001 | Create pgcrypto extension |
| 002 | Create users table |
| 003 | Create organizations table |
| 004 | Create scans table (non-partitioned) |
| 005 | Create scan_results table |
| 006 | Create scan_deltas table |
| 007 | Create api_keys table |
| 008 | Create webhooks table |
| 009 | Create github_installations table |
| 010 | Create quota_ledger table |
| 011 | Create sbom_documents table |
| 012 | Create additional indexes |
| 013 | Create payment_failures table |
| 014 | Create alerts table |

**Note:** Migration 004 originally used table partitioning but was simplified to a regular table. Migrations 002-011 had RLS policies removed as they required `auth.uid()` which wasn't available.

## Frontend Implementation Status

| Feature | Status |
|---------|--------|
| Landing Page | Complete |
| Authentication (Login/Register) | Complete |
| Dashboard (Metrics, Charts, Recent Scans) | Complete |
| Vulnerability Reports | Complete |
| API Reference | Complete |
| Responsive Design | Complete |
| Dark Theme | Complete |
| Node.js 24 Migration | Complete |
| ES Modules Support | Complete |

## Testing

Tests are organized in `test/`:

| Directory | Purpose |
|-----------|---------|
| `test/helpers/` | Test helper modules (database, S3, queue, auth) |
| `test/unit/` | Unit tests |
| `test/integration/` | Integration tests |
| `test/migrations/` | Migration tests |

Run tests with:
```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode
```

Use `ts-jest` with ES modules disabled (`useESM: false` in `jest.config.js`).

## Prometheus Metrics

Metrics are available at `/metrics` endpoint:
- `vibescan_queue_depth` - Queue job counts
- `vibescan_worker_latency_seconds` - Worker processing time
- `vibescan_error_total` - Error counts by type/service
- `vibescan_quota_usage` - User quota usage
- `vibescan_scan_duration_seconds` - Scan completion time
- `vibescan_http_request_duration_seconds` - HTTP request duration

## Kubernetes Deployment

Deploy with:
```bash
kubectl apply -f deploy/kubernetes/
```

Services:
- API Gateway (3 replicas)
- Free Worker (5 replicas)
- Enterprise Worker (2 replicas)
- PostgreSQL (with PVC)
- Redis (with PVC)

## Current Status (April 2026)

- Backend running on Node.js 24.14.1 with ES modules via `tsx watch`
- Frontend running on http://localhost:3000 with Turbopack
- Database migrations completed successfully
- Redis connection in progress (path alias conflict being resolved)

## CI/CD Pipeline

GitHub Actions workflows in `.github/workflows/`:
- `ci.yml` - Full CI/CD pipeline
- `property-tests.yml` - Daily property tests
- `integration-tests.yml` - Hourly integration tests
- `docker.yml` - Docker builds
- `k8s-deploy.yml` - Kubernetes deployments
