# Copilot Instructions for VibeScan

This guide helps Copilot work effectively in the VibeScan repository. For human developers, see [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md).

## Project Overview

VibeScan is a full-stack SaaS vulnerability scanning platform built entirely on **Wasp** (v0.23+). It integrates Grype (free) and Codescoring/BlackDuck (enterprise) scanners with workspace-scoped data, GitHub App integration, webhooks, and tiered billing.

## Build & Test Commands

### Start Development Server (All-in-One)

```bash
./run.sh                    # Starts Docker + Wasp (recommended)
./run.sh --stop             # Stop all services
```

Alternative (requires Wasp CLI installed):
```bash
docker-compose up -d        # Start PostgreSQL, Redis, MinIO
cd wasp-app && PORT=3555 wasp start  # Start Wasp full-stack
```

**Ports:** Frontend 3000 | Backend API 3555 | PostgreSQL 5432 | Redis 6379 | MinIO 9000

### Testing

```bash
npm test                            # Run all unit + integration tests
npm test -- test/unit/FILENAME      # Single test file
npm test -- -t "pattern"            # Tests matching pattern
npm run test:watch                  # Watch mode (development)
npm run test:coverage               # Coverage report (no thresholds)
npm run test:coverage:gate          # Coverage with staged gate (lines >= 6, branches >= 3)
npm run test:coverage:strict        # Coverage with strict gate (lines >= 70, branches >= 70)
npm run test:e2e                    # Playwright E2E tests (requires running backend)
npm run test:wasp                   # Run Wasp client tests
```

### Linting & Type Checking

```bash
npm run lint                # Check for ESLint issues
npm run lint:fix            # Auto-fix ESLint issues
npx tsc --noEmit            # Full project TypeScript check
```

### Build

```bash
npm run build               # Production build (outputs .wasp/build/)
npm run openapi:contract    # Validate OpenAPI contract
```

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
wasp-app/                       # Primary Wasp full-stack application
├── main.wasp                   # Wasp DSL config (routes, auth, operations, jobs)
├── src/
│   ├── client/                 # React frontend (Vite)
│   │   ├── App.tsx
│   │   ├── components/         # Reusable UI (Sidebar, Dashboard, etc.)
│   │   └── hooks/              # Custom React hooks
│   ├── server/
│   │   ├── operations/         # Wasp operations (queries & actions)
│   │   │   ├── apikeys/        # API key management
│   │   │   ├── scans/          # Scan submission & retrieval
│   │   │   ├── reports/        # Report generation
│   │   │   ├── webhooks/       # Webhook management & delivery
│   │   │   ├── billing/        # Stripe integration
│   │   │   ├── dashboard/      # Dashboard metrics
│   │   │   ├── workspaces/     # Workspace switching
│   │   │   ├── onboarding/     # First-time user flow
│   │   │   ├── github/         # GitHub App integration
│   │   │   └── settings/       # User preferences
│   │   └── swagger/            # OpenAPI documentation
│   ├── auth/                   # Auth forms & email templates
│   └── shared/                 # Shared types & utilities
├── prisma/
│   ├── schema.prisma           # Database schema (13 tables)
│   └── migrations/             # Auto-generated migrations
├── .env.server                 # Server env vars (PORT=3555)
└── .env.local                  # Local overrides

test/
├── unit/                       # Unit tests (Jest)
├── integration/                # Integration tests (full workflows)
├── e2e/                        # E2E tests (Playwright)
└── helpers/                    # Test utilities

