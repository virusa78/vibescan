# CLAUDE.md — VibeScan Development Guide

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. For agent collaboration guidance, see [AGENTS.md](AGENTS.md).

## Project Overview

VibeScan is a SaaS vulnerability scanning platform with dual-scanner architecture (Grype free + Codescoring/BlackDuck enterprise). **Complete Wasp-only architecture**—all legacy code removed. Full-stack TypeScript with 20 Wasp operations.

## Current Architecture Status (April 2026)

### ✅ Completed Migration
- **Primary**: Wasp v0.23+ (full-stack, batteries-included)
- **All Phases**: Complete (1-9) + Wasp migration done
- **Legacy Code**: Completely removed from git (backup/ excluded)
- **Architecture**: Wasp-only with 20 operations

### Service Configuration
- **Frontend**: http://localhost:3000 (Vite via Wasp)
- **Backend**: http://localhost:3555 (Wasp + Node.js)
- **Database**: PostgreSQL on localhost:5432
- **Cache**: Redis on localhost:6379
- **Storage**: MinIO (S3-compatible) on localhost:9000

## Tech Stack

### Backend
- **Framework**: Wasp 0.23+ (full-stack TypeScript)
- **Runtime**: Node.js 24.14.1 LTS with ES modules
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis v4
- **Task Queue**: BullMQ
- **Storage**: S3 (AWS or MinIO)

### Frontend
- **Framework**: Wasp (wraps React + Vite)
- **Styling**: Tailwind CSS
- **Components**: React with TypeScript + Shadcn/ui
- **Data Fetching**: Wasp operations (automatic RPC)

### Infrastructure
- **Containerization**: Docker (source isolation for scans)
- **Orchestration**: Kubernetes (production)
- **Monitoring**: Prometheus metrics
- **Deployment**: Railway / Fly.io (via Wasp CLI)

## Project Structure

