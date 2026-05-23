# VibeScan

Provider-aware vulnerability scanning SaaS built on Wasp 0.23+.

## What matters now

- **Active app** lives in `wasp-app/`
- **Backend port** is `3555`
- **Frontend port** is `3000`
- **Archived notes** live in `Backup/`
- **Email setup** is documented in `docs/EMAIL_SETUP.md`
- **Deployment model** keeps the control plane stable while the execution plane
  can run locally, in containers, or on cloud workers such as DigitalOcean

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
- `docs/DEPLOYMENT_DIGITALOCEAN.md` — DigitalOcean production plan
- `docs/EMAIL_SETUP.md` — mail provider configuration
- `docs/GITHUB_APP_VALIDATION_RUNBOOK.md` — live GitHub App verification
- `deployment-scripts/` — DigitalOcean deployment entrypoints and operator docs
- `deployment-scripts/INDEX.md` — quick navigation map for the deployment module
- `deployment-scripts/README.md` — human-friendly usage guide for the deployment scripts
- `deployment-scripts/AGENTS.md` — agent-facing contract for modifying the scripts
- `npm run deploy:digitalocean:menu` — explicit interactive DigitalOcean menu
- `npm run deploy:digitalocean:provision` — one-shot infrastructure bootstrap
- `npm run deploy:digitalocean:status` — headless deployment status
- `npm run deploy:digitalocean:update` — DOKS update flow
- `npm run deploy:digitalocean:full` — full DOKS deploy flow
- `npm run deploy:digitalocean:bootstrap` — interactive DigitalOcean menu
- `npm run deploy:digitalocean:migrate` — headless DOKS migration/update flow
- `.github/workflows/vibescan-ci-gate.yml` — reusable consumer-repo CI gate
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
