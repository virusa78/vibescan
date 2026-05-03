# VibeScan Active Plan

## Purpose
Этот документ является текущим source of truth по активному product stage. Он регенерирован после большого объёма workspace/onboarding/GitHub работ, чтобы убрать смешение с историческими M5/M6 и более старыми фазами.

## Active Scope
- Workspace foundation
- Workspace-scoped auth and data access
- Onboarding and first-scan UX
- GitHub App backend core
- GitHub settings UI and check-run lifecycle
- Hardening, tests, docs, and OpenAPI alignment

## Source Of Truth
- Активное приложение: `wasp-app/`
- Основная схема: `wasp-app/prisma/schema.prisma`
- Активный execution focus: `PR 6`

## Current Snapshot
- Stage status: `repo work complete`
- [x] workspace foundation broadly implemented
- [x] workspace-aware auth/data access broadly implemented
- [x] onboarding and first-scan UX broadly implemented
- [x] GitHub App backend core broadly implemented
- [x] GitHub settings UI and check-run lifecycle broadly implemented
- [x] workspace switcher and explicit workspace context surface implemented
- [x] polished GitHub App install/connect journey for in-app setup
- [x] final OpenAPI/docs/test hardening for the code PR
- [ ] real end-to-end verification on migrated workspace data and live GitHub App
- [x] consolidated follow-up code PR completed

## PR Checklist
- [x] PR 1: Workspace Foundation
- [x] PR 2: Workspace-Scoped Auth And Data Access
- [x] PR 3: Onboarding And First-Scan UX
- [x] PR 4: GitHub App Backend Core
- [x] PR 5: GitHub Settings UI And Checks
- [x] PR 6: Hardening, Tests, Docs, OpenAPI
- [x] Follow-up PR: Validation, Test Depth, and GitHub UX Polish

## What Exists In Code Now

### Workspace Foundation
- `Organization`, `Team`, `Workspace`, membership model added
- `workspaceId` added to key scoped entities
- `User.activeWorkspaceId` added
- lazy bootstrap for personal workspace exists
- seed/bootstrap path exists
- profile/account surface exposes active workspace context

### Workspace-Scoped Auth And Data Access
- request auth resolves workspace-scoped users
- API key auth resolves `{ id, workspaceId }`
- new scans persist `workspaceId`
- key scans/dashboard/reports/API keys/webhooks use workspace-aware predicates
- legacy fallback exists for old rows without `workspaceId`

### Onboarding And First-Scan UX
- `/onboarding` route exists
- onboarding state query/action exists
- app-shell redirect logic exists
- dashboard empty-state is context-aware
- `NewScanPage` is guided and redirects to scan details after submit

### GitHub App Backend Core
- GitHub App env schema exists
- app JWT and installation token flow exist
- `/github/webhook` exists
- installation lifecycle sync/delete exists
- installation -> workspace mapping action exists
- GitHub-originated scans on `push` and `pull_request` exist
- `github_context` is persisted on scans
- private repo clone attempts can use installation token

### GitHub Settings UI And Checks
- settings page has GitHub integration section
- linked installations can be listed
- repos can be enabled/disabled
- push/PR triggers, target branches, severity threshold can be edited
- queued/in-progress/completed/failure check-run updates are wired
- GitHub checks link back to `/scans/:scanId`

## PR Status

### PR 1: Workspace Foundation
- Status: `code complete, verify pending`
- [x] schema foundation
- [x] migration artifacts
- [x] bootstrap service
- [x] seed support
- [x] profile/account workspace projection
- [ ] run migration/backfill on a real dev database
- [ ] validate integrity of migrated legacy data
- [ ] add regression coverage for bootstrap/profile workspace context

### PR 2: Workspace-Scoped Auth And Data Access
- Status: `code complete, verify pending`
- [x] workspace access helpers
- [x] workspace-aware auth resolution
- [x] key scans/dashboard/reports/API keys/webhooks rewired
- [x] explicit workspace context query/action surface
- [ ] audit remaining user-only endpoints/handlers
- [ ] settings migration to workspace-aware assumptions where needed
- [ ] authorization regression coverage
- [ ] policy for removing legacy fallback later

### PR 3: Onboarding And First-Scan UX
- Status: `code complete, hardening pending`
- [x] onboarding route/state/action
- [x] redirect logic
- [x] dashboard contextual empty-state
- [x] guided `NewScanPage`
- [ ] clarify “skip” vs “complete” persistence semantics
- [ ] add regression coverage for redirect and first-scan flow
- [ ] revisit copy once workspace switcher and richer GitHub install UX exist

### PR 4: GitHub App Backend Core
- Status: `code complete, real-world validation pending`
- [x] env/client/token/webhook primitives
- [x] installation sync/delete
- [x] workspace mapping
- [x] repo sync
- [x] GitHub-originated scan enqueue
- [x] persisted GitHub scan context
- [ ] verify raw-body preservation for webhook signature in deployed HTTP stack
- [ ] validate private repo clone path end-to-end
- [ ] improve installation setup/callback UX
- [ ] strengthen webhook idempotency and ordering coverage
- [ ] decide final fork PR policy

### PR 5: GitHub Settings UI And Checks
- Status: `code complete, hardening pending`
- [x] GitHub integration settings section
- [x] installation linking by installation id
- [x] repo enable/disable controls
- [x] push/PR/branch/severity controls
- [x] backend action for installation settings persistence
- [x] queued -> in-progress -> completed/failure GitHub checks
- [ ] better install/connect UX than manual installation id entry
- [ ] validate check-run lifecycle against real GitHub App
- [ ] decide richer conclusion policy for partial multi-scanner outcomes
- [ ] add automated tests around settings save flows and check updates

