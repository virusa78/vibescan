# AGENTS.md — VibeScan Agent Guide

VibeScan is a dual-scanner SaaS vulnerability platform (Grype free + Codescoring/BlackDuck enterprise) built on Wasp 0.23+. Full-stack TypeScript, PostgreSQL, Redis, BullMQ, Stripe.

## Commands

```bash
./run.sh                          # Start Docker (PG/Redis/MinIO) + Wasp dev server
./run.sh --stop                   # Stop all services

npm test                          # Jest unit + integration (from repo root)
npm test -- test/unit/FILE.ts     # Single test file
npm test -- -t "pattern"          # Tests matching name pattern
npm run test:watch                # Jest watch mode
npm run test:coverage             # Coverage report (no gate)
npm run test:coverage:gate        # Staged gate (lines>=6, branches>=3)
npm run test:coverage:strict      # Target gate (lines>=70, branches>=70)
npm run test:e2e                  # Playwright E2E (requires running backend)

npm run lint                      # ESLint check
npm run lint:fix                  # ESLint auto-fix
npx tsc --noEmit                  # TypeScript check (root tsconfig covers wasp-app/src/)
npm run openapi:contract          # Validate OpenAPI contract parity

cd wasp-app && wasp build         # Production build -> .wasp/build/
cd wasp-app && wasp clean         # Clear build artifacts (fixes stale generated code)
```

### Database

```bash
cd wasp-app
wasp db migrate-dev --name "description"   # ALWAYS use this, never raw prisma migrate
wasp db studio                              # Visual Prisma editor
```

## Layout

```
wasp-app/                  # Primary Wasp app
├── main.wasp              # DSL: routes, pages, auth, all operations (55 queries/actions + 23 APIs)
├── schema.prisma          # Prisma schema (28 models, 741 lines) — at wasp-app root, NOT in prisma/
├── src/
│   ├── client/            # React frontend (Tailwind, Radix/shadcn)
│   ├── server/operations/ # Wasp operation implementations (9 domains, see below)
│   ├── server/services/   # Shared services (workspaceAccess.ts, etc.)
│   ├── server/lib/        # Scanner libs, provider selection
│   ├── auth/              # Auth forms, email templates
│   ├── payment/           # Stripe integration
│   └── shared/            # Shared types & utilities
├── migrations/            # Wasp-managed migrations (NEVER edit manually)
└── .env.server            # Server config (PORT=3555)

test/                      # Jest tests (run from repo root)
├── unit/                  # Isolated unit tests (33 files)
├── integration/           # Full workflow tests (6 files)
├── e2e-wasp/              # Playwright E2E (config: playwright.wasp.config.ts, 11 specs)
├── mocks/                 # Test mocks (wasp-server.ts)
└── fixtures/              # Test fixtures
```

### Operation domains

Operations live in `wasp-app/src/server/operations/` organized by domain:

- `apikeys/` — generate, list, revoke, details
- `scans/` — submit, get, list, cancel, stats, orchestrator
- `reports/` — get report, summary, PDF, CI decision, annotations
- `webhooks/` — CRUD, deliveries, test, retry
- `dashboard/` — metrics, trends, severity, quota, saved views, bulk actions
- `billing/` — Stripe checkout, portal
- `workspaces/` — list, switch, context
- `onboarding/` — state, completion
- `github/` — installations, link, settings, webhook handler
- `settings/` — profile, scanner access, notifications
- `remediation/` — CVE remediation generation
- `auth/` — token refresh

Each domain has: individual op files, `index.ts` barrel, `handlers.ts` for shared logic, `swagger-docs.ts` for OpenAPI docs.

## Wasp Operation Pattern

Operations are the core pattern. Declare in `main.wasp`, implement in `src/server/operations/`, call from client via `wasp/client/operations`.

```wasp
query myOp {
  fn: import { myOp } from "@src/server/operations/myFile",
  entities: [User, Scan],
  auth: true
}
```

**Key rules:**
- Add entity to `entities: [...]` or `context.entities.X` will be undefined at runtime
- Server ops receive `(args, context)` — check `context.user` for ownership
- Custom `api {}` handlers do NOT get `context.user` auto-injected (use Bearer token auth or convert to query/action)
- Import path must use `@src/` prefix in main.wasp, never relative

## Critical Gotchas

### Migrations
- **Never** run `prisma migrate dev` directly. Always `wasp db migrate-dev --name "x"`.
- **Never** manually edit files in `migrations/`.
- Schema changes have no effect until migration is run. Wasp dev server warns about pending migrations but continues.
- Feature branches must have sequential migration timestamps to avoid auth table corruption on merge.

