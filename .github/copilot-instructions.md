# Copilot Instructions for VibeScan

This guide helps Copilot work effectively in the VibeScan repository. For comprehensive developer guidance, see [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md). For all API operations, see [OPERATIONS.md](../OPERATIONS.md).

## Project Overview

VibeScan is a full-stack SaaS vulnerability scanning platform built entirely on **Wasp** (v0.23+). It uses a provider-aware scanner architecture where:
- **Free plans** run `grype` (baseline free scanner)
- **Enterprise plans** run `grype + codescoring_johnny` or `grype + snyk` (when enabled)
- The planned scanner set is persisted on each scan (`plannedSources`) so lifecycle finalization uses the stored plan, not current policy

All resources (scans, webhooks, API keys) are **workspace-scoped** — a central pattern enforced via `requireWorkspaceScopedUser()`.

## Build & Test Commands

### Start Development Server (All-in-One)

```bash
./run.sh                    # Starts Docker + Wasp (recommended)
./run.sh --stop             # Stop all services
```

**Ports:** Frontend 3000 | Backend API 3555 | PostgreSQL 5432 | Redis 6379 | MinIO 9000

Alternative (manual Docker + Wasp):
```bash
docker-compose up -d        # Start PostgreSQL, Redis, MinIO
cd wasp-app && PORT=3555 wasp start  # Start Wasp full-stack (separate terminal)
```

### Testing

```bash
npm test                              # Run all unit + integration tests
npm test -- test/unit/FILENAME        # Single test file (e.g., test/unit/property-tests.test.ts)
npm test -- -t "pattern"              # Tests matching pattern (e.g., -t "workspace")
npm run test:watch                    # Watch mode (development)
npm run test:coverage                 # Coverage report (no thresholds)
npm run test:coverage:gate            # Staged gate (lines >= 6, branches >= 3)
npm run test:coverage:strict          # Strict gate (lines >= 70, branches >= 70)
npm run test:e2e                      # Playwright E2E tests (requires running backend + frontend)
npm run test:wasp                     # Wasp client tests (from wasp-app)
```

### Linting & Type Checking

```bash
npm run lint                # ESLint check (TypeScript warnings for explicit any)
npm run lint:fix            # Auto-fix ESLint issues
npx tsc --noEmit            # Full TypeScript check (covers wasp-app/src/)
npm run openapi:contract    # Validate OpenAPI contract parity
```

### Build

```bash
cd wasp-app && wasp build   # Production build (outputs .wasp/build/)
cd wasp-app && wasp clean   # Clear build artifacts (fixes stale generated code)
```

## Database & Migrations

The database schema is in `wasp-app/schema.prisma` (at the wasp-app root, **not** in wasp-app/prisma/). Always use Wasp for migrations:

```bash
cd wasp-app
wasp db migrate-dev --name "add field to Scan"   # ALWAYS use this
wasp db studio                                    # Visual Prisma editor
```

**Never** run `prisma migrate` directly. Wasp manages auth tables (User, Auth, AuthIdentity, Session) automatically.

**Schema location note:** Prisma migrations live in `wasp-app/migrations/` (auto-generated), not `wasp-app/prisma/migrations/`.

## Architecture Overview

### Tech Stack

- **Backend:** Wasp 0.23+ (Node.js 24.14.1 LTS)
- **Frontend:** React + TypeScript + Vite (wrapped by Wasp)
- **Database:** PostgreSQL 15 with Prisma ORM
- **Cache:** Redis (session state, quota tracking)
- **Task Queue:** BullMQ (scan processing, webhook delivery)
- **Storage:** S3 (AWS or MinIO for local dev)

### Project Structure

```
wasp-app/                          # Primary Wasp full-stack application
├── main.wasp                      # Wasp DSL (routes, pages, auth, operations)
├── schema.prisma                  # Prisma schema (at root, NOT in prisma/)
├── src/
│   ├── client/                    # React frontend
│   │   ├── App.tsx               # Root component with auth check
│   │   ├── components/           # Reusable UI components
│   │   └── hooks/                # Custom React hooks
│   ├── server/
│   │   ├── operations/           # Wasp operations (queries & actions)
│   │   │   ├── apikeys/
│   │   │   ├── scans/
│   │   │   ├── reports/
│   │   │   ├── webhooks/
│   │   │   ├── dashboard/
│   │   │   ├── billing/
│   │   │   ├── workspaces/
│   │   │   └── ...
│   │   ├── services/             # Shared business logic (workspaceAccess.ts, etc.)
│   │   ├── lib/scanners/         # Provider selection & scanner orchestration
│   │   └── swagger/              # OpenAPI documentation
│   ├── auth/                     # Auth forms & email templates
│   └── shared/                   # Shared types & utilities
├── migrations/                   # Wasp-managed migrations (never edit manually)
└── .env.server                   # Server config (PORT=3555)

test/                             # Jest + Playwright tests (run from repo root)
├── unit/                         # Unit tests
├── integration/                  # Full workflow tests
├── e2e-wasp/                     # Playwright E2E
├── mocks/                        # Test mocks (wasp-server.ts)
└── fixtures/                     # Test data

.github/
├── copilot-instructions.md       # This file (for Copilot)
├── COPILOT_SETUP.md             # MCP & cloud agent config
└── workflows/                    # GitHub Actions
```

