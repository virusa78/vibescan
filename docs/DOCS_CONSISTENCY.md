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

## Recent Updates

- **2026-05-26**: Documented the new `uploadScanFile` Wasp Action (added to support drag-and-drop SBOM/ZIP file upload in UI) and updated operation counts across `OPERATIONS.md`, `CLAUDE.md`, and `AGENTS.md`.
- **2026-05-26**: Configured a custom Wasp server middleware `serverMiddlewareConfigFn` inside `wasp-app/src/server/middleware.ts` to increase the body parser limits to 35MB to prevent HTTP 413 (Payload Too Large) errors on larger SBOM and ZIP scan uploads.
- **2026-05-26**: Improved scanner failure reporting by translating the raw `'Invalid SBOM format'` exception into a clean, helpful, user-friendly guidance message.
- **2026-05-26**: Added an interactive "How to generate SBOM?" help Dialog to the New Scan page (under the SBOM Manifest tab) providing clear installation and command usage examples for Anchore Syft with one-click copy buttons.
- **2026-05-26**: Redesigned ScanDetailsPage.tsx to display failed/error scans inline using the unified scan details layout instead of rendering a full-screen blocking error card. Added a neat red failure alert banner below the header to display specific error descriptions.
- **2026-05-26**: Increased the client-side SBOM upload size validation limit from 5MB to 10MB inside NewScanPage.tsx and updated UI labels.
- **2026-05-26**: Transitioned all scanner runtimes (Grype, Trivy, OWASP, Syft, Snyk, and SSH/SCP clients) to asynchronous process execution using `child_process` promises to avoid blocking the Node.js event loop.
- **2026-05-26**: Implemented configurable scanner worker concurrency using `FREE_SCAN_CONCURRENCY` and `ENTERPRISE_SCAN_CONCURRENCY` env vars.
- **2026-05-26**: Added support for skipping OWASP Dependency-Check database updates with `OWASP_NO_UPDATE=true` and authenticating updates with `NVD_API_KEY` to avoid rate limits.