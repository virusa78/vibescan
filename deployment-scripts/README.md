# Deployment Scripts

This directory contains the DigitalOcean deployment entrypoints for VibeScan.
The scripts are intentionally small and explicit so another agent can understand
what they do, what they depend on, and how to extend them without guessing.

## Files

- `digitalocean-bootstrap.ts`
  - interactive and direct bootstrap entrypoint
  - provisions or reconciles DigitalOcean infrastructure
  - supports `bootstrap`, `droplet-single`, `droplet-dual`, `build`, `deploy`,
    `migrate`, `smoke`, `status`, `full`, and `plans`
- `digitalocean-doks-migration.ts`
  - headless DOKS update entrypoint
  - detects whether a database migration is pending
  - runs the bootstrap/update flow without interactive prompts
- `digitalocean-state.ts`
  - reads and writes `.vibescan/digitalocean-state.json`
  - stores the deployment mode, IDs, URIs, and last applied migration marker

## Canonical Commands

```bash
npm run deploy:digitalocean:menu
npm run deploy:digitalocean:provision
npm run deploy:digitalocean:status
npm run deploy:digitalocean:update
npm run deploy:digitalocean:full
npm run deploy:digitalocean:bootstrap
npm run deploy:digitalocean:migrate
```

Preferred flow:

- `deploy:digitalocean:menu` for interactive work
- `deploy:digitalocean:provision` for one-shot infrastructure bootstrap
- `deploy:digitalocean:status` for inspection without changes
- `deploy:digitalocean:update` or `deploy:digitalocean:full` for DOKS updates
- `deploy:digitalocean:migrate` for droplet-to-DOKS migration and later
  headless DOKS updates

`deploy:digitalocean:bootstrap` remains a compatibility alias for the
interactive menu.

## Runtime Expectations

- `doctl` authenticated against the target DigitalOcean account
- `kubectl`
- `curl`
- `.env` or `.env.local` with `PAT`, `DO_TOKEN`, or `DIGITALOCEAN_TOKEN`
- optional `aws` if you want the script to create the Spaces bucket

The scripts load `.env` and `.env.local` from the repo root. They do not require
manual editing of the state file.

## How The Flow Works

1. `digitalocean-bootstrap.ts` provisions the cloud resources or reconciles an
   existing deployment.
2. It saves the resulting deployment state to
   `.vibescan/digitalocean-state.json`.
3. `digitalocean-doks-migration.ts` reads that state and determines whether a
   migration is pending.
4. If a migration is needed, it invokes the bootstrapper in headless mode and
   then completes build, deploy, and smoke-test steps.

## How To Modify Safely

When changing these scripts:

1. Keep command parsing and orchestration in the scripts, not in docs.
2. Update `deployment-scripts/digitalocean-state.ts` if the saved state shape
   changes.
3. Keep `digitalocean-doks-migration.ts` thin. It should coordinate steps, not
   duplicate provisioning logic.
4. If you add a new command or menu option, wire it into:
   - `deployment-scripts/digitalocean-bootstrap.ts`
   - `package.json`
   - `docs/DEPLOYMENT_DIGITALOCEAN.md`
   - `README.md`
5. Do not hand-edit `.vibescan/digitalocean-state.json`.
6. Preserve idempotency. Re-running a command should reuse existing resources
   when possible instead of creating new ones.

## Verification

After changing the scripts, run at least:

```bash
npx eslint deployment-scripts/*.ts
npx tsc --noEmit -p tsconfig.deployment-scripts.json
git diff --check
```

If you changed the deployment behavior or user-facing flow, also update the
deployment runbook in `docs/DEPLOYMENT_DIGITALOCEAN.md`.