## Workspace Scoping (Critical Pattern)

All resources (scans, webhooks, API keys, reports) are **workspace-scoped**. This means:

1. Each user has an `activeWorkspaceId`
2. All queries must filter by this workspace
3. The `requireWorkspaceScopedUser()` helper enforces this in operations

```typescript
// Always start operations with workspace verification
import { requireWorkspaceScopedUser } from '@src/server/services/workspaceAccess';

export const getScan = async (args: { scanId: string }, context: any) => {
  const user = await requireWorkspaceScopedUser(context.user);
  
  const scan = await context.entities.Scan.findUnique({
    where: { id: args.scanId }
  });
  
  // Always verify ownership by workspace
  if (!scan || scan.workspaceId !== user.activeWorkspaceId) {
    throw new HttpError(404, 'Scan not found');
  }
  
  return scan;
};
```

## Provider-Aware Scanner Architecture

VibeScan dynamically plans which scanners to use per scan, based on the user's plan:

- **Free plans:** `grype` only
- **Enterprise plans (Snyk disabled):** `grype + codescoring_johnny`
- **Enterprise plans (Snyk enabled):** `grype + snyk` (parallel execution)

**Key concept:** `plannedSources` is persisted on each Scan at submission time. Lifecycle finalization uses this stored plan, not the current provider policy. This allows policy changes without affecting incomplete scans.

```typescript
// Scan submission: resolve and store planned sources
import { resolvePlannedScannerExecutions } from "@src/server/lib/scanners/providerSelection";

const plannedExecutions = await resolvePlannedScannerExecutions(user, scan);
// plannedExecutions: [{ scanner: 'grype', resultSource: 'grype' }, ...]

const scan = await context.entities.Scan.create({
  data: {
    plannedSources: plannedExecutions.map(e => e.resultSource), // Persisted!
    // ...
  }
});
```

Provider selection logic lives in `wasp-app/src/server/lib/scanners/providerSelection.ts`.

## Key Architecture Patterns

### Wasp Operations Pattern

All business logic runs through Wasp operations. They're declared in `main.wasp` and implemented in `src/server/operations/`.

**Declaration (main.wasp):**
```wasp
query getScan {
  fn: import { getScan } from "@src/server/operations/scans/getScan",
  entities: [Scan, User, Workspace]
}

action submitScan {
  fn: import { submitScan } from "@src/server/operations/scans/submitScan",
  entities: [Scan, User, Workspace]
}
```

**Implementation (src/server/operations/scans/getScan.ts):**
```typescript
export const getScan = async (args: { scanId: string }, context: any) => {
  const user = await requireWorkspaceScopedUser(context.user);
  const scan = await context.entities.Scan.findUnique({
    where: { id: args.scanId }
  });
  if (!scan || scan.workspaceId !== user.activeWorkspaceId) {
    throw new HttpError(404, 'Scan not found');
  }
  return scan;
};
```

**Client Usage:**
```typescript
import { getScan } from 'wasp/client/operations';
const { data: scan } = await getScan({ scanId: 'scan-123' });
```

**Critical rules:**
- Add every entity to `entities: [...]` in main.wasp or `context.entities.X` will be undefined
- Use `@src/` prefix for imports in main.wasp, never relative paths
- Server ops receive `(args, context)` — check `context.user` for ownership and workspace
- Custom `api {}` handlers do NOT auto-inject `context.user` (use Bearer token auth or convert to query/action)

### Error Handling

Use standard HTTP error codes with machine-readable keys:

```typescript
throw new HttpError(401, 'unauthorized', { message: 'Not logged in' });
throw new HttpError(403, 'forbidden', { message: 'Access denied' });
throw new HttpError(404, 'not_found', { message: 'Resource not found' });
throw new HttpError(422, 'validation_error', {
  validation_errors: [
    { field: 'email', message: 'Invalid email' }
  ]
});
throw new HttpError(429, 'rate_limit', { message: 'Too many requests' });
throw new HttpError(402, 'payment_required', { message: 'Upgrade required' });
```