OPERATIONS.md                   # API reference for all operations
CLAUDE.md                       # Developer guide
AGENTS.md                       # Agent collaboration guide
```

## Key Architecture Patterns

### Wasp Operations (Queries & Actions)

All business logic runs through Wasp operations. They're declared in `main.wasp` and implemented in `src/server/operations/*/`.

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

### Workspace-Scoped Data

All resources (scans, webhooks, API keys) are scoped to a workspace. The `requireWorkspaceScopedUser()` helper enforces this:

```typescript
const user = await requireWorkspaceScopedUser(context.user);
// user now has activeWorkspaceId from the Workspace table
```

Always scope queries to `workspaceId`:
```typescript
const scans = await context.entities.Scan.findMany({
  where: { workspaceId: user.activeWorkspaceId }
});
```

### Error Handling

Use standard HTTP error codes with machine-readable error codes:

```typescript
throw new HttpError(401, 'unauthorized', { message: 'Not logged in' });
throw new HttpError(403, 'forbidden', { message: 'Access denied' });
throw new HttpError(404, 'not_found', { message: 'Scan not found' });
throw new HttpError(422, 'validation_error', {
  validation_errors: [
    { field: 'url', message: 'Invalid webhook URL' }
  ]
});
```

### Database & Migrations

Database schema is in `wasp-app/prisma/schema.prisma`. Always use Wasp for migrations:

```bash
cd wasp-app
wasp db migrate-dev --name "add webhook retry field"
```

**Never** run `prisma migrate` directly. Wasp manages auth tables automatically.

### Authentication

Wasp handles email/password auth automatically. All operations receive `context.user` (the authenticated user). Frontend accesses auth via:

```typescript
import { useAuth } from 'wasp/client/auth';

const { data: user, isLoading } = useAuth();
if (!user) return <Navigate to="/login" />;
```

## Code Conventions

### Operations Organization

Create one file per operation in its domain folder:

```
src/server/operations/scans/
├── getScan.ts           # Single operation per file
├── getScans.ts
└── submitScan.ts
```

Export a single function matching the operation name.

### Naming

- **Operations:** `camelCase` (getScan, submitScan, createWebhook)
- **Components:** `PascalCase` (DashboardPage, ApiKeysList, ScanCard)
- **Database models:** `PascalCase` (Scan, Finding, Webhook, Workspace)
- **Database fields:** `camelCase` (scanId, createdAt, webhookSecret)
- **Routes:** PascalCase with "Route" suffix (DashboardRoute, LoginRoute)

### Component Pattern

```typescript
// src/client/pages/DashboardPage.tsx
import { useAuth } from 'wasp/client/auth';
import { getDashboardMetrics } from 'wasp/client/operations';

export function DashboardPage() {
  const { data: user } = useAuth();
  const { data: metrics } = getDashboardMetrics();
  
  if (!user) return <Navigate to="/login" />;
  
  return (
    <div className="p-6">
      <h1>Welcome {user.email}</h1>
      {/* Component content */}
    </div>
  );
}
```

### Styling

Use **Tailwind CSS utility classes**. No CSS modules or styled-components in new code.

```typescript
<div className="flex gap-4 p-6 bg-white rounded-lg shadow">
  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Submit
  </button>
</div>
```

### Testing Patterns

**Unit Test:**
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
  it('should create a scan and enqueue job', async () => {
    const scan = await submitScan(
      { repositoryUrl: 'https://...' },
      { user: testUser, entities: mockEntities }
    );
    expect(scan.status).toBe('queued');
  });
});
```

## Important Invariants

1. **Port 3555:** Backend must always be on port 3555 (set in `.env.server`)
2. **Workspace scoping:** All resources verified against `user.activeWorkspaceId`
3. **Ownership checks:** Operations verify user owns/has access to resource
4. **Database authority:** PostgreSQL is source of truth; Redis is cache only
5. **Migrations:** Always use `wasp db migrate-dev` (never direct Prisma)
6. **API key hashing:** Bcrypt hashing, never store raw keys
7. **Webhook signing:** HMAC-SHA256 with user's API key secret
8. **Error responses:** Always use HttpError with standard codes
9. **Idempotency:** Use `Idempotency-Key` header for safe mutation retries

## Common Tasks

### Add a New Operation

1. **Create function** in `src/server/operations/domain/operationName.ts`:
   ```typescript
   export const myOperation = async (args, context: any) => {
     const user = await requireWorkspaceScopedUser(context.user);
     return await context.entities.MyModel.findMany({
       where: { workspaceId: user.activeWorkspaceId }
     });
   };
   ```

2. **Declare in main.wasp:**
   ```wasp
   query myOperation {
     fn: import { myOperation } from "@src/server/operations/domain/operationName",
     entities: [MyModel, User, Workspace]
   }
   ```

3. **Use from client:**
   ```typescript
   import { myOperation } from 'wasp/client/operations';
   const { data } = await myOperation({ /* args */ });
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
     id        String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     name      String
     workspaceId String
     workspace Workspace @relation(fields: [workspaceId], references: [id])
   }
   ```

2. **Run migration:** `wasp db migrate-dev --name "add MyModel"`

3. **Use in operations:** Add to `entities: [MyModel]` in main.wasp

## Debugging & Troubleshooting

### Port Already in Use

```bash
lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9
# Then restart: ./run.sh
```

### TypeScript Errors After Changes

Restart IDE's TypeScript server (Cmd+Shift+P → "Restart TS server")

### Build Fails

```bash
cd wasp-app
wasp clean          # Clear build artifacts
wasp start          # Rebuild from scratch
```

### Tests Timeout

Increase timeout in `jest.config.js` or `playwright.config.ts`, or ensure backend is running.

### Migration Issues

```bash
cd wasp-app
wasp db push          # Sync schema to DB
wasp db studio        # Visual schema editor
```

## References

- **All Operations:** See [OPERATIONS.md](../OPERATIONS.md)
- **Wasp Docs:** https://wasp.sh/docs
- **Prisma ORM:** https://www.prisma.io/docs
- **React:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com

---

**Last Updated:** May 2026 | **Wasp Version:** 0.23+ | **Node.js:** 24.14.1 LTS | **Status:** Production Ready
