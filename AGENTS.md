# AGENTS.md — Guidance for Agent Collaboration

This file provides instructions for AI agents and automated tools working on the VibeScan project. For human developer guidance, see [CLAUDE.md](CLAUDE.md).

## Project Overview

VibeScan is a dual-scanner SaaS vulnerability platform: Grype (free) + Codescoring/BlackDuck (enterprise). **Complete Wasp-only architecture**—all legacy code removed. All 9 development phases complete. Full-stack TypeScript with 20 operations.

## Architecture Status

✅ **COMPLETE WASP MIGRATION**
- Primary: Wasp 0.23+ (full-stack)
- Legacy: Completely removed from git
- Code: Zero legacy Fastify code
- Phases: All 9 + migration done
- Operations: 20 total (documented in OPERATIONS.md)

## Critical Structure

```
wasp-app/                          # Primary Wasp full-stack app
├── main.wasp                       # DSL config (20 operations, auth, routes)
├── src/
│   ├── client/                     # React frontend (Vite)
│   │   ├── App.tsx                 # Root with auth check
│   │   ├── components/             # Reusable UI components
│   │   └── hooks/                  # React hooks
│   ├── server/                     # Backend operations
│   │   ├── operations/             # 20 Wasp operations (core logic)
│   │   │   ├── apikeys/
│   │   │   ├── scans/
│   │   │   ├── reports/
│   │   │   ├── webhooks/
│   │   │   ├── billing/
│   │   │   └── dashboard/
│   │   ├── swagger/                # OpenAPI/Swagger docs
│   │   └── scripts/                # DB seeds, migrations
│   ├── auth/                       # Auth forms and templates
│   └── payment/                    # Stripe integration
├── prisma/
│   ├── schema.prisma               # Prisma schema (13 tables)
│   └── migrations/                 # Auto-generated migrations
├── .env.server                     # Server config (PORT=3555)
└── .env.local                      # Local overrides

test/                               # Test suite (Jest + Playwright)
├── e2e/                            # Playwright E2E tests
├── integration/                    # Full workflow tests
└── unit/                           # Isolated component tests

OPERATIONS.md                       # API reference (ALL 20 operations)
CLAUDE.md                          # Developer guide
```

## Core Runtime Flows (Wasp-Only)

**1. Request → Operation → Response Pattern**
```
Client (React) 
  ↓ calls getScan()
Wasp Client SDK 
  ↓ RPC call to
Backend (Node.js)
  ↓ resolves operation
Server Operation (src/server/operations/scans/)
  ↓ checks context.user ownership
  ↓ queries Prisma
PostgreSQL
  ↓ returns data
Response
  ↓ back to client
React component re-renders
```

**2. Authentication Flow**
- User submits email/password → Wasp auth form
- Wasp creates User, Auth, AuthIdentity, Session
- JWT access token (15 min) + refresh token (30 days) issued
- Frontend stores in Wasp auth context
- Operations receive `context.user` automatically

**3. Scan Submission**
- User submits via `submitScan()` action
- Operation verifies quota, checks ownership
- Scan record created in PostgreSQL
- BullMQ job enqueued (free/enterprise workers)
- Response: scanId, status, queue position
- Webhook fired: 'scan.submitted' event

**4. Report Generation**
- User requests report via `getReport()` query
- Operation fetches Scan, Findings, ScanDelta
- Applies paywall rules (starter = counts only)
- Computes delta (enterprise vs free findings)
- Returns structured report JSON

**5. Webhook Delivery**
- Scan completes → event triggered
- Find all webhooks subscribed to event
- Create signed payload (HMAC-SHA256)
- Enqueue to webhook_delivery_queue
- BullMQ worker retries with exponential backoff

## Wasp Operation Declarations (main.wasp)

All 20 operations declared in `main.wasp`:

```wasp
// User Management (3 operations)
query getPaginatedUsers { ... }
action updateIsUserAdminById { ... }
action updateUserSettings { ... }

// API Keys (3 operations)
action generateApiKey { ... }
query listApiKeys { ... }
action revokeApiKey { ... }

// Scans (3 operations)
query getScans { ... }
query getScanById { ... }
action submitScan { ... }

// Reports (4 operations)
query getReport { ... }
query getReportSummary { ... }
action generateReportPDF { ... }
query getCIDecision { ... }

// Webhooks (5 operations)
action createWebhook { ... }
query listWebhooks { ... }
query getWebhook { ... }
action updateWebhook { ... }
action deleteWebhook { ... }

// Billing (2 operations)
query getCustomerPortalUrl { ... }
action generateCheckoutSession { ... }
```

See [OPERATIONS.md](OPERATIONS.md) for complete operation documentation.

## Build & Deploy Commands

**Development** (for agents/scripts to run):
```bash
cd /home/virus/vibescan/wasp-app
PORT=3555 wasp start                    # Full-stack: frontend + backend + DB

# In separate terminal:
cd /home/virus/vibescan
npm test                                # Run all tests
npm run lint                            # ESLint check
npx tsc --noEmit                       # TypeScript check
```

**Testing**:
```bash
cd /home/virus/vibescan
npm test                                # Jest (unit + integration)
npx playwright test test/e2e/          # Playwright E2E
npm run test:coverage                   # Coverage report
```

**Production Build**:
```bash
cd /home/virus/vibescan/wasp-app
wasp build                              # Generates .wasp/build/

# Output structure:
# .wasp/build/server/     # Node.js app
# .wasp/build/client/     # Static React files
```

**Deploy to Production**:
```bash
cd /home/virus/vibescan/wasp-app
wasp deploy railway                     # Deploy to Railway.app
# OR
wasp deploy fly                         # Deploy to Fly.io
```