```
/home/virus/vibescan/
├── wasp-app/                    # Primary Wasp full-stack application
│   ├── main.wasp               # Wasp DSL config (20 operations, auth, routes)
│   ├── src/
│   │   ├── client/              # Frontend React components
│   │   │   ├── App.tsx          # Root component with auth check
│   │   │   ├── components/      # Reusable UI components (Sidebar, etc.)
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   └── utils/           # Client utilities
│   │   ├── dashboard/           # Dashboard pages (DashboardPage.tsx)
│   │   ├── apiKeys/             # API keys management (page + operations)
│   │   ├── auth/                # Auth forms and email templates
│   │   ├── server/              # Backend operations
│   │   │   ├── operations/      # 20 Wasp operations grouped by domain
│   │   │   │   ├── apikeys/
│   │   │   │   ├── scans/
│   │   │   │   ├── reports/
│   │   │   │   ├── webhooks/
│   │   │   │   ├── billing/
│   │   │   │   └── dashboard/
│   │   │   ├── swagger/         # OpenAPI/Swagger docs
│   │   │   ├── actions/         # Server-only utility functions
│   │   │   └── scripts/         # DB seeds, migrations
│   │   ├── payment/             # Stripe integration
│   │   ├── shared/              # Shared types and utils
│   │   └── env.ts              # Environment validation (Zod)
│   ├── prisma/                  # Database schema
│   │   ├── schema.prisma        # Prisma schema (13 tables)
│   │   └── migrations/          # Auto-generated Prisma migrations
│   ├── .env.server             # Server env vars (PORT=3555)
│   ├── .env.local              # Local overrides
│   ├── tsconfig.json           # TypeScript config
│   └── .wasp/                   # Generated (build artifacts)
│
├── test/                        # Test suite (Jest + Playwright)
│   ├── e2e/                    # End-to-end tests (Playwright)
│   │   └── dashboard-layout.spec.ts
│   ├── integration/            # Integration tests (full flows)
│   ├── unit/                   # Unit tests (components, utils)
│   └── helpers/                # Test utilities (db, auth, etc.)
│
├── deploy/                      # Deployment configs
│   └── kubernetes/             # K8s manifests
│
├── scripts/                     # Utility scripts
├── docs/                        # Documentation files
│
├── CLAUDE.md                    # This file (developer guide)
├── AGENTS.md                    # Agent collaboration guide
├── OPERATIONS.md               # API operations reference (NEW)
├── README.md                   # Project overview
├── CONTRIBUTING.md            # Contribution guidelines
├── STARTUP.md                  # Local dev setup
├── PRODUCTION_CHECKLIST.md    # Pre-deployment checklist (NEW)
└── package.json                # Root package.json (shared deps)

## Key Implementation Details

### Wasp Architecture

**Authentication** (built-in):
- Email/password auth via `wasp/client/auth` and `wasp/server/auth`
- Auth tables: `User`, `Auth`, `AuthIdentity`, `Session` (auto-managed)
- Routes: `/login`, `/signup`, `/email-verification`, `/password-reset`
- JWT access tokens (15 min) + refresh tokens (30 days)

**Database** (Prisma):
- Schema in `wasp-app/prisma/schema.prisma` (13 tables)
- Tables: User, Scan, Finding, Webhook, ApiKey, ScanResult, etc.
- Migrations auto-generated, no manual SQL
- Relationships enforce ownership (userId, organizationId)

**Operations** (20 total - see OPERATIONS.md):
- **User Management** (3): getPaginatedUsers, updateIsUserAdminById, updateUserSettings
- **API Keys** (3): generateApiKey, listApiKeys, revokeApiKey
- **Scans** (3): getScans, getScanById, submitScan
- **Reports** (4): getReport, getReportSummary, generateReportPDF, getCIDecision
- **Webhooks** (5): createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook
- **Billing** (2): getCustomerPortalUrl, generateCheckoutSession

**Routes & Pages**:
- All defined in `main.wasp` (Wasp DSL)
- Pages are React components (`authRequired: true` for protected)
- Automatic routing via Wasp router (routes.PageRoute.to)

**Operations Pattern**:
- Queries: Read-only, cached, called directly from client
- Actions: Mutations with side effects, transaction support
- Context injection: `context.user` contains authenticated user
- Error handling: Standardized error codes (401, 403, 404, 422, 429, 402)

### Dashboard Components

**Sidebar** (`src/client/components/Sidebar/Sidebar.tsx`):
- Left-side navigation menu
- Shows when user is authenticated
- Links to Dashboard, Scans, Settings, Pricing
- Responsive and matches design reference

**Dashboard Page** (`src/dashboard/DashboardPage.tsx`):
- Stats grid (4 cards: Total Scans, Vulnerabilities, Delta, Active)
- Charts section (placeholder for recharts)
- Quota progress bar
- Recent scans table
- Professional styling with Tailwind

### Port Configuration

**Backend Port**:
- Configured in `.env.server`: `PORT=3555`
- Wasp server reads this and listens on specified port
- Critical: Avoids port conflict with legacy root backend

**Frontend API URL**:
- Configured in `.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:3555`
- Frontend automatically routes all API calls to this URL
- Set before Wasp dev server starts

## Build & Run Commands

### Development (Recommended)

```bash
# Start full-stack Wasp (frontend + backend + DB)
cd wasp-app
PORT=3555 wasp start

# In separate terminal: run tests
cd /home/virus/vibescan
npm test

# Or run Playwright E2E tests
npx playwright test test/e2e/
npx playwright show-report

# Database management
cd wasp-app
wasp db migrate-dev      # Apply pending migrations
wasp db studio           # Prisma visual editor
wasp db push             # Sync schema to DB (dev)
```

### Production

```bash
# Build production bundle
cd wasp-app
wasp build

# Build output in: .wasp/build/
# Server: .wasp/build/server/ (Node.js app)
# Client: .wasp/build/client/ (static files)

# Deploy to Railway
wasp deploy railway --build

# Deploy to Fly.io
wasp deploy fly --build
```

### Linting & Type Checking

```bash
# Lint wasp-app
cd /home/virus/vibescan
npm run lint               # ESLint check

# TypeScript
npx tsc --noEmit         # Type check (no emit)

