# VibeScan Architecture — Repo Structure & Alignment

**Status**: Alignment is in progress. This document tracks the current operating model and the remaining gaps.

## Quick Summary

- **Single app root**: All code is in `wasp-app/src/`, not split elsewhere.
- **Wasp-only**: v0.23+ (no legacy Fastify or Next.js). Build via `wasp build`.
- **Local dev backend**: `3555` under `wasp start`.
- **Container runtime**: `3000` by default for the built server image.
- **Source of truth**: `wasp-app/` contains active application; root-level files orchestrate, test, and document.
- **Docker**: Built from root `Dockerfile`, reads from `wasp-app/` tree.
- **CI**: Root-level workflows orchestrate; install both root and `wasp-app/` dependencies.
- **Active product model**: workspace-aware SaaS with onboarding, GitHub App ingestion, and GitHub Checks wiring.

## Current Product Layering

- **Authority scope**: active workspace, not only raw `userId`
- **Primary user journey**: login/signup -> onboarding -> first scan -> scan details -> dashboard
- **GitHub model**:
  - GitHub App webhook ingress at `/github/webhook`
  - installation-to-workspace mapping inside app settings
  - repo/branch/trigger settings stored per linked installation
  - scan lifecycle reflected back into GitHub Check Runs

## Source of Truth

| Component | Location | Truth | Notes |
|-----------|----------|-------|-------|
| **App code** | `wasp-app/src/` | Wasp DSL + TypeScript | Only source of app code |
| **Database schema** | `wasp-app/schema.prisma` | Prisma ORM | Source of truth for data model |
| **Migrations** | `wasp-app/migrations/` | Auto-generated | Apply via `wasp db migrate-dev` |
| **Config** | `.env.server`, `.env.local` | Environment files | Env vars override defaults |
| **Docs** | `docs/`, root `.md` files | Markdown | Must stay synchronized with code |
| **Tests** | `test/` | Jest + Playwright | Run from root via `npm test` |
| **CI** | `.github/workflows/` | GitHub Actions | Orchestrates from root |
| **Docker** | Root `Dockerfile` | Container image | Builds from `wasp-app/` and runs the built server |

## Active Layout

```
vibescan/                          # Monorepo root (orchestration only)
├── wasp-app/                      # PRIMARY APPLICATION (Wasp v0.23+)
│   ├── main.wasp                  # Wasp DSL: routes, pages, operations, auth
│   ├── src/
│   │   ├── client/                # React frontend (Vite)
│   │   ├── server/                # Node.js backend (Wasp operations)
│   │   │   ├── operations/        # 20 Wasp operations (queries/actions)
│   │   │   ├── services/          # Business logic
│   │   │   ├── workers/           # BullMQ background workers
│   │   │   ├── queues/            # Queue configuration
│   │   │   └── http/              # Rate limiting, request guards
│   │   ├── auth/                  # Auth forms & email templates
│   │   ├── shared/                # Shared types
│   │   └── payment/               # Stripe integration
│   ├── schema.prisma              # Database schema (source of truth)
│   ├── migrations/                # Auto-generated migrations
│   ├── package.json               # App dependencies
│   ├── .env.server                # Backend env vars (PORT=3555)
│   └── .env.local                 # Local overrides
│
├── test/                          # Test suite (root level)
│   ├── e2e-wasp/                  # Playwright E2E tests
│   ├── integration/               # Integration tests
│   ├── unit/                      # Unit tests
│   └── helpers/                   # Test utilities
│
├── docs/                          # Active documentation
│   ├── ARCHITECTURE.md            # This file
│   ├── DEVELOPMENT.md             # Local dev setup
│   ├── DEPLOYMENT.md              # Deploy guide
│   ├── EMAIL_SETUP.md             # Mail provider setup
│   └── ...
│
├── deploy/                        # Infrastructure
│   └── kubernetes/                # K8s manifests
│
├── .github/workflows/             # CI/CD pipelines
├── scripts/                       # Repo-level scripts
├── package.json                   # Root dependencies
├── README.md                      # Quick start
├── CLAUDE.md                      # Developer reference
├── AGENTS.md                      # Agent guidance
├── CONTRIBUTING.md                # Git workflow
├── OPERATIONS.md                  # API reference
├── PRODUCTION_CHECKLIST.md        # Deployment checklist
└── .nvmrc                         # Node.js version (24.14.1)
```