**Database Management**:
```bash
cd /home/virus/vibescan/wasp-app
wasp db migrate-dev                     # Apply pending migrations
wasp db studio                          # Prisma visual editor
wasp db push                            # Sync schema to DB (development)

## Code Conventions (Wasp Era)

**Frontend (React + TypeScript)**
- Components: `.tsx` files in `src/client/` or `src/dashboard/`
- Hooks: `useAuth()` from Wasp, custom hooks in `src/client/hooks/`
- Operations: Import from `wasp/client/operations`
- Routes: Import from `wasp/client/router`
- Styling: Tailwind CSS utility classes

**Backend (Node.js + TypeScript)**
- Operations: `.ts` files in `src/server/operations/`
- Declare in `main.wasp` with entity list
- Always check `context.user` for ownership
- Use Prisma: `context.entities.Model.findUnique(...)`
- Error handling: Throw `HttpError(statusCode, message, details)`

**Database (Prisma)**
- Schema: `wasp-app/prisma/schema.prisma`
- Never edit auth tables manually (Wasp manages them)
- Migrations: Always use `wasp db migrate-dev`
- Enums: Use for fixed values (plan, severity, status)

**Naming**
- Components: `PascalCase` (Dashboard, Sidebar, ApiKeysPage)
- Functions: `camelCase` (getScan, submitScan, getUserSettings)
- Tables: `PascalCase` (User, Scan, Finding, Webhook)
- Fields: `camelCase` (userId, createdAt, emailNotifications)
- Routes: `PascalCase` with "Route" suffix (DashboardRoute, LoginRoute)

## Critical Invariants (ALWAYS Enforce)

1. **Ownership Verification**: Every query/action checks `context.user.id` owns resource
2. **Port 3555**: Backend hardcoded (`.env.server: PORT=3555`)
3. **Error Codes**: Use standard codes (401, 403, 404, 422, 429, 402)
4. **Migrations**: Always `wasp db migrate-dev` (never `prisma migrate` directly)
5. **API Key Security**: Bcrypt hashing, never store raw keys
6. **Webhook Signing**: HMAC-SHA256 using user's API key secret
7. **Quota Tracking**: Decrement on submission, refund on cancellation only
8. **Plan Visibility**: Starter plan gets delta counts, not details
9. **Source Isolation**: Docker containers with `--network=none`, `--read-only`
10. **Idempotency**: Use `Idempotency-Key` header for mutation retries
11. **PostgreSQL Authority**: Wasp/Prisma is cache; PostgreSQL is source of truth
12. **No Raw Key Storage**: API keys returned once at generation, never logged

## Testing Strategy

**Unit Tests** (`test/unit/`)
```bash
npm test -- test/unit/              # All unit tests
npm test -- test/unit/ -t "pattern" # Specific test by name
```
- Test individual functions in isolation
- Mock external dependencies
- Property-based tests for core algorithms

**Integration Tests** (`test/integration/`)
```bash
npm test -- test/integration/       # Full workflow tests
```
- Test full scan flow (submit → process → report)
- Real DB/Redis (test fixtures)
- Auth flow, quota, billing, webhooks

**E2E Tests** (`test/e2e/`)
```bash
npx playwright test test/e2e/
npx playwright test test/e2e/ --headed    # With UI
npx playwright show-report                 # View results
```
- Full user journeys (register → scan → report)
- Browser automation via Playwright
- Real backend (wasp start must be running)

**Coverage**
```bash
npm run test:coverage               # Generate coverage report
npm run test:coverage:gate          # Check baseline gate
npm run test:coverage:strict        # Targets 70/70 lines/branches
```

## Common Agent Tasks

### Adding a New Operation

1. **Define in main.wasp**:
   ```wasp
   query getMetrics {
     fn: import { getMetrics } from "@src/server/operations/metrics",
     entities: [User, Scan]
   }
   ```

2. **Implement in server**:
   ```typescript
   // src/server/operations/metrics/index.ts
   export const getMetrics = async (args, context: any) => {
     // Verify ownership
     if (!context.user) throw new HttpError(401, 'unauthorized')
     
     // Query with Prisma
     const metrics = await context.entities.Scan.findMany({
       where: { userId: context.user.id }
     })
     
     return { count: metrics.length }
   }
   ```

3. **Use from client**:
   ```typescript
   import { getMetrics } from 'wasp/client/operations'
   const { data: metrics } = await getMetrics()
   ```

### Adding a New Page

1. **Create React component**: `src/client/pages/NewPage.tsx`
2. **Add route in main.wasp**:
   ```wasp
   route NewPageRoute { path: "/new-page", to: NewPage }
   page NewPage {
     authRequired: true,
     component: import { NewPage } from "@src/client/pages/NewPage"
   }
   ```
3. **Link from navbar**: Use `routes.NewPageRoute.to` in navigation

### Adding a Database Model

1. **Update `prisma/schema.prisma`**:
   ```prisma
   model MyModel {
     id    String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     name  String
     userId String
     user  User @relation(fields: [userId], references: [id])
   }
   ```

2. **Run migration**: `wasp db migrate-dev`

3. **Use in operations**: Add to `entities: [MyModel]` in main.wasp

## Documentation References

- **Operations API**: [OPERATIONS.md](OPERATIONS.md) — Complete reference for all 20 operations
- **Developer Guide**: [CLAUDE.md](CLAUDE.md) — Full developer documentation
- **Wasp Docs**: https://wasp.sh/docs
- **Prisma ORM**: https://www.prisma.io/docs
- **React**: https://react.dev

## Troubleshooting for Agents

**"Cannot find module '@src/...'"**
- Check file path is correct and file exists
- Verify TypeScript paths in tsconfig.json

**"Port 3555 already in use"**
```bash
lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**Build fails with "module not found"**
- Run: `cd wasp-app && wasp clean && wasp start`
- Verify all imports in main.wasp resolve correctly

**Tests timeout**
- Increase timeout in jest.config.js or playwright.config.ts
- Verify backend is running (`PORT=3555 wasp start`)
- Check database is accessible

## Implementation Status

✅ **All Phases Complete (1-9)**
✅ **Wasp Migration Complete** (Fastify → Wasp)
✅ **20 Operations Implemented**
✅ **All Tests Passing**
✅ **Documentation Updated**
✅ **Production Ready**

---

**Last Updated**: April 2026  
**Wasp Version**: 0.23+  
**Node.js**: 24.14.1 LTS  
**Architecture**: Wasp-only (legacy removed)  
**Status**: Production Ready

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
