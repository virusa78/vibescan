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
npm run test:coverage             # Coverage (staged gate: lines≥6, branches≥3)
npm run test:e2e                  # Playwright E2E (requires running backend)

npm run lint                      # ESLint check
npm run lint:fix                  # ESLint auto-fix
npx tsc --noEmit                  # TypeScript check (root tsconfig covers wasp-app/src/)

cd wasp-app && wasp build         # Production build → .wasp/build/
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
├── main.wasp              # DSL: routes, pages, auth, all operations
├── schema.prisma          # Prisma schema (~30 models)
├── src/
│   ├── client/            # React frontend (Tailwind, Radix/shadcn)
│   ├── server/operations/ # Wasp query/action implementations
│   │   ├── *Operations.ts # Flat files (dashboardOperations.ts, etc.)
│   │   └── */             # Domain dirs with handlers/ subfiles
│   ├── auth/              # Auth forms, email templates
│   ├── payment/           # Stripe integration
│   └── shared/            # Shared types & utilities
├── migrations/            # Wasp-managed migrations (NEVER edit manually)
├── prisma/migrations/     # Additional Prisma migrations
└── .env.server            # Server config (PORT=3555)

test/                      # Jest tests (run from repo root)
├── unit/                  # Isolated unit tests
├── integration/           # Full workflow tests
├── e2e-wasp/              # Playwright E2E (config: playwright.wasp.config.ts)
└── mocks/                 # Test mocks (includes wasp-server mock)
```

## Wasp Operation Pattern

Operations are the core pattern. Declare in `main.wasp`, implement in `src/server/operations/`, call from client via `wasp/client/operations`.

```wasp
query myOp {
  fn: import { myOp } from "@src/server/operations/myFile",
  entities: [User, Scan],  // must list every model accessed
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
- **Never** manually edit files in `migrations/` or `prisma/migrations/`.
- Schema changes have no effect until migration is run. Wasp dev server warns about pending migrations but continues.
- Feature branches must have sequential migration timestamps to avoid auth table corruption on merge.

### Auth Tables
- Wasp auto-manages Auth, AuthIdentity, Session tables. Never edit these in schema.prisma or migrations.
- If auth breaks after a merge, `git revert` the merge — do not manually recreate auth tables.

### Workspace Scoping
- All resources (scans, webhooks, API keys) are scoped to a workspace.
- Use `requireWorkspaceScopedUser(context.user)` to get `activeWorkspaceId`.
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

### Build
- `wasp clean` deletes `.wasp/` — safe to run, regenerates on next `wasp start`.
- Generated code lives in `.wasp/` — never edit it directly.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`)
- **Naming:** operations camelCase, components PascalCase, routes PascalCase+Route suffix
- **Styling:** Tailwind utility classes only, no CSS modules
- **Errors:** `throw new HttpError(statusCode, 'machine_readable_key', { message })` with standard codes (401/403/404/422/429/402)
- **API keys:** Bcrypt hashed, raw key returned only at generation
- **Webhooks:** HMAC-SHA256 signed

## Verification Before Push

```bash
npm run lint && npx tsc --noEmit && npm test
```

## References

- `OPERATIONS.md` — Complete API reference for all operations
- `CLAUDE.md` — Full developer guide
- `.github/copilot-instructions.md` — Copilot-specific setup