### Authentication

Wasp handles email/password auth automatically. All operations receive `context.user` (authenticated user). Frontend accesses auth via:

```typescript
import { useAuth } from 'wasp/client/auth';
import { Navigate } from 'react-router-dom';

export function ProtectedPage() {
  const { data: user, isLoading } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <div>Welcome {user.email}</div>;
}
```

## Code Conventions

### Linting Rules

ESLint is configured with TypeScript strict mode:

- `@typescript-eslint/no-explicit-any` → **warn** (allowed but discouraged)
- `@typescript-eslint/no-unused-vars` → **warn** (prefix with `_` to suppress: `_unused`)
- `no-console` → **off** (console.log is allowed)
- `no-debugger` → **warn** (remove before committing)

Run `npm run lint:fix` to auto-fix most violations. Then review the warnings.

### File Organization

**Operations:** One file per operation in its domain folder.

```
src/server/operations/scans/
├── getScan.ts              # Single operation per file
├── getScans.ts
├── submitScan.ts
├── index.ts               # Barrel export
└── handlers.ts            # Shared logic for domain
```

Export one function per file matching the operation name:
```typescript
export const getScan = async (args, context) => { /* ... */ };
```

### Naming Conventions

- **Operations & functions:** `camelCase` (getScan, submitScan, createWebhook)
- **Components:** `PascalCase` (DashboardPage, ApiKeysList, ScanCard)
- **Database models:** `PascalCase` (Scan, Finding, Webhook, Workspace)
- **Database fields:** `camelCase` (scanId, createdAt, webhookSecret)
- **Routes:** `PascalCase` + "Route" suffix (DashboardRoute, LoginRoute)
- **Constants:** `UPPER_CASE` (DEFAULT_TIMEOUT, MAX_RETRIES)

### Component Pattern

```typescript
import { useAuth } from 'wasp/client/auth';
import { getDashboardMetrics } from 'wasp/client/operations';
import { Navigate } from 'react-router-dom';

export function DashboardPage() {
  const { data: user } = useAuth();
  const { data: metrics, isLoading } = getDashboardMetrics();
  
  if (!user) return <Navigate to="/login" />;
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="p-6">
      <h1>Welcome {user.email}</h1>
      {/* Content */}
    </div>
  );
}
```

### Styling

Use **Tailwind CSS utility classes only**. No CSS modules or styled-components in new code.

```typescript
<div className="flex gap-4 p-6 bg-white rounded-lg shadow">
  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Submit
  </button>
</div>
```

### Testing Patterns

**Unit Test (isolated function):**
```typescript
describe('calculateQuotaUsage', () => {
  it('should return percentage used', () => {
    const usage = calculateQuotaUsage(50, 100);
    expect(usage).toBe(50);
  });
});
```

**Integration Test (operations with DB):**
```typescript
describe('submitScan operation', () => {
  it('should create a scan with plannedSources', async () => {
    const scan = await submitScan(
      { repositoryUrl: 'https://...' },
      { 
        user: mockUser, 
        entities: { Scan: mockScanEntity, User: mockUserEntity }
      }
    );
    expect(scan.plannedSources).toContain('grype');
  });
});
```

**Mocking:** Test mocks for Wasp internals live in `test/mocks/wasp-server.ts`. Operations reference this via Jest moduleNameMapper.

## Important Invariants (Must Preserve)

1. **Port 3555:** Backend ALWAYS on port 3555 (configured in `.env.server`)
2. **Workspace scoping:** All resources verified against `user.activeWorkspaceId`
3. **Ownership checks:** Operations verify user owns/has access to resource
4. **Database authority:** PostgreSQL is source of truth; Redis is cache only
5. **Migrations:** ALWAYS use `wasp db migrate-dev` (never `prisma migrate` directly)
6. **Schema location:** Prisma schema in `wasp-app/schema.prisma` (root), migrations in `wasp-app/migrations/`
7. **API key hashing:** Bcrypt hashing, never store raw keys in DB
8. **Webhook signing:** HMAC-SHA256 signature with user's API key secret
9. **Error responses:** Always use HttpError with standard codes (401, 403, 404, 422, 429, 402)
10. **Provider planning:** `plannedSources` persisted at submission; lifecycle finalization uses stored plan
11. **Idempotency:** Use `Idempotency-Key` header for safe mutation retries

