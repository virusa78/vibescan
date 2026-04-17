# AGENTS.md — Guidance for Agent Collaboration

This file provides instructions for AI agents and automated tools working on the VibeScan project. For human developer guidance, see [CLAUDE.md](CLAUDE.md).

## Project Overview

VibeScan is a dual-scanner SaaS vulnerability platform: Grype (free) + Codescoring/BlackDuck (enterprise). All 9 development phases are complete. Current focus: Wasp OpenSaaS migration and Node.js 24 compatibility.

## Structure & Key Paths

```
src/                    # Backend API, workers, services
├── index.ts           # Main server entry point  
├── handlers/          # HTTP request handlers (auth, scans, reports, billing)
├── services/          # Business logic (orchestrator, quota, diff, report, webhook)
├── workers/           # Async job processors (free/enterprise scanners)
├── queues/            # BullMQ config (free/enterprise/webhook/reporting)
├── middleware/        # Auth, rate limiting, validation
├── database/          # PostgreSQL client, migrations (14 files)
├── redis/             # Locks, quota, sessions, pubsub
└── types/             # TypeScript interfaces

test/
├── unit/              # Isolated component tests
├── integration/       # Full workflow tests (scan flow, billing, GitHub)
├── e2e/               # End-to-end tests
└── helpers/           # DB/S3/queue/auth test utilities

wasp-app/              # OpenSaaS Wasp migration (main.wasp, src/, migrations/)
vibescan-ui/           # Legacy Next.js frontend (deprecated post-Wasp)
deploy/kubernetes/     # K8s manifests
.github/workflows/     # CI/CD pipelines
```

## Core Runtime Flows

**1. Scan Submission**
- User submits via `POST /scans` → handlers validate → `ScanOrchestrator.submitScan()` → quota consumed up-front → jobs enqueued (free/enterprise) → status returned

**2. Worker Processing**
- `FreeScannerWorker` (20 parallel) runs Grype in isolated container
- `EnterpriseScannerWorker` (3 parallel, distributed lock) runs Codescoring/BlackDuck
- Results stored in `scan_results` → orchestrator triggered

**3. Delta & Report Generation**
- `DiffEngine` computes delta (merge, severity breakdown, ranking)
- `ReportService` enforces plan visibility (locked view = counts only, full view = details)
- PDF/CI endpoints serve tailored output

**4. Webhook Delivery**
- User triggers via `POST /webhooks` → HMAC-SHA256 signed payload → retry queue (exponential backoff)

**5. Billing & Regional**
- `BillingService` → Stripe checkout → webhook handling → regional pricing (50% IN/PK discount)

## Build & Test Commands

**Wasp (preferred):**
```bash
npm run wasp:up          # Start managed dev (docker, postgres, redis, minio, wasp)
npm run wasp:down        # Stop and free ports
npm run wasp:dev         # Foreground Wasp start
bash ./scripts/wasp-dev.sh status  # Check Wasp/frontend status
```

**Legacy:**
```bash
npm run dev              # Root backend dev server
npm run build            # Production build
npm run lint             # ESLint
npm run lint:fix         # Auto-fix
npm test                 # Jest (all tests)
npm run test:coverage    # With coverage report
npm run test:coverage:gate        # Baseline gate
npm run test:coverage:strict      # Targets 70/70 (lines/branches)
cd vibescan-ui && npm run dev     # Next.js frontend
```

## Code Style & Invariants

**TypeScript & Imports**
- ESM modules (`"type": "module"` in package.json), `tsx` for dev
- Local TS imports use `.js` extensions (NodeNext pattern)
- Path aliases (see CLAUDE.md) except `@redis/*` can conflict — use explicit `import('redis')` from node_modules

**Naming**
- Variables/functions: `camelCase` (e.g., `submitScan`, `quotaService`)
- Types/classes: `PascalCase` (e.g., `ScanOrchestrator`, `QuotaService`)
- Modules: descriptive kebab (e.g., `scan-orchestrator.ts`)