# Run all tests
npm test                  # Unit + integration
```

## Testing

### Unit Tests (Jest)
```bash
npm test                                    # All tests
npm test -- test/unit/                     # Unit only
npm test -- test/unit/property-tests.test.ts -t "test name"
```

### Integration Tests (Jest)
```bash
npm test -- test/integration/
```

### E2E Tests (Playwright)
```bash
npx playwright test test/e2e/
npx playwright test test/e2e/ --headed     # With UI
npx playwright show-report
```

### Coverage
```bash
npm run test:coverage      # Generate coverage report
npm run test:coverage:gate # Check baseline gate
```

## Code Quality

### Linting
```bash
npm run lint              # Check for issues
npm run lint:fix          # Auto-fix issues
```

### Type Checking
```bash
npx tsc --noEmit         # Full project type check
```

### Security Audit
```bash
npm audit                # Check dependencies
npm audit fix            # Auto-fix vulnerabilities
```

## Database Schema (13 Tables)

### Core Tables

**User** (Wasp managed)
- `id`: String (UUID)
- `email`: String (unique)
- `username`: String
- `password`: String (hashed via Wasp)
- `isAdmin`: Boolean
- `region`: String ('IN' | 'PK' | 'OTHER')
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Scan**
- `id`: String (UUID)
- `userId`: String (FK → User)
- `status`: String ('queued' | 'running' | 'completed' | 'failed')
- `scanType`: String ('github_app' | 'sbom_upload' | 'source_zip')
- `findingsCount`: Int
- `deltaCount`: Int
- `error`: String (nullable)
- `createdAt`: DateTime
- `completedAt`: DateTime (nullable)

**Finding**
- `id`: String (UUID)
- `scanId`: String (FK → Scan)
- `cveId`: String
- `severity`: String ('critical' | 'high' | 'medium' | 'low' | 'info')
- `package`: String
- `version`: String
- `fixedVersion`: String (nullable)
- `description`: String
- `cvssScore`: Float
- `source`: String ('free' | 'enterprise')

**ScanResult**
- `id`: String (UUID)
- `scanId`: String (FK → Scan)
- `scanner`: String ('grype' | 'codescoring')
- `rawOutput`: JSON
- `createdAt`: DateTime

**ScanDelta**
- `id`: String (UUID)
- `scanId`: String (FK → Scan)
- `enterpriseOnly`: Int
- `freeOnly`: Int
- `common`: Int

**ApiKey**
- `id`: String (UUID)
- `userId`: String (FK → User)
- `keyHash`: String (bcrypt)
- `name`: String
- `lastUsedAt`: DateTime (nullable)
- `expiresAt`: DateTime (nullable)
- `createdAt`: DateTime

**Webhook**
- `id`: String (UUID)
- `userId`: String (FK → User)
- `url`: String
- `events`: String[] (JSON array)
- `secret`: String (for HMAC signing)
- `active`: Boolean
- `createdAt`: DateTime

**WebhookDelivery**
- `id`: String (UUID)
- `webhookId`: String (FK → Webhook)
- `event`: String
- `statusCode`: Int
- `attempt`: Int
- `nextRetry`: DateTime (nullable)
- `createdAt`: DateTime

### Additional Tables

**Auth, AuthIdentity, Session** (Wasp managed)
- Auto-created by Wasp for auth system

**FindingHistory**
- Track finding changes over time

**StripeCustomer**
- Store encrypted Stripe customer IDs

**Organization** (optional for multi-tenant)
- Enterprise organization support

## Code Patterns (Wasp-Specific)

### Protected Pages

```typescript
// In main.wasp:
page DashboardPage {
  authRequired: true,
  component: import { DashboardPage } from "@src/dashboard/DashboardPage"
}

// In component:
import { useAuth } from 'wasp/client/auth'
export function DashboardPage() {
  const { data: user } = useAuth()  // Access authenticated user
  return <div>Welcome {user?.email}</div>
}
```

### Operations (Queries & Actions)

```typescript
// In main.wasp:
query getScan {
  fn: import { getScan } from "@src/server/operations",
  entities: [Scan]
}

// In client:
import { getScan } from 'wasp/client/operations'
const { data: scan } = await getScan({ id: scanId })

// In server (src/server/operations.ts):
export const getScan = (args, context) => {
  // context.user is authenticated user (Wasp injects it)
  return db.scan.findUnique({ where: { id: args.id } })
}
```

### Auth Context

```typescript
import { useAuth } from 'wasp/client/auth'

