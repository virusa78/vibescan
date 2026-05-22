# VibeScan - Gemini CLI Context

VibeScan is a provider-aware vulnerability scanning SaaS platform built with the [Wasp framework](https://wasp.sh/). It features a dual-scanner architecture, workspace management, and deep integration with GitHub and CI/CD pipelines.

## Project Overview

- **Core Framework**: Wasp 0.23+ (Full-stack TypeScript: Node.js + React)
- **Architecture**: Provider-aware orchestration. Scans can run multiple providers (Grype, Codescoring, Snyk) in parallel.
- **Key Features**:
  - **Scanner Orchestration**: `grype` for free tier; `grype` + `codescoring` or `snyk` for enterprise.
  - **Workspace Scope**: All data (scans, API keys, webhooks) is scoped to the active workspace.
  - **Delta Comparison**: Specialized logic to identify vulnerabilities found ONLY by enterprise scanners.
  - **Integration**: GitHub App support, Webhooks (HMAC-SHA256), and API Keys for CI/CD.
- **Tech Stack**:
  - **Backend**: Node.js 24.14.1, Prisma ORM, PostgreSQL 15, Redis 7, BullMQ.
  - **Frontend**: React, Vite, Tailwind CSS, Shadcn/UI, Lucide React, Recharts.
  - **Infrastructure**: Docker for scan isolation, Kubernetes for production.

### Contract Integrity
- **Dual Validation**: When attempting to change any API contract (Wasp Operations, Webhooks, or CLI schemas), you MUST verify and update BOTH the frontend (client-side types and calls) and the backend (validation schemas and operation logic).
- **Consistency**: Ensure that Zod schemas in operations strictly match the TypeScript types used in the frontend components.

## Building and Running

### Prerequisites
- Node.js 24.14.1+ (use `nvm use 24.14.1`)
- Docker & Docker Compose
- Wasp CLI: `curl -sSL https://get.wasp-lang.dev/installer.sh | sh`

### Setup & Start
1.  **Install Dependencies**:
    ```bash
    npm install
    cd wasp-app && npm install
    ```
2.  **Start Services**:
    ```bash
    docker compose up -d
    ```
3.  **Database Migration**:
    ```bash
    npm run migrate  # or: cd wasp-app && wasp db migrate-dev
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev      # Starts Wasp dev stack
    ```
    - **Frontend**: `http://localhost:3000`
    - **Backend API**: `http://localhost:3555`
    - **Swagger Docs**: `http://localhost:3555/docs`

### Key Environment Variables
- `PORT=3555` (Backend Port - **Invariant**)
- `DATABASE_URL`: PostgreSQL connection string.
- `WASP_SERVER_URL`: Backend URL for tooling and auth.
- `REACT_APP_API_URL`: Frontend API base URL (typically `http://localhost:3555`).

## Testing & Validation

- **Unit/Integration Tests**: `npm test` (Uses Jest)
- **E2E API Tests**: `npm run test:e2e` (Uses Playwright)
- **OpenAPI Contract Check**: `npm run openapi:contract`
- **Coverage Gate**: `npm run test:coverage:gate` (CI-enforced)

## Development Conventions

### Wasp Architecture
- **Operations**: All business logic MUST reside in `wasp-app/src/server/operations/`.
- **Entities**: Schema defined in `wasp-app/schema.prisma`. Use `wasp db migrate-dev` for changes.
- **Auth**: Wasp handles auth automatically. Access the user via `context.user` in operations.

### Critical Invariants
- **Ownership Verification**: EVERY query or action MUST verify that the authenticated user (`context.user.id`) owns the requested resource or belongs to the relevant workspace.
- **Port 3555**: The backend MUST always run on port 3555 to avoid conflicts with legacy tooling.
- **Scanner Isolation**: Scans MUST run in Docker with `--network=none`, `--read-only`, and `--user=nobody`.
- **Error Handling**: Use standardized `HttpError` with codes like 401, 403, 404, 422, 429, 402.

### Code Style
- **TypeScript**: Strict type checking. Avoid `any`.
- **CSS**: Tailwind CSS is preferred for styling.
- **API Keys**: Bcrypt-hashed storage; NEVER store or log raw keys.
- **Webhooks**: Sign payloads with HMAC-SHA256 using the user's secret.

## Project Structure

- `wasp-app/`: The core Wasp application.
  - `main.wasp`: Central configuration (routes, auth, operations).
  - `src/server/`: Backend logic, operations, and triggers.
  - `src/client/`: Frontend React components and hooks.
- `test/`: Project-wide unit, integration, and E2E tests.
- `docs/`: Architectural documentation and runbooks.
- `scripts/`: Utility scripts for data seeding, contract checks, and environment management.

## Useful Commands

- `wasp db studio`: Visual database browser.
- `npm run seed:mock-data`: Populates DB with demo data.
- `npm run lint:fix`: Automatically fix ESLint issues.
- `wasp build`: Prepare production bundle in `.wasp/build/`.
