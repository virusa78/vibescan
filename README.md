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

### Quick Start (Recommended)

The easiest way to start VibeScan:

```bash
# Clone and install
git clone https://github.com/vibescan/vibescan.git
cd vibescan
npm install

# Start everything (Docker services + frontend)
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
npx tsx scripts/fill-mock-data.ts
```

**Step 4: Start frontend**
```bash
cd vibescan-ui
npm run dev
```

**Step 5: Configure API URL for remote access**
```bash
# Replace 192.168.1.15 with your server's IP
echo "NEXT_PUBLIC_API_URL=http://192.168.1.15:3000" > .env.local
```

Then access the frontend at the URL shown in your terminal.
   ```bash
   docker compose exec vibescan npm run migrate
   ```

5. Access the API:
   - API: http://localhost:3000
   - Swagger UI: http://localhost:3000/docs (dev mode)

### Local Development

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

### Documentation
- `GET /docs` - Swagger UI (dev mode)
- `GET /docs/json` - OpenAPI spec (dev mode)
- `GET /health` - Health check

## Testing

All tests pass after major changes via CI/CD pipeline.

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run E2E API tests
API_URL=http://localhost:3000 npx playwright test

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Test Coverage

| Test Type | Count | Location |
|-----------|-------|----------|
| Property-based tests | 20 | `test/unit/property-tests.test.ts` |
| Integration tests | 17 | `test/integration/integration-tests.test.ts` |
| E2E API tests | 14 | `test/e2e/api.test.ts` |

**Total: 51 tests (37 unit/integration, 14 E2E)**

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