## Key Operational Details

### Scanner orchestration model

The active scanner model is provider-aware, not a permanently fixed dual-scanner pair.

### Planning

- planning is resolved in `wasp-app/src/server/lib/scanners/providerSelection.ts`
- non-enterprise plans run `grype`
- enterprise runs `grype + codescoring-johnny` when Snyk is disabled
- enterprise runs `grype + snyk` in parallel when Snyk is enabled and readiness succeeds

### Readiness and credentials

Snyk readiness is computed in `wasp-app/src/server/services/scannerReadinessService.ts`.

- feature flag: `VIBESCAN_ENABLE_SNYK_SCANNER`
- credential mode: `VIBESCAN_SNYK_CREDENTIAL_MODE=auto|environment|user-secret`
- `auto` prefers `SNYK_TOKEN`, then falls back to the authenticated user's stored encrypted key
- `environment` requires `SNYK_TOKEN`
- `user-secret` requires authenticated user context plus `user.snykApiKeyEncrypted`

Enterprise submission currently fails closed with `422` when Snyk is enabled but not ready.

### Persisted planning and result model

- `Scan.plannedSources` freezes the expected provider list for each submitted scan
- `scanLifecycleService.ts` finalizes scans against `plannedSources` first, with plan-based fallback only for legacy rows
- each provider writes a dedicated `ScanResult.source`
- dashboard/report/scan APIs derive `counts_by_source` / `by_source` style breakdowns from `ScanResult`, while `free_count` and `enterprise_count` remain compatibility projections

### Ports

| Service | Port | Config | Must Update When Changed |
|---------|------|--------|-------------------------|
| **Backend API (local dev)** | 3555 | `.env.server: PORT=3555` | Local `wasp start`, README, Playwright defaults |
| **Backend API (container)** | 3000 | Container env / K8s deployment | Dockerfile, `api-deployment.yaml`, probes |
| **Frontend** | 3000 | Wasp default | (rarely changed) |
| **PostgreSQL** | 5432 | Docker compose | (dev only) |
| **Redis** | 6379 | Docker compose | (dev only) |

### Environment Files

**Backend** (`wasp-app/.env.server`):
```
PORT=3555
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
ENCRYPTION_KEY=... (32 hex bytes)
```

**Client** (`.env.local` in root):
```
REACT_APP_API_URL=http://127.0.0.1:3555
```

### Build Flow

```
npm install                    # Install root deps (testing, scripts)
cd wasp-app && npm install     # Install app deps
cd wasp-app && wasp build      # Compile to .wasp/build/
# Output: .wasp/build/server/ (Node.js app) + .wasp/build/client/ (static React)
```

Container build uses the root `Dockerfile`, copies `wasp-app/`, runs `wasp build`, and starts `node .wasp/build/server`.

## Operational Boundaries

### Docker Build
- **Source**: Root `Dockerfile` (Wasp-only)
- **Reads from**: `wasp-app/package.json`, `wasp-app/src/`, `wasp-app/main.wasp`
- **Artifact**: `wasp-app/.wasp/build/` (generated by `wasp build` in Docker)
- **Run command**: `node .wasp/build/server`
- **Container port**: `3000`

### Worker Processes
- **Source**: Root `Dockerfile.worker`
- **Entrypoint**: `wasp-app/src/server/workers/runQueueWorker.ts`
- **Role selection**: `WORKER_ROLE=free|enterprise`
- **Execution model**:
  - `free` worker runs the baseline `grype` provider
  - `enterprise` worker executes the provider selected for the secondary comparison path (`codescoring-johnny` or `snyk`)
- **Embedded workers**: API processes can still run embedded workers locally, but Kubernetes disables that with `VIBESCAN_EMBED_WORKERS=false`

### CI Pipeline
1. Install root deps: `npm install`
2. Install wasp-app deps: `cd wasp-app && npm ci`
3. Lint: `npm run lint` (ESLint all code)
4. Test: `npm run test:coverage:gate` (Jest with staged coverage gate)
5. Build: `npm run build` (invokes `cd wasp-app && wasp build`)
6. Docker: `docker build` (uses updated `Dockerfile`)

### Local Development
```bash
cd wasp-app
npm install
PORT=3555 wasp start           # Frontend: 3000, Backend: 3555
```

