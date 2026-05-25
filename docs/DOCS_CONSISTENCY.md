# Documentation Consistency Guide

Purpose

Keep documentation consistent across the repository. When any documentation, environment variable, or onboarding text is changed, update all related files to avoid drift and confusion.

Files to check (non-exhaustive)

- README.md
- PRODUCTION_CHECKLIST.md
- wasp-app/.env.server.example
- wasp-app/.env.server
- CLAUDE.md
- AGENTS.md
- OPERATIONS.md
- docs/* (any docs folder files)

Checklist for doc changes

1. Identify the scope of the change (env var, command, config, process).
2. Search the repo for the affected keyword(s) (e.g., ENV_VAR_NAME, CLI command).
3. Update the canonical docs (README.md, PRODUCTION_CHECKLIST.md, .env examples).
4. Update any domain-specific docs (CLAUDE.md, AGENTS.md, OPERATIONS.md, deployment scripts).
5. Add an entry to docs/DOCS_CONSISTENCY.md describing what was changed and why, with links to commits/PRs.
6. Run `npm run lint`, `npx tsc --noEmit`, and `npm test` if the change could affect build or tests.
7. Commit & push the changes; include a brief note in the PR description about doc sync.

HubSpot guidance

- Prefer a HubSpot service key (server-to-server) over a personal access key. The env var name used in this repo is `HUBSPOT_SERVICE_KEY`.
- Store production values in your secret manager (do not commit raw keys).
- Update `.env.server.example` when adding new env vars and reflect the change in PRODUCTION_CHECKLIST.md and README.md.

Notes

This file exists to make the doc-sync process explicit. Keep it short and actionable; reference it in PR templates or developer checklists.