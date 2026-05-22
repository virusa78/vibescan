# VibeScan

Provider-aware vulnerability scanning SaaS built on Wasp 0.23+.

## What matters now

- **Active app** lives in `wasp-app/`
- **Backend port** is `3555`
- **Frontend port** is `3000`
- **Archived notes** live in `Backup/`
- **Email setup** is documented in `docs/EMAIL_SETUP.md`

## Quick start

```bash
./run.sh
```

Alternative:

```bash
cd wasp-app && PORT=3555 wasp start
```

## Core commands

```bash
npm install
npm run lint
npm run openapi:contract
npm test
npm run test:e2e
cd wasp-app && wasp build
```

## Current docs

- `docs/ARCHITECTURE.md` — repo layout and active/archive boundaries
- `docs/DEVELOPMENT.md` — local development
- `docs/DEPLOYMENT.md` — deployment model
- `docs/EMAIL_SETUP.md` — mail provider configuration
- `docs/GITHUB_APP_VALIDATION_RUNBOOK.md` — live GitHub App verification
- `PRODUCTION_CHECKLIST.md` — release readiness
- `STARTUP.md` — startup shortcuts
- `CONTRIBUTING.md` — contribution workflow

## Environment

See:

- `wasp-app/.env.server.example`
- `wasp-app/.env.server`
- `wasp-app/.env.local`

## Architecture notes

- Provider planning is stored on each scan as `plannedSources`
- Workspace scoping is the default access model
- Scanner results are source-aware and must not be reduced to a single static provider pair
- Use `./scripts/install-scanner-tooling.sh update` to install/update local scanner binaries and warm the OWASP cache under `wasp-app/.cache/owasp/`