export function MyComponent() {
  const { data: user, isLoading } = useAuth()
  
  if (!user) return <div>Not logged in</div>
  return <div>Logged in as {user.email}</div>
}
```

## Common Tasks

### Add a New Page

1. Create React component in `src/client/` or `src/dashboard/`
2. Add route in `main.wasp`:
   ```wasp
   route NewPageRoute { path: "/new-page", to: NewPage }
   page NewPage {
     component: import { NewPage } from "@src/client/NewPage"
   }
   ```
3. Access via `routes.NewPageRoute.to` in links

### Add a Database Model

1. Update `prisma/schema.prisma`:
   ```prisma
   model MyModel {
     id    String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     name  String
     ...
   }
   ```
2. Run migration: `wasp db migrate-dev`
3. Use in operations with `entities: [MyModel]`

### Add an Operation

1. Create function in `src/server/operations.ts`:
   ```typescript
   export const myQuery = (args, context) => {
     // context.user, context.entities
     return result
   }
   ```
2. Declare in `main.wasp`:
   ```wasp
   query myQuery {
     fn: import { myQuery } from "@src/server/operations",
     entities: [MyModel]
   }
   ```
3. Call from client: `import { myQuery } from 'wasp/client/operations'`

## Testing

### Unit Tests
```bash
npm test -- test/unit/property-tests.test.ts
```

### Integration Tests
```bash
npm test -- test/integration/integration-tests.test.ts
```

### E2E Tests (Playwright)
```bash
npx playwright test test/e2e/dashboard-layout.spec.ts
npx playwright show-report
```

## Deployment

### To Railway or Fly.io
```bash
wasp deploy railway  # or 'fly'
```

### Manual K8s Deployment
```bash
kubectl apply -f deploy/kubernetes/
```

## Important Invariants (MUST Preserve)

1. **Port 3555**: Backend ALWAYS on port 3555 (configured in `.env.server`)
2. **Operations Pattern**: All business logic in `wasp-app/src/server/operations/`
3. **Ownership Verification**: Every query/action checks `context.user.id` owns the resource
4. **Error Codes**: Use standardized codes (401, 403, 404, 422, 429, 402)
5. **Database Source of Truth**: PostgreSQL is authoritative (Redis is cache only)
6. **Migrations**: Always use `wasp db migrate-dev` (never `prisma migrate` directly)
7. **API Key Security**: Bcrypt hashing, never store raw keys in DB
8. **Webhook Signing**: HMAC-SHA256 with user's API key secret
9. **Quota Invariant**: Decrement when scan submitted, refund only on cancellation/failure
10. **Plan Visibility**: Starter plan gets delta counts only (no enterprise details)
11. **Source Isolation**: Scans run in Docker with `--network=none`, `--read-only`, `--user=nobody`
12. **Idempotency**: Use `Idempotency-Key` header for safe retries on mutations

## Code Patterns (Best Practices)

### Protected Pages

```typescript
// In main.wasp:
page DashboardPage {
  authRequired: true,
  component: import { DashboardPage } from "@src/dashboard/DashboardPage"
}

// In component:
import { useAuth } from 'wasp/client/auth'
export function DashboardPage() {
  const { data: user, isLoading } = useAuth()
  if (isLoading) return <Loading />
  if (!user) return <Navigate to="/login" />
  return <div>Welcome {user.email}</div>
}
```

### Operations with Ownership Check

```typescript
// Server operation (src/server/operations/scans/index.ts):
export const getScan = async (args: { scanId: string }, context: any) => {
  // Ownership check is CRITICAL
  const scan = await context.entities.Scan.findUnique({
    where: { id: args.scanId }
  })
  
  if (!scan) throw new HttpError(404, 'Scan not found')
  if (scan.userId !== context.user.id) {
    throw new HttpError(403, 'Unauthorized')
  }
  
  return scan
}

// Client usage:
const { data: scan } = await getScan({ scanId: 'scan-123' })
```

### Error Handling

```typescript
// Always use consistent error format
throw new HttpError(
  422,  // Status code
  'validation_error',  // Error code (machine-readable)
  {     // Details object
    message: 'Invalid input',
    validation_errors: [
      { field: 'email', message: 'Invalid email format' }
    ]
  }
)
```

### Webhook Verification

```typescript
// Verify HMAC signature on incoming webhooks
import crypto from 'crypto'

