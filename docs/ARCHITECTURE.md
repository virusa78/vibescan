# VibeScan Architecture — Repo Structure & Alignment

**Status**: ✅ Phase 1 (operational alignment) complete (April 2026)

## Quick Summary

- **Single app root**: All code is in `wasp-app/src/`, not split elsewhere.
- **Wasp-only**: v0.23+ (no legacy Fastify or Next.js). Build via `wasp build`.
- **Port 3555**: Backend hardcoded to run on port 3555 (critical for docs/CI/tests).
- **Source of truth**: `wasp-app/` contains active application; root-level files orchestrate, test, and document.
- **Docker**: Built from root `Dockerfile`, reads from `wasp-app/` tree.
- **CI**: Root-level workflows orchestrate; install both root and `wasp-app/` dependencies.

## Source of Truth

| Component | Location | Truth | Notes |
|-----------|----------|-------|-------|
| **App code** | `wasp-app/src/` | Wasp DSL + TypeScript | Only source of app code |
| **Database schema** | `wasp-app/prisma/schema.prisma` | Prisma ORM | Source of truth for data model |
| **Migrations** | `wasp-app/prisma/migrations/` | Auto-generated | Apply via `wasp db migrate-dev` |
| **Config** | `.env.server`, `.env.local` | Environment files | Env vars override defaults |
| **Docs** | `docs/`, root `.md` files | Markdown | Must stay synchronized with code |
| **Tests** | `test/` | Jest + Playwright | Run from root via `npm test` |
| **CI** | `.github/workflows/` | GitHub Actions | Orchestrates from root |
| **Docker** | Root `Dockerfile` | Container image | Built from real app layout |

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
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (source of truth)
│   │   └── migrations/            # Auto-generated migrations
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

### Ports (Critical)

| Service | Port | Config | Must Update When Changed |
|---------|------|--------|-------------------------|
| **Backend API** | 3555 | `.env.server: PORT=3555` | CLAUDE.md, README.md, STARTUP.md, Playwright config, CI |
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

## Operational Boundaries

### Docker Build
- **Source**: Root `Dockerfile` (not Fastify-based; now Wasp-only)
- **Reads from**: `wasp-app/package.json`, `wasp-app/src/`, `wasp-app/main.wasp`
- **Artifact**: `wasp-app/.wasp/build/` (generated by `wasp build` in Docker)
- **Run command**: `node .wasp/build/server` (not legacy `npm run start`)

### CI Pipeline
1. Install root deps: `npm install`
2. Install wasp-app deps: `cd wasp-app && npm ci`
3. Lint: `npm run lint` (ESLint all code)
4. Test: `npm test` (Jest: unit + integration)
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
- `CLAUDE.md` — Developer reference (patterns, commands)
- `AGENTS.md` — Agent collaboration guide
- `CONTRIBUTING.md` — Git workflow
- `OPERATIONS.md` — API operations reference
- `PRODUCTION_CHECKLIST.md` — Pre-deploy verification
- `STARTUP.md` — Manual local setup

### 📦 Archive/Inactive (Not Referenced)
- `Backup/`, `backup/` — Old backups
- Legacy markdown files (superseded by current docs)
- Historical completion reports

### Rule
**If a document references a command, that command must exist in `package.json`.**

## Phase 1 Alignment Changes (Complete)

### 🟢 Fixed: Hardcoded IPs
- **Was**: `192.168.1.17:3555`, `192.168.1.17:3000`
- **Now**: `127.0.0.1:3555`, `127.0.0.1:3000` (localhost)
- **Files**: CLAUDE.md, README.md, STARTUP.md, playwright.wasp.config.ts, test/e2e-wasp/global-setup.ts

### 🟢 Fixed: Dockerfile paths
- **Was**: Copied from root `src/` (doesn't exist)
- **Now**: Copies from `wasp-app/` root correctly
- **Files**: `Dockerfile`, `.dockerignore`

### 🟢 Fixed: CI dependency install
- **Was**: CI didn't install wasp-app dependencies
- **Now**: CI runs `cd wasp-app && npm ci`
- **Files**: `.github/workflows/ci.yml`

### 🟢 Fixed: Documentation drift
- **Was**: References to non-existent scripts, outdated Fastify architecture
- **Now**: Aligned with Wasp-only structure
- **Files**: README.md, CLAUDE.md, CONTRIBUTING.md, .github/copilot-instructions.md

### 🟡 In Progress: Type safety (Phase 2)
- Reduce `any` in workers, webhooks, operations
- Centralize env config with Zod validation
- Define shared DTO contracts

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
- [ ] Remove archive artifacts (Backup/, backup/)

## References

- **This file**: Architecture & repo structure
- **CLAUDE.md**: Development patterns & conventions
- **AGENTS.md**: AI agent collaboration guide
- **OPERATIONS.md**: API operations reference (all 20 operations)
- **docs/DEVELOPMENT.md**: Local dev setup (detailed)
- **docs/DEPLOYMENT.md**: Production deploy
- **CONTRIBUTING.md**: Git workflow
- **Wasp Docs**: https://wasp.sh/docs
