# Copilot Instructions for VibeScan

## Build, test, and lint commands

### Backend (repo root)
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Lint autofix: `npm run lint:fix`
- Full test suite: `npm test`
- Coverage (report only): `npm run test:coverage`
- Coverage gate (staged): `npm run test:coverage:gate`
- Coverage gate (strict): `npm run test:coverage:strict`
- E2E API tests: `npm run test:e2e`
- Run one Jest file: `npm test -- test/unit/property-tests.test.ts`
- Run one Jest test by name: `npm test -- test/integration/integration-tests.test.ts -t "scan flow"`

### Frontend (`vibescan-ui/`)
- Install: `cd vibescan-ui && npm install`
- Dev server: `cd vibescan-ui && npm run dev`
- Build: `cd vibescan-ui && npm run build`
- Lint: `cd vibescan-ui && npm run lint`

## High-level architecture

VibeScan is a Fastify API + Next.js UI system that runs a dual-scanner pipeline per scan and returns full vulnerability detail in reports.

Core runtime flow:
1. API startup (`src/index.ts`) initializes migrations, Redis, S3 buckets, BullMQ queues, and workers, then exposes both legacy and `/v1/*` routes.
2. Scan submission (`src/services/scanOrchestrator.ts`) consumes user quota up front, creates `scans` row, then enqueues both free and enterprise jobs with plan-derived queue priority from `src/queues/config.ts`.
3. Workers process in parallel: free scanner (`src/workers/freeScannerWorker.ts`) and enterprise scanner (`src/workers/enterpriseScannerWorker.ts`) normalize findings into a shared vulnerability shape.
4. Orchestrator stores each scanner output in `scan_results`, computes delta via `diffEngine`, writes `scan_deltas`, and marks scan complete (including partial-complete behavior when one scanner fails).
5. Report layer (`src/services/reportService.ts`) enforces plan visibility rules (locked vs full) when returning JSON/summary/PDF/CI views.

State model:
- PostgreSQL is source of truth for users, scans, results, deltas, billing, webhook config/history.
- Redis is used for queueing, locks, sessions, and hot-path quota/cache behaviors.
- S3/MinIO stores uploaded artifacts (SBOM/source ZIP and derived assets).

## Key conventions in this codebase

- **Quota invariant:** consume quota when scan is submitted, not when it completes; refund quota on cancellation/failure paths handled by orchestrator logic.
- **Plan-tier queue priority:** `enterprise -> high`, `pro -> medium`, `starter/free_trial -> low`; priority is assigned when adding BullMQ jobs.
- **Visibility behavior:** all plans receive the vulnerabilities they scanned, plus delta counts and severity breakdowns.
- **Dual route surface:** many endpoints are available in both non-versioned and `/v1/*` forms; keep behavior consistent when changing handlers.
- **Raw-body requirement for Stripe webhook:** `src/index.ts` captures raw request body in `preParsing` for `/billing/webhook`; do not replace with parsed JSON flow.
- **Redis alias pitfall:** TypeScript alias `@redis/*` can conflict with the `redis` package; use explicit node module imports where needed in Redis-adjacent code.
- **ESM-first backend:** repo root uses `"type": "module"` and `tsx` in dev; preserve `.js` extension style in TS imports used across `src/`.
- **Queue ownership:** queue names/prefixes and worker wiring are centralized in `src/queues/config.ts`; add/adjust queues there rather than ad hoc worker setup.

## Backend implementation patterns (important for Copilot edits)

- **Auth context pattern:** handlers consistently resolve caller identity via `request.apiKey?.user_id || request.user?.userId` (see `scanHandlers.ts`, `reportHandlers.ts`); preserve this dual JWT/API-key behavior.
- **Error payload shape:** responses use stable error keys (`unauthorized`, `not_found`, `validation_error`, `quota_exceeded`, etc.) and often include `validation_errors` arrays for field-level issues.
- **Handler/service split:** handlers own HTTP validation/mapping; core business decisions live in services (`scanOrchestrator`, `reportService`, `quotaService`, `billingService`).
- **Ownership checks in SQL:** access control is frequently enforced in query predicates using direct user match OR org membership checks (`owner_user_id` / `ANY(members)`), not post-filtering in memory.
- **Input scenario normalization:** scan submissions map `sbom_upload`, `source_zip`, and `github_app` into normalized `scenarioInput` payloads before enqueueing; maintain this shape when adding new input sources.
- **List endpoint date filter compatibility:** list APIs accept both `fromDate` and `from_date`; keep both field names supported.
- **Scan list/dashboard SQL style:** API responses often rely on aggregate SQL (`COALESCE`, filtered counts, joins to `scan_deltas`) to avoid N+1 patterns.
