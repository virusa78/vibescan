# Project Standards and Guidelines

## Code Quality
- Follow the existing Wasp + TypeScript patterns in this repository.
- Keep changes scoped to the smallest affected operation, component, service, or test.
- Prefer explicit data flow over hidden global state.
- Use descriptive names that match the project domain: scans, findings, workspaces, webhooks, projects, and reports.
- Keep server-side business logic in `wasp-app/src/server/` and client UI logic in `wasp-app/src/client/`.

## Wasp Conventions
- Declare routes, pages, queries, actions, and APIs in `wasp-app/main.wasp`.
- Use `@src/` imports in `main.wasp`; do not use relative paths there.
- Add every Prisma entity used by an operation to the operation's `entities` list.
- Treat Wasp operations as the primary application boundary. Prefer them over ad hoc HTTP handlers unless the surface is intentionally public.

## Testing
- Add or update tests for behavior changes in the smallest relevant layer first.
- Prefer unit tests for pure logic, integration tests for workflow changes, and Playwright for user-facing flows.
- Keep e2e tests stable: they should assert behavior, not implementation details.
- When fixing a bug, add a regression test that would have caught it.

## Security
- Assume all workspace-scoped resources require explicit workspace filtering.
- Never trust request headers for identity or tenancy decisions unless there is a dedicated validation path.
- Treat secrets, tokens, and webhook payloads as sensitive by default.
- Keep auth, billing, and webhook logic conservative and well-reviewed.

## Performance
- Avoid N+1 queries in Prisma reads.
- Prefer server-side filtering, sorting, and grouping for large datasets.
- Keep UI fetches and table rendering bounded so the page remains usable as data grows.

