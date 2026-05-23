# AGENTS.md — Deployment Scripts

This folder is the canonical home for the DigitalOcean deployment entrypoints.
If you are an agent modifying deployment behavior, read this first.

## Purpose

- bootstrap VibeScan infrastructure on DigitalOcean
- support droplet-based and DOKS-based flows
- keep repeat updates headless and deterministic
- persist deployment state locally so later runs do not require manual input

## Entry Points

- `INDEX.md`
  - shortest navigation map
- `digitalocean-bootstrap.ts`
  - interactive menu
  - direct one-shot actions
  - bootstrap, deploy, migrate, smoke, status, and plan printing
- `digitalocean-doks-migration.ts`
  - headless update wrapper
  - detects pending schema migrations
  - orchestrates bootstrap -> migration -> build -> deploy -> smoke
- `digitalocean-state.ts`
  - deployment state storage
  - owns the `.vibescan/digitalocean-state.json` path

## Important Rules

- Do not edit `.vibescan/digitalocean-state.json` manually.
- Keep the scripts idempotent. Re-running them should reconcile, not duplicate.
- Keep provisioning logic in `digitalocean-bootstrap.ts`.
- Keep orchestration and migration detection in `digitalocean-doks-migration.ts`.
- If you change the saved state shape, update both the loader and saver in
  `digitalocean-state.ts`.
- If you add or rename commands, update `package.json`, the root `README.md`,
  `deployment-scripts/INDEX.md`, and `docs/DEPLOYMENT_DIGITALOCEAN.md`.

## Environment Assumptions

- `doctl` is installed and authenticated.
- `kubectl` is available.
- `curl` is available.
- `.env` or `.env.local` may contain `PAT`, `DO_TOKEN`, or
  `DIGITALOCEAN_TOKEN`.
- `aws` is optional and only needed for automatic Spaces bucket creation.

## Modification Checklist

When changing behavior:

1. Decide whether the change belongs in bootstrap, migration orchestration, or
   state persistence.
2. Update the smallest file that owns the behavior.
3. Make sure the user-facing commands still match the docs.
4. Keep the help text short and accurate.
5. Run:
   - `npx eslint deployment-scripts/*.ts`
   - `npx tsc --noEmit -p tsconfig.deployment-scripts.json`
   - `git diff --check`

## Good Mental Model

- `digitalocean-bootstrap.ts` is the operator tool.
- `digitalocean-doks-migration.ts` is the headless updater.
- `digitalocean-state.ts` is the memory of previous runs.

Do not turn this folder into a generic scripts dump. It is a deployment module
with a clear contract.
