## Summary

This PR closes the workspace/onboarding/GitHub product stage with the remaining polish needed to make it reviewable and operable as one coherent slice.

It focuses on:

- cleaner GitHub App connect UX
- explicit workspace-aware API surface
- OpenAPI/docs/test alignment
- repeatable verification for the new stage

## What Changed

### Workspace Surface

- added explicit workspace operations:
  - `getWorkspaceContext`
  - `listWorkspaces`
  - `switchWorkspace`
- added HTTP API:
  - `GET /api/v1/workspaces`
  - `GET /api/v1/workspaces/current`
  - `POST /api/v1/workspaces/switch`
- added workspace switcher to desktop and mobile navigation

### Onboarding / GitHub API Surface

- added onboarding HTTP API:
  - `GET /api/v1/onboarding/state`
  - `POST /api/v1/onboarding/complete`
- added GitHub HTTP API:
  - `GET /api/v1/github/installations`
  - `POST /api/v1/github/installations/link`
  - `POST /api/v1/github/installations/:installationId/settings`

### GitHub UX Polish

- added `getGithubAppSetup` query
- added optional `GITHUB_APP_SLUG` env support
- settings page now exposes:
  - direct `Install GitHub App` link when slug is configured
  - callback/webhook visibility
  - manual installation ID entry as advanced fallback instead of the primary path

### OpenAPI / Docs / Tooling

- extended OpenAPI manifest and schemas for workspace/onboarding/GitHub surfaces
- fixed OpenAPI generation on newer runtime/module behavior
- fixed root verification toolchain issues required for this stage
- added repeatable verify command:
  - `npm run verify:workspace-github-stage`
- added GitHub App manual validation runbook:
  - `docs/GITHUB_APP_VALIDATION_RUNBOOK.md`
- refreshed `plan.md` into a checklist-driven active plan

### Test Coverage

- added/updated targeted unit coverage for:
  - GitHub webhook signature verification
  - GitHub check-run lifecycle service
  - workspace switching
  - GitHub webhook filtering rules
  - GitHub App setup/install URL generation

## Why

Before this PR, the new product stage was mostly implemented but still had three trust gaps:

- workspace context existed in code but did not have a first-class user-facing API/switch surface
- GitHub connect UX was too internal and depended on manual installation ID entry as the main path
- verification existed as scattered commands instead of one repeatable stage-specific check

This PR closes those gaps without pretending that live external validation can be replaced by local unit tests.

## Validation

Executed during this branch work:

- `npm run verify:workspace-github-stage`
  - `npm run lint`
  - `npm run openapi:contract`
  - `npm run test:targeted:workspace-github-stage`

## Remaining Follow-Ups

- live validation on real migrated workspace data
- live GitHub App install/private-repo/check-run verification
- deeper integration/E2E coverage for duplicate deliveries and full happy paths
