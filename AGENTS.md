# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the backend API, workers, queues, and services (for example `src/services/`, `src/workers/`, `src/handlers/`).  
`test/` is split by scope: `unit/`, `integration/`, `e2e/`, and `e2e-wasp/`.  
`wasp-app/` is the active OpenSaaS/Wasp migration surface (`main.wasp`, `src/`, `migrations/`).  
`vibescan-ui/` + root `src/` remain available for legacy/local backend + Next.js flows.  
Treat `dist/`, `coverage/`, `playwright-report/`, and `test-results/` as generated output.

## Build, Test, and Development Commands
Wasp migration flow (preferred):
- `npm run wasp:up` starts the managed Wasp dev contour (`scripts/wasp-dev.sh up`), including docker infra (`postgres`, `redis`, `minio`) and `wasp db migrate-dev`.
- `npm run wasp:down` stops Wasp dev processes and frees ports.
- `bash ./scripts/wasp-dev.sh status` shows current Wasp frontend/server status and log path.
- `npm run wasp:dev` is a foreground Wasp start (`run-wasp.sh`) for direct CLI sessions.

Legacy flow (when working outside cutover scope):
- `npm run dev`, `npm run build`, `npm run start` for root backend.
- `cd vibescan-ui && npm run dev` for Next.js UI.
- `npm run test:e2e:wasp` for Wasp-specific Playwright config.
- `npm test`, `npm run test:coverage`, `npm run test:coverage:gate`, `npm run lint`.

## Coding Style & Naming Conventions
Use TypeScript with ESM conventions and existing 4-space indentation style.  
Keep local TS imports using `.js` extensions (NodeNext pattern), consistent with `src/index.ts`.  
Use `camelCase` for variables/functions, `PascalCase` for types/classes, and descriptive module names (for example `scanOrchestrator.ts`).  
Run ESLint before opening a PR.

## Testing Guidelines
Jest is the default framework for backend tests (`*.test.ts`).  
Place tests in the matching directory (`test/unit`, `test/integration`, `test/e2e`).  
Use coverage commands during feature work; `test:coverage:gate` is the baseline gate and `test:coverage:strict` targets 70/70 (lines/branches).  
For E2E, ensure API (`/health`) and frontend (`/login`) are reachable; for Wasp-specific UI flows use `npm run test:e2e:wasp`.

## Commit & Pull Request Guidelines
Current history follows Conventional Commit prefixes (`feat:`, `docs:`). Keep that format: `<type>: <imperative summary>`.  
Before pushing, run `npm run lint`, `npm run test:coverage`, and `npm run build`.  
PRs should include: problem/solution summary, related issue(s), test evidence, and screenshots for UI changes (`vibescan-ui`).

## Security & Configuration Tips
Use `.env.example` as the baseline and keep secrets out of git.  
OpenSaaS cutover toggles live in env: `OPENSAAS_MODE` and `OPENSAAS_PLATFORM_OWNED`.  
Develop with Node `24` (`.nvmrc`), even though some CI workflows still pin Node `20`.
