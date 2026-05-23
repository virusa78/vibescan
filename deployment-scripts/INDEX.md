# Deployment Scripts Index

This folder contains the DigitalOcean deployment module for VibeScan.
Use this file when you need the shortest possible map of what to run.

## Canonical Entry Points

- `npm run deploy:digitalocean:menu`
  - interactive operator menu
- `npm run deploy:digitalocean:provision`
  - direct infrastructure bootstrap
- `npm run deploy:digitalocean:status`
  - headless status and migration inspection
- `npm run deploy:digitalocean:update`
  - DOKS update flow
- `npm run deploy:digitalocean:full`
  - full DOKS deploy flow
- `npm run deploy:digitalocean:migrate`
  - droplets-to-DOKS migration/update flow

## Files

- `digitalocean-bootstrap.ts`
  - provisions or reconciles DigitalOcean resources
  - owns droplet and DOKS provisioning
  - saves deployment state
- `digitalocean-doks-migration.ts`
  - detects pending migrations
  - runs repeatable DOKS updates
  - prints the post-deploy checklist
- `digitalocean-state.ts`
  - owns `.vibescan/digitalocean-state.json`
  - stores previous deployment metadata

## Suggested Reading Order

1. `AGENTS.md`
2. `README.md`
3. `digitalocean-bootstrap.ts`
4. `digitalocean-doks-migration.ts`
5. `digitalocean-state.ts`

## Modification Rule

If you change command semantics or add a new entrypoint, update:

- `package.json`
- `deployment-scripts/README.md`
- `deployment-scripts/AGENTS.md`
- `docs/DEPLOYMENT_DIGITALOCEAN.md`
- `README.md`