const signature = request.headers['x-vibescan-signature']
const [algo, digest] = signature.split('=')
const computed = crypto
  .createHmac(algo, WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')

if (computed !== digest) {
  throw new HttpError(401, 'unauthorized')
}
```

## Troubleshooting Common Issues

### Build Issues

**"Your wasp project failed to compile"**
- Check `main.wasp` syntax (must be valid DSL)
- Verify all imports exist
- Run: `cd wasp-app && wasp clean && wasp start`

**"Module not found" in server code**
- Verify file paths are correct
- Use relative imports from `@src/...`
- Check that operation files export correct function names

### Runtime Issues

**"Port 3555 already in use"**
```bash
lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9
# Or use different port:
PORT=3556 wasp start
```

**"Cannot connect to database"**
```bash
# Ensure PostgreSQL is running
# Check connection string in `.env.server`
# Run migrations:
cd wasp-app
wasp db migrate-dev
```

**"AuthIdentity table does not exist"**
```bash
cd wasp-app
wasp db migrate-dev  # Apply pending migrations
```

**Frontend can't connect to backend**
- Check PORT=3555 is set in `.env.server`
- Verify `NEXT_PUBLIC_API_URL` points to backend
- Ensure both processes are running

### Testing Issues

**"Cannot find module '@services/...'"**
- Tests reference old legacy code structure
- Update test imports to match new structure
- Or update `jest.config.js` moduleNameMapper

**Playwright tests timing out**
- Increase timeout in `playwright.config.ts`
- Check backend is running and responsive
- Verify database is seeded with test data

## Security Best Practices

1. **API Keys**: Never log or expose raw keys
2. **Secrets**: Keep `ENCRYPTION_KEY` and `JWT_SECRET` in `.env` (never git)
3. **CORS**: Configure CORS to only allow frontend origin
4. **SQL Injection**: Always use Prisma (ORM prevents SQL injection)
5. **Authentication**: All protected endpoints check `context.user`
6. **Webhooks**: Always verify HMAC signature before processing
7. **Rate Limiting**: Implement per-user request limits
8. **HTTPS**: Use HTTPS in production (enforced by Wasp in build)

## Performance Optimization

1. **Caching**: Use Redis for high-frequency queries (quota, session state)
2. **Pagination**: Always paginate list operations (default 20 items)
3. **Indexes**: Add DB indexes on frequently queried fields (userId, scanId)
4. **Lazy Loading**: Load report details only when requested
5. **Background Jobs**: Offload long tasks to BullMQ workers (PDF generation)
6. **Connection Pooling**: Prisma handles DB connection pooling automatically

## Documentation & References

- **Operations Reference**: See [OPERATIONS.md](OPERATIONS.md) for all 20 operations
- **Wasp Docs**: https://wasp.sh/docs
- **Prisma ORM**: https://www.prisma.io/docs
- **React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **TypeScript**: https://www.typescriptlang.org/docs

## Project Phases & Status

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Infrastructure (Docker, DB, Redis) | ✅ Complete |
| 2 | Auth & API Gateway | ✅ Complete |
| 3 | Scan Orchestration & Queuing | ✅ Complete |
| 4 | Worker Pipeline (Grype + Codescoring) | ✅ Complete |
| 5 | Delta & Reporting | ✅ Complete |
| 6 | Webhooks & GitHub Integration | ✅ Complete |
| 7 | Billing & Regional Pricing | ✅ Complete |
| 8 | Testing & Security Audit | ✅ Complete |
| 9 | Monitoring & K8s Deployment | ✅ Complete |
| Wasp Migration | Full-stack Wasp framework | ✅ Complete |
| Documentation | Updated for Wasp-only | ✅ Complete |

## Environment Variables

### Server (`.env.server`)
```
PORT=3555
DATABASE_URL=postgresql://user:password@localhost:5432/vibescan
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=32-character-key-for-encryption
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
CODESCORING_API_KEY=your-key
```

### Client (`.env.local`)
```
VITE_API_URL=http://localhost:3555
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Contributing Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Git workflow and branch naming
- Commit message format (Conventional Commits)
- Pull request process
- Code review expectations
- Testing requirements

## Deployment

### Local Development
1. `cd wasp-app && PORT=3555 wasp start`
2. Frontend: http://localhost:3000
3. Backend: http://localhost:3555
4. API Docs: http://localhost:3555/docs

### Production (Railway)
```bash
cd wasp-app
wasp deploy railway
```

### Production (Fly.io)
```bash
cd wasp-app
wasp deploy fly
```

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for full deployment guide.

---

**Last Updated**: April 17, 2026  
**Wasp Version**: 0.23+  
**Node.js**: 24.14.1 LTS  
**Architecture**: Wasp-only (all legacy code removed)  
**Status**: ✅ Production Ready