### Auth Tables
- Wasp auto-manages Auth, AuthIdentity, Session tables. Never edit these in schema.prisma or migrations.
- If auth breaks after a merge, `git revert` the merge — do not manually recreate auth tables.

### Workspace Scoping
- All resources (scans, webhooks, API keys) are scoped to a workspace.
- Use `requireWorkspaceScopedUser(context.user)` (from `src/server/services/workspaceAccess.ts`) to get `activeWorkspaceId`.
- Always filter queries by `workspaceId`.

### Port & URLs
- Backend: port 3555 (hardcoded in `.env.server`)
- Frontend: port 3000 (Wasp/Vite default)
- If port 3555 in use: `lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9`

### TypeScript
- Root `tsconfig.json` has `strict: false` and covers `wasp-app/src/**/*`.
- `wasp-app/tsconfig.json` has `strict: true` (for IDE support only — Wasp compiles with its own config).
- After schema or main.wasp changes, Wasp recompiles automatically. **Wait patiently** for recompilation.
- Persistent type errors after waiting: `wasp clean && wasp start`.

### Testing
- Jest config at repo root uses `tsconfig.test.json`, ESM mode with ts-jest.
- Test mocks for Wasp internals live in `test/mocks/wasp-server.ts`.
- Coverage gates are deliberately low (staged: 6/3) — strict mode targets 70/70.
- E2E tests use `playwright.wasp.config.ts` with test dir `test/e2e-wasp/`.
- E2E auto-orchestration: checks health, auto-starts Docker/frontend if down. Disable with `E2E_AUTO_START=false`.

### Build
- `wasp clean` deletes `.wasp/` — safe to run, regenerates on next `wasp start`.
- Generated code lives in `.wasp/` — never edit it directly.

### Schema location
- The Prisma schema is at `wasp-app/schema.prisma` (root of wasp-app).
- Active migrations live in `wasp-app/migrations/`. There is no `wasp-app/prisma/` directory.

### Seed scripts
- **Always use Prisma Client** (`import { PrismaClient } from '../wasp-app/node_modules/@prisma/client'`), never raw SQL.
- `@prisma/client` lives in `wasp-app/node_modules/`, not at repo root.
- Prisma enums (ScanSource, PlanTier, etc.) are not named ESM exports in Prisma v5 — use string literals (`'grype'`, `'pro'`) instead of `ScanSource.grype`.
- Run with: `DATABASE_URL=... node --import tsx scripts/fill-mock-data.ts`
- Env vars: `DEMO_MONTHS` (default 6), `RESET_DEMO_DATA` (default true)

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`)
- **Naming:** operations camelCase, components PascalCase, routes PascalCase+Route suffix
- **Styling:** Tailwind utility classes only, no CSS modules
- **Errors:** `throw new HttpError(statusCode, 'machine_readable_key', { message })` with standard codes (401/403/404/422/429/402)
- **API keys:** Bcrypt hashed, raw key returned only at generation
- **Webhooks:** HMAC-SHA256 signed
- **Plan files:** Use `plan.md` as the only active plan. MVP_/PHASE_/*_COMPLETION* files are historical archive.

## Provider-aware scanner model

Provider planning lives in `wasp-app/src/server/lib/scanners/providerSelection.ts`.
- Non-enterprise plans run `grype`
- Enterprise runs `grype + codescoring_johnny` when Snyk is disabled
- Enterprise runs `grype + snyk` in parallel when `VIBESCAN_ENABLE_SNYK_SCANNER=true`
- `plannedSources` is persisted on each Scan at submission time
- Lifecycle finalization evaluates against stored `plannedSources`, not current provider policy

## OpenAPI contract

- `wasp-app/src/server/swagger/v1EndpointManifest.ts` defines the declared `/api/v1` surface
- `npm run openapi:contract` validates parity between manifest and `main.wasp`
- Contract requires `operationId`, `security`, request bodies, and 2xx/4xx/5xx responses

## Verification Before Push

```bash
npm run lint && npx tsc --noEmit && npm test
```

## References

- `OPERATIONS.md` — Complete API reference for all operations
- `CLAUDE.md` — Full developer guide
- `.github/copilot-instructions.md` — Copilot-specific setup
- `wasp-app/AGENTS.md` — Open SaaS / Wasp documentation fetch instructions
