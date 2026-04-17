# CLAUDE.md — VibeScan Development Guide

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. For agent collaboration guidance, see [AGENTS.md](AGENTS.md).

## Project Overview

VibeScan is a SaaS vulnerability scanning platform with dual-scanner architecture (Grype free + Codescoring/BlackDuck enterprise). Currently migrating to Wasp OpenSaaS framework while maintaining Node.js 24 compatibility.

## Current Architecture Status (April 2026)

### Active Frameworks
- **Primary**: Wasp v0.23+ (full-stack, batteries-included)
- **Legacy**: Next.js frontend (deprecated, moved to backup/)
- **Backend**: Node.js 24 LTS with Fastify (legacy root backend)

### Key Decision
The project is transitioning to **Wasp-only** architecture. Legacy Next.js UI components have been moved to `backup/` folder (not in git).

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
- **Components**: React with TypeScript
- **UI Library**: Shadcn/ui components

### Infrastructure
- **Containerization**: Docker (source isolation for scans)
- **Orchestration**: Kubernetes (production)
- **Monitoring**: Prometheus metrics

## Project Structure

```
/home/virus/vibescan/
├── wasp-app/                    # Primary Wasp application
│   ├── main.wasp               # Wasp configuration (auth, routes, pages)
│   ├── src/
│   │   ├── client/              # Frontend (React + Vite)
│   │   │   ├── App.tsx          # Root component with Sidebar
│   │   │   ├── components/      # Reusable React components
│   │   │   │   └── Sidebar/    # New sidebar navigation
│   │   │   └── ...
│   │   ├── dashboard/           # Dashboard pages
│   │   │   └── DashboardPage.tsx    # Main dashboard (redesigned)
│   │   ├── auth/                # Auth logic (email/password forms)
│   │   └── server/              # Backend logic (operations, queries)
│   ├── .env.server             # Server env (includes PORT=3555)
│   ├── .env.local              # Local overrides
│   ├── prisma/                 # Prisma schema and migrations
│   └── migrations/             # Wasp-specific migrations
│
├── src/                         # Legacy backend (Fastify)
│   ├── index.ts                # Main server entry
│   ├── handlers/               # HTTP handlers
│   ├── services/               # Business logic
│   ├── workers/                # Async job processors
│   └── database/               # PostgreSQL client
│
├── test/                        # Test suite
│   ├── e2e/
│   │   └── dashboard-layout.spec.ts    # E2E dashboard test
│   ├── integration/
│   ├── unit/
│   └── helpers/
│
├── backup/                      # Legacy components (not in git)
│   └── wasp-app/src/           # Old Next.js UI, legacy hooks
│
├── CLAUDE.md                    # This file
├── AGENTS.md                    # Agent collaboration guide
└── .gitignore                   # Excludes backup/, node_modules/, etc.
```

## Key Implementation Details

### Wasp Architecture

**Authentication** (built-in):
- Email/password auth via `wasp/client/auth` and `wasp/server/auth`
- Auth tables: `User`, `Auth`, `AuthIdentity`, `Session` (auto-managed by Wasp)
- Routes: `/login`, `/signup`, `/email-verification`, `/password-reset`

**Database** (Prisma):
- Schema defined in `wasp-app/prisma/schema.prisma`
- Migrations in `wasp-app/prisma/migrations/`
- Wasp manages auth schema; custom models extend it

**Routes & Pages**:
- Defined in `main.wasp` (wasp DSL)
- Pages are React components in `src/client/` or `src/dashboard/`
- Protected routes use `authRequired: true` in main.wasp

**Operations** (RPC):
- Queries: `query getName { ... }` in main.wasp → client calls `getName()` via `wasp/client/operations`
- Actions: `action doThing { ... }` in main.wasp → server-side mutation

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

### Development

```bash
# Start Wasp (everything: frontend + backend + DB)
cd wasp-app
PORT=3555 wasp start

# Or run separately for debugging
PORT=3555 npm --prefix .wasp/out/server run start      # Backend only
npm --prefix .wasp/out/client run dev                  # Frontend only

# Run tests
npm test
npx playwright test test/e2e/dashboard-layout.spec.ts
```

### Production

```bash
# Build
wasp build

# Run built app
cd .wasp/build/server
npm run start-production
```

### Database

```bash
cd wasp-app
wasp db migrate-dev      # Apply pending migrations
wasp db studio           # Open Prisma Studio GUI
```

## TypeScript & Imports

- **ESM modules**: Project uses `"type": "module"` in package.json
- **Path aliases**: Configured in `wasp-app/tsconfig.json` but not commonly used in Wasp
- **Imports**: Use relative paths or npm packages; Wasp handles `wasp/` prefixed imports

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

## Important Invariants

1. **Port 3555**: Backend hardcoded to this port (`.env.server`)
2. **API URL**: Frontend must know about port 3555 (`.env.local`)
3. **Auth Tables**: Wasp auto-creates; don't manually alter schema
4. **ESM Imports**: All files use `.js` extensions in imports despite being `.ts`
5. **Prisma Migrations**: Always use `wasp db migrate-dev` (not `prisma migrate`)

## Troubleshooting

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure backend is running on PORT 3555
- Verify no port conflicts: `lsof -i :3000 :3555`

### "AuthIdentity table does not exist"
- Run: `cd wasp-app && wasp db migrate-dev`

### TypeScript errors in generated code
- Run: `cd wasp-app && wasp clean && wasp start`

### Port 3555 already in use
- Kill process: `lsof -i :3555 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- Or use different port: `PORT=3556 wasp start`

## Project Phases (Complete ✅)

| Phase | Status | Focus |
|-------|--------|-------|
| 1-9 | ✅ | All core phases complete |
| Wasp Migration | 🔄 | Frontend → Wasp (in progress) |
| Node.js 24 | ✅ | Compatible and tested |

## Current Focus Areas

1. **Dashboard**: Sidebar layout implemented, stats cards added
2. **Auth**: Email/password working, table migrations applied
3. **Configuration**: PORT 3555, API URLs properly set
4. **Documentation**: Updated for Wasp-first approach

## Resources

- **Wasp Docs**: https://wasp.sh/docs
- **Wasp GitHub**: https://github.com/wasp-lang/wasp
- **Prisma ORM**: https://www.prisma.io/docs
- **Tailwind CSS**: https://tailwindcss.com
- **React Docs**: https://react.dev

## Next Steps for Developers

1. Familiarize with Wasp DSL (main.wasp syntax)
2. Understand Wasp's auth system (users, sessions)
3. Practice adding new pages and operations
4. Review dashboard components for styling patterns
5. Check E2E test for registration flow validation

---

**Last Updated**: April 17, 2026
**Wasp Version**: 0.23+
**Node.js**: 24.14.1 LTS
**Status**: Stable on Wasp migration path