## Active vs Archive

### ✅ Active Documentation
- `README.md` — Quick start
- `docs/ARCHITECTURE.md` — This file
- `docs/DEVELOPMENT.md` — Local dev setup
- `docs/DEPLOYMENT.md` — Deploy guide
- `docs/EMAIL_SETUP.md` — Mail provider setup
- `CLAUDE.md` — Developer reference (patterns, commands)
- `AGENTS.md` — Agent collaboration guide
- `CONTRIBUTING.md` — Git workflow
- `OPERATIONS.md` — API operations reference
- `PRODUCTION_CHECKLIST.md` — Pre-deploy verification
- `STARTUP.md` — Manual local setup

### 📦 Archive/Inactive (Not Referenced)
- `Backup/` — Old backups and archived notes
- `Backup/2026-05-21_obsolete_docs/` — archived project notes moved out of the live tree
- Historical completion reports

### Rule
**If a document references a command, that command must exist in `package.json`.**

## Phase 1 Alignment Changes (Complete)

### Recent Alignment Changes

### 🟢 Hardcoded IPs removed
- **Was**: `192.168.1.17:3555`, `192.168.1.17:3000`
- **Now**: `127.0.0.1:3555`, `127.0.0.1:3000` (localhost)
- **Files**: CLAUDE.md, README.md, STARTUP.md, playwright.wasp.config.ts, test/e2e-wasp/global-setup.ts

### 🟢 Docker build path corrected
- **Was**: Compose pointed at a non-existent Dockerfile and the API image used a dev-style startup
- **Now**: Compose builds from repo root and the API image runs the built server artifact
- **Files**: `Dockerfile`, `docker-compose.yml`, `.dockerignore`

### 🟢 CI dependency install corrected
- **Was**: test/build jobs did not consistently install `wasp-app` dependencies and referenced a missing coverage command
- **Now**: CI installs `wasp-app` dependencies and uses the staged coverage gate command
- **Files**: `.github/workflows/ci.yml`

### 🟡 Still In Progress
- Reduce `any` in workers, webhooks, operations
- Centralize env config with Zod validation
- Define shared DTO contracts
- Continue cleaning archive/generated artifacts from the repo

## Key Invariants (MUST Preserve)

1. **One app root** — All code in `wasp-app/src/`, never duplicated
2. **Port 3555** — Backend hardcoded to 3555 (update docs if changed)
3. **Ownership checks** — Every operation verifies `context.user` ownership
4. **Error codes** — Standardized HTTP: 401, 403, 404, 422, 429, 402
5. **Database authority** — PostgreSQL is source of truth (Redis is cache)
6. **Migrations** — Always use `wasp db migrate-dev --name <desc>`
7. **API key security** — Bcrypt hashing, never store raw keys
8. **Webhook signing** — HMAC-SHA256 with API key secret
9. **Quota invariant** — Decrement on submit, refund only on cancel/fail
10. **Plan visibility** — Starter gets delta counts only (no enterprise details)
11. **Provider-aware planning** — use `plannedSources` and `ScanResult.source` as truth; do not hardcode a permanent two-provider model
12. **OpenAPI parity** — `/api/v1/*` must stay aligned across `main.wasp`, the endpoint manifest, and generated OpenAPI spec

## Testing

```bash
npm test                        # Unit + integration (Jest)
npx playwright test test/e2e/   # E2E (Playwright)
npm run lint                    # ESLint
npm run build                   # Verify build works
```

## Next Phase (Phase 2)

- [ ] Centralize env config: `src/server/config/env.ts` with Zod
- [ ] Define shared DTOs: `src/shared/types/` for operations/webhooks
- [ ] Reduce `any` gradually in critical paths
- [ ] Clarify operation/service/worker boundaries
- [ ] Remove archive artifacts from live docs and keep them under `Backup/`

## References

- **This file**: Architecture & repo structure
- **CLAUDE.md**: Development patterns & conventions
- **AGENTS.md**: AI agent collaboration guide
- **OPERATIONS.md**: API operations reference (all 20 operations)
- **docs/DEVELOPMENT.md**: Local dev setup (detailed)
- **docs/DEPLOYMENT.md**: Current deployment model and caveats
- **CONTRIBUTING.md**: Git workflow
- **Wasp Docs**: https://wasp.sh/docs
