# AGENTS.md — Guidance for Agent Collaboration

This file provides instructions for AI agents and automated tools working on the VibeScan project. For human developer guidance, see [CLAUDE.md](CLAUDE.md).

## Project Overview

VibeScan is a dual-scanner SaaS vulnerability platform: Grype (free) + Codescoring/BlackDuck (enterprise). **Currently migrating to Wasp full-stack framework**. All 9 development phases complete. Frontend is now Wasp React; legacy Next.js moved to `backup/` folder.

## Structure & Key Paths

```
wasp-app/                  # Primary Wasp application (NEW)
├── main.wasp              # Wasp configuration (routes, pages, auth, DB schema)
├── src/
│   ├── client/            # Frontend React + Vite
│   │   ├── App.tsx        # Root with Sidebar
│   │   ├── components/    # Reusable components (Sidebar, etc.)
│   │   └── ...
│   ├── dashboard/         # Dashboard pages
│   ├── auth/              # Auth forms and utilities
│   └── server/            # Backend operations (queries/actions)
├── prisma/                # Prisma schema and migrations
└── migrations/            # Wasp-specific migrations

src/                       # Legacy backend (Fastify) - being phased out
├── index.ts              # Main server entry
├── handlers/             # HTTP handlers
├── services/             # Business logic
├── workers/              # Scanner workers
└── database/             # PostgreSQL client

test/
├── e2e/                  # Playwright E2E tests
├── integration/          # Full workflow tests
└── unit/                 # Isolated tests

backup/                   # Archived legacy components (NOT in git)
├── wasp-app/src/         # Old Next.js UI components, hooks, etc.
└── ...

deploy/                   # Kubernetes manifests
.github/                  # CI/CD workflows
```

## Core Runtime Flows (Wasp-First)

**1. Startup** (`PORT=3555 wasp start`)
- Wasp compiles TypeScript, generates SDK, bundles frontend & backend
- Frontend (Vite) on port 3000
- Backend (Node.js) on port 3555
- Wasp manages Prisma migrations automatically

**2. Authentication** (Wasp built-in)
- Email signup → `wasp/client/auth` form → `/auth/email/signup` endpoint
- Wasp creates User, Auth, AuthIdentity, Session records
- Sessions stored in database; refresh tokens via Wasp

**3. Protected Pages**
- Routes marked `authRequired: true` in main.wasp
- Frontend checks auth via `useAuth()` hook
- Redirect to `/login` if not authenticated

**4. Operations** (Queries & Actions)
- Queries: read-only, cached, called like functions
- Actions: mutations, side effects, transaction support
- Backend enforces user ownership via context

**5. Database** (PostgreSQL + Prisma)
- Schema in `prisma/schema.prisma`
- Wasp auto-manages auth tables
- Migrations via `wasp db migrate-dev`

## Build & Test Commands (Wasp-Focused)

**Development**:
```bash
cd wasp-app
PORT=3555 wasp start              # Full-stack dev (frontend + backend + DB)
PORT=3555 wasp start db           # Database only (Docker optional)
wasp db migrate-dev               # Apply pending migrations
wasp db studio                    # Prisma GUI
```

**Testing**:
```bash
cd /home/virus/vibescan
npm test                          # Jest unit/integration
npx playwright test test/e2e/     # Playwright E2E
npx playwright show-report        # View report
```

**Building & Deploying**:
```bash
wasp build                        # Generate production bundle
wasp deploy railway               # Deploy to Railway
wasp deploy fly                   # Deploy to Fly.io
```

## Code Style & Invariants (Wasp Era)

**Frontend (React + Wasp)**
- Components in TypeScript (.tsx)
- Use `useAuth()` for authenticated user context
- Use `wasp/client/operations` for backend calls
- Import routes: `import { routes } from 'wasp/client/router'`

**Backend (Node.js operations)**
- Operations in TypeScript (.ts)
- Receive `context` (includes `user`, `entities`)
- Declare in main.wasp with `entities: [Model]`
- Use Prisma for DB access: `context.entities.Model.findUnique(...)`

**Database**
- Schema in `prisma/schema.prisma`
- Migrations auto-created: `wasp db migrate-dev`
- Wasp manages auth schema (don't modify manually)

**Naming Conventions**
- Components: PascalCase (`Sidebar.tsx`, `DashboardPage.tsx`)
- Functions: camelCase (`useAuth`, `getScan`)
- Routes: PascalCase + "Route" suffix (`DashboardRoute`, `LoginRoute`)
- Wasp DSL: camelCase (queries, actions, pages, routes)

**Critical Invariants** (Enforce always)
1. **PORT 3555**: Backend hardcoded; `.env.server` defines it
2. **API URL**: Frontend must know (`NEXT_PUBLIC_API_URL`)
3. **Auth context**: Access via `useAuth()` (Wasp provides)
4. **Ownership**: Enforce in operations via `context.user`
5. **Migrations**: Always use `wasp db migrate-dev` (not `prisma migrate`)
6. **ESM imports**: Use `.js` extensions in imports (despite `.ts` files)
7. **No direct auth queries**: Let Wasp handle User/Auth/Session tables

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