**Business Logic Invariants** (enforce always)
1. Quota decrements on submission (not completion); refund on cancellation
2. Source code isolated in Docker containers (never leaves; `--network=none`, `--read-only`, `--user=nobody`)
3. Starter plan never sees enterprise details (`buildLockedView` returns counts only)
4. API keys stored as bcrypt hashes; raw key returned once on generation, never persisted
5. Max 3 parallel enterprise scans via distributed Redis lock
6. PostgreSQL is source of truth; Redis used for fast caching/locks only
7. Webhook payloads HMAC-SHA256 signed using user's API key

## Testing Approach

**Unit Tests** (`test/unit/`)
- Isolated component logic
- Property-based tests for core algorithms (property-tests.test.ts: 20 properties)

**Integration Tests** (`test/integration/`)
- Full scan workflows (source ZIP, SBOM, GitHub)
- Auth, quota, billing, error recovery
- Real DB/Redis/S3 (test fixtures)

**E2E Tests** (`test/e2e/`, `test/e2e-wasp/`)
- Full user flows (register → submit scan → view report)
- Playwright config for UI tests

**Coverage Gates**
- `test:coverage:gate` enforces baseline
- `test:coverage:strict` targets 70/70 (lines/branches)

## Commit & PR Standards

- **Format**: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, etc.)
  - Example: `feat: add regional pricing for IN/PK`
  - Include co-author trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
- **Validation**: Run `npm run lint`, `npm run test:coverage`, `npm run build` before push
- **PR Description**: problem/solution, related issue(s), test evidence, screenshots (UI changes)

## Environment & Secrets

- Use `.env.example` as baseline; never commit `.env` or secrets
- Key vars: `DB_*`, `REDIS_URL`, `AWS_*`, `JWT_SECRET`, `ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, `CODESCORING_API_*`
- OpenSaaS migration toggles: `OPENSAAS_MODE`, `OPENSAAS_PLATFORM_OWNED`
- Node.js 24.14.1+ (see `.nvmrc`)

## When Making Changes

1. **Preserve dual routes** — many endpoints available in both legacy and `/v1/*` forms
2. **Ownership checks in SQL** — use user ID / org membership predicates, not post-filtering
3. **Handler/service split** — handlers own HTTP validation; services own business logic
4. **Auth context pattern** — callers resolved via `request.apiKey?.user_id || request.user?.userId`
5. **Error payload shape** — stable keys (`unauthorized`, `not_found`, `quota_exceeded`, etc.) + optional `validation_errors` array
6. **No pre-existing issues** — focus on task scope; fix tightly coupled bugs only

## Implementation Phases (Complete)

| Phase | Status | Focus |
|-------|--------|-------|
| 1 | ✅ | Infrastructure (Docker, DB, Redis, S3) |
| 2 | ✅ | Auth & API Gateway |
| 3 | ✅ | Scan Orchestration & Queuing |
| 4 | ✅ | Worker Pipeline (Grype + BlackDuck) |
| 5 | ✅ | Delta & Reporting |
| 6 | ✅ | Webhooks & GitHub App |
| 7 | ✅ | Billing & Regional Pricing |
| 8 | ✅ | Testing & Security |
| 9 | ✅ | Monitoring & Kubernetes Deployment |
| Migration | 🔄 | Wasp OpenSaaS + Node.js 24 |

## Contacts & Resources

- **Architecture**: See `CLAUDE.md` for full tech stack & API endpoints
- **Contributing**: See `CONTRIBUTING.md` for PR workflow
- **Startup**: See `STARTUP.md` / `STARTUP_GUIDE.md` for local dev setup
- **Scripts**: See `SCRIPTS_REFERENCE.md` for all CLI commands

---

**Last Updated**: April 2026 | **Node.js**: 24.14.1 LTS | **Status**: Stable Production
