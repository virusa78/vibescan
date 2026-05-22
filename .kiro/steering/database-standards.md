---
inclusion: manual
---

# Database Standards

## Schema
- Keep Prisma schema changes intentional and minimal.
- Add indexes for common filters, grouping keys, and workspace-scoped queries.
- Model ownership explicitly with `workspaceId` or equivalent foreign keys.

## Migrations
- Use Wasp-managed migrations only.
- Do not hand-edit migration SQL.
- Keep migration history sequential and review merge conflicts carefully.

## Data Access
- Use Prisma for ordinary persistence and reads.
- Avoid raw SQL unless there is a clear performance or correctness reason.
- When reading large datasets, push filtering and ordering into the query rather than post-processing in memory.

## Dev Database
- The local launcher may move PostgreSQL off `5432` when the port is occupied.
- Any script or test that talks directly to the database must discover the active port instead of assuming a fixed one.
- If a direct database client is used in tests, ensure it matches the same `DATABASE_URL` as the app runtime.

