# Development Environment

## Core Services
- Backend: `http://127.0.0.1:3555`
- Frontend: `http://127.0.0.1:3000`
- PostgreSQL: local Docker service, usually on `5432`, with fallback ports handled by `run.sh`
- Redis: `6379`
- MinIO: `9000` and `9001`

## Canonical Start Commands
- `./run.sh` starts the local dev contour.
- `./run.sh --stop` stops the contour.
- `./scripts/wasp-dev.sh up` is the managed Wasp entrypoint used by E2E automation.

## Database Workflow
- Use `cd wasp-app && wasp db migrate-dev --name "..."` for schema changes.
- Do not run raw `prisma migrate dev`.
- Do not manually edit files under `wasp-app/migrations/`.
- If generated code gets stale, use `cd wasp-app && wasp clean` and rebuild.

## Environment Files
- `wasp-app/.env.server` is the backend runtime source of truth.
- Do not assume a hardcoded DB port in tests or scripts if the launcher can select a fallback port.
- If a test needs the active database URL, derive it from the running contour instead of assuming `5432`.

## Troubleshooting
- If the app starts but the browser hangs, inspect `.logs/wasp-dev.log`.
- If database auth fails, confirm whether another local Postgres already owns the port.
- If Wasp reports stale types or entities, wait for recompilation or rebuild after cleaning.