### PR 6: Hardening, Tests, Docs, OpenAPI
- Status: `closed`
- [x] `plan.md` regenerated to match actual repo state
- [x] added unit coverage for GitHub webhook signature verification
- [x] added unit coverage for GitHub check-run lifecycle service
- [x] added explicit workspace context / switch surface
- [x] added workspace/onboarding/GitHub `/api/v1/*` routes for real existing capabilities
- [x] extended docs (`README`, `ARCHITECTURE.md`, `OPERATIONS.md`) toward the current product model
- [x] fixed root test/OpenAPI toolchain blockers needed for verification
- [x] ran targeted unit verification for new workspace/GitHub hardening surfaces
- [x] ran OpenAPI contract verification successfully
- [x] ran lint successfully
- [x] added repeatable verification command for this stage

#### Verification Command
- `npm run verify:workspace-github-stage`

#### Local Verification Status
- [x] targeted local regression coverage added for workspace/onboarding/GitHub critical paths
- [x] OpenAPI contract verified
- [x] lint verified
- [x] repeatable stage verify command verified

## One Follow-Up PR
Название пакета:
- `Follow-up PR: Validation, Test Depth, and GitHub UX Polish`

Что входит в этот единый PR:
- [ ] verify migration/backfill на реальной dev database
- [ ] verify live GitHub App flow:
  - install app
  - link installation
  - private repo scan
  - `push` webhook
  - `pull_request` webhook
  - GitHub Check Run updates
- [ ] verify raw-body signature path для `/github/webhook` в реальном runtime
- [x] add integration-safe unit coverage for repo/branch/fork filtering rules
- [x] add regression-safe unit coverage for GitHub setup/install URL generation
- [x] add regression coverage for workspace switching
- [x] replace manual-only `installationId` connect flow with cleaner GitHub setup UX
- [x] document live validation runbook and migration verification steps

Definition of done для этого follow-up PR:
- [ ] real dev DB migration/backfill verified
- [ ] live GitHub App flow verified
- [x] highest-risk local regression coverage added for workspace/GitHub setup/filtering paths
- [x] GitHub connect UX no longer depends on manual-only `installationId`
- [x] docs/runbook updated to reflect the final operating model

## External Runtime Validation
These items are outside what can be fully completed in the current sandboxed repo-only environment.

- [ ] real dev DB migration/backfill validation
- [ ] live GitHub App install/private-repo/check-run validation
- [ ] raw-body signature verification in real deployed HTTP stack

Current blocker evidence:
- `docker` is not available in the current execution environment
- no live GitHub App credentials/installation target is available inside the sandbox

## PR 6 Execution Order
1. Regenerate the plan and remove stale mixed-phase narrative
2. Add targeted unit coverage for GitHub primitives and lifecycle helpers
3. Decide and document the real public API surface for workspace/onboarding/GitHub
4. Extend OpenAPI only for real `/api/v1/*` routes
5. Add integration coverage for webhook idempotency and branch/repo filtering
6. Sync docs to the current workspace/onboarding/GitHub product model
7. Run the final verify bundle

## OpenAPI Policy For This Stage
- Only document routes that actually exist in `main.wasp`
- Keep `/github/webhook` outside `/api/v1/*`
- Do not invent workspace/onboarding/GitHub REST routes until the matching HTTP surface exists
- If a route should become public API, add it intentionally and then add:
  - manifest entry
  - swagger docs
  - schema components
  - contract verification

## Verification Backlog

### Unit
- workspace resolver and workspace access checks
- onboarding state transitions
- GitHub webhook signature verification
- GitHub check-run lifecycle mapping
- installation settings validation

### Integration
- legacy backfill integrity after workspace migration
- workspace-scope isolation across scans/reports/dashboard/webhooks/API keys
- duplicate GitHub webhook delivery handling
- repository and branch trigger filtering

### E2E
- signup -> onboarding -> first scan
- existing user login -> dashboard without onboarding
- workspace switcher changes visible data
- GitHub settings happy path
- webhook fixture -> scan -> check update

## Remaining Product Gaps
- GitHub installation UX still keeps manual installation ID as fallback, even though install/setup flow is now first-class
- no final decision yet on fork PR handling
- no final decision yet on partial-success check conclusions
- no full live verification yet for GitHub App + private repos + check runs

## Done Criteria For This Stage
- existing users retain access to migrated data through workspace scope
- new users reach first value through onboarding without dead ends
- GitHub App can drive scans on selected repos/branches
- GitHub checks reflect scan lifecycle and link back to VibeScan
- docs and OpenAPI reflect only real current product surfaces
- targeted unit/integration/E2E coverage exists for the new stage
- final verification bundle is repeatable

## Risks
- auth regressions from missed user-only queries
- data migration/backfill mistakes
- webhook idempotency gaps
- raw-body signature mismatch in production HTTP path
- private repo clone drift between local and real GitHub App environments
- docs/OpenAPI drift if code ships without corresponding plan/docs refresh

## Explicitly Out Of Scope
- GitHub social auth
- route-prefix refactor like `/w/:workspace/...`
- SCIM / SSO
- advanced RBAC matrix
- issue tracker sync
- advanced PR line annotations

## Immediate Next Moves
1. [ ] Validate workspace migration/backfill on a real dev database
2. [ ] Validate live GitHub App install/private-repo/check-run flow
3. [ ] Validate raw-body signature path for `/github/webhook` in deployed runtime
4. [ ] Optionally expand beyond the current targeted verify bundle with deeper integration/E2E coverage
