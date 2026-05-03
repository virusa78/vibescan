# VibeScan Deployment

This document describes the current deployment model without pretending the local dev flow and the container flow are the same thing.

## Runtime Modes

- Local development:
  - Run from `wasp-app/` with `wasp start`
  - Default backend port is `3555`
  - Default frontend port is `3000`
- Container deployment:
  - Build from root `Dockerfile`
  - The image runs `wasp build` during image build
  - The container starts the built server with `node .wasp/build/server`
  - Default container port is `3000`

## Docker Images

- API image: root `Dockerfile`
- Worker image: root `Dockerfile.worker`

The worker image starts `wasp-app/src/server/workers/runQueueWorker.ts` and selects the queue role through `WORKER_ROLE`.

## Kubernetes Process Model

- `vibescan-api` runs the HTTP application
- `vibescan-free-worker` runs the free scan queue consumer
- `vibescan-enterprise-worker` runs the enterprise scan queue consumer

The API deployment sets `VIBESCAN_EMBED_WORKERS=false` so the API pod does not also act as a queue worker.

## Compose Model

`docker-compose.yml` now builds the API service from the repo root using the same root `Dockerfile`.

This keeps compose aligned with the real repo layout instead of referencing a non-existent Dockerfile.

## Known Gaps

- The repo still carries historical docs and archived artifacts that should be cleaned up further.
- Worker lifecycle is now explicit, but broader queue/config typing cleanup is still pending.
- Environment validation is still partial and should move to a dedicated typed config layer.