## Common Tasks

### Add a New Operation

1. **Create function** in `src/server/operations/domain/operationName.ts`:
   ```typescript
   import { HttpError } from 'wasp/server';
   import { requireWorkspaceScopedUser } from '@src/server/services/workspaceAccess';

   export const myQuery = async (args: { itemId: string }, context: any) => {
     const user = await requireWorkspaceScopedUser(context.user);
     
     const item = await context.entities.MyModel.findUnique({
       where: { id: args.itemId }
     });
     
     if (!item || item.workspaceId !== user.activeWorkspaceId) {
       throw new HttpError(404, 'not_found', { message: 'Item not found' });
     }
     
     return item;
   };
   ```

2. **Declare in main.wasp:**
   ```wasp
   query myQuery {
     fn: import { myQuery } from "@src/server/operations/domain/operationName",
     entities: [MyModel, User, Workspace],
     auth: true
   }
   ```

3. **Use from client:**
   ```typescript
   import { myQuery } from 'wasp/client/operations';
   const { data } = await myQuery({ itemId: 'item-123' });
   ```

### Add a New Page

1. **Create component:** `src/client/pages/NewPage.tsx`
2. **Add route in main.wasp:**
   ```wasp
   route NewPageRoute { path: "/new-page", to: NewPage }
   page NewPage {
     authRequired: true,
     component: import { NewPage } from "@src/client/pages/NewPage"
   }
   ```
3. **Link in navigation:** Use `routes.NewPageRoute.to`

### Add a Database Model

1. **Update schema.prisma:**
   ```prisma
   model MyModel {
     id          String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     name        String
     workspaceId String  // Always add for scoped resources
     workspace   Workspace @relation(fields: [workspaceId], references: [id])
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   ```

2. **Run migration:** `cd wasp-app && wasp db migrate-dev --name "add MyModel"`

3. **Use in operations:** Add to `entities: [MyModel]` in main.wasp

## Testing

### Running Tests

```bash
npm test                          # All tests
npm test -- test/unit/FILE.ts     # Single file
npm test -- -t "pattern"          # Matching name
npm run test:watch                # Watch mode
npm run test:coverage             # Coverage (no gate)
npm run test:coverage:gate        # Staged gate check
npm run test:e2e                  # Playwright (requires backend running)
```

### Test Structure

- `test/unit/` — Isolated unit tests (no DB)
- `test/integration/` — Full workflow tests (with DB, mocked context)
- `test/e2e-wasp/` — Playwright end-to-end tests (requires running server + frontend)
- `test/mocks/` — Mock implementations (wasp-server.ts for Wasp internals)
- `test/fixtures/` — Test data fixtures

## Debugging & Troubleshooting

### Port Already in Use

```bash
lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9
# Then restart: ./run.sh
```

### TypeScript/IDE Errors After Changes

- **VSCode:** Restart TypeScript server (Cmd+Shift+P → "Restart TS server")
- **Main.wasp changes:** Wasp auto-recompiles, but may take 10-20 seconds; wait patiently
- **Persistent issues:** Run `cd wasp-app && wasp clean && wasp start`

### Build Fails with "Module Not Found"

```bash
cd wasp-app
wasp clean              # Clear build artifacts
wasp start              # Rebuild from scratch
```

### Tests Timeout

- Increase timeout: `jest.config.js` → `testTimeout: 30000` or higher
- Ensure backend is running: `./run.sh` in another terminal
- Check database is initialized: `cd wasp-app && wasp db push`

### Migration Issues

```bash
cd wasp-app
wasp db studio          # Visual Prisma editor to inspect schema
wasp db push            # Sync schema to DB (dev only, overwrites)
```

### "AuthIdentity table does not exist" on startup

```bash
cd wasp-app
wasp db migrate-dev --name "init" # Apply pending migrations
```

## References & Further Reading

- **API Operations:** [OPERATIONS.md](../OPERATIONS.md) — Complete reference for all 55+ operations
- **Developer Guide:** [CLAUDE.md](../CLAUDE.md) — Comprehensive development guide
- **Agent Collaboration:** [AGENTS.md](../AGENTS.md) — Multi-agent workflow guidance
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md) — PR process and guidelines
- **Wasp Docs:** https://wasp.sh/docs
- **Prisma ORM:** https://www.prisma.io/docs
- **React:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **TypeScript:** https://www.typescriptlang.org/docs

---

**Last Updated:** May 4, 2026 | **Wasp Version:** 0.23+ | **Node.js:** 24.14.1 LTS | **Status:** Production Ready
