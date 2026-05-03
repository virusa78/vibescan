# Swagger/OpenAPI Setup for VibeScan API

## Current Status

Swagger UI and the OpenAPI JSON spec are **enabled** in the Wasp app.
They are served by `src/server/swaggerHandlers.ts` and wired in `main.wasp`
as `/docs` and `/docs/swagger.json`.

## Implementation Overview

- **Spec generation**: `generateOpenApiSpec()` uses a manifest-first strategy for `/api/v1/*`.
  - primary input: `src/server/swagger/v1EndpointManifest.ts`
  - primary swagger sources: manifest-declared `src/server/operations/**/swagger-docs.ts` files
  - fallback: absolute glob scan if the manifest-primary pass yields zero `/api/v1` operations
- **Shared schemas**: `src/server/swagger/schemas.ts`.
- **Routes**: `main.wasp` exposes:
  - `GET /docs`
  - `GET /docs/swagger.json`
- **Contract gate**: `src/server/swagger/openapiContractPolicy.ts` validates that `/api/v1/*`
  stays synchronized across `main.wasp`, the endpoint manifest, and the generated spec.

## Access

- **UI:** `http://127.0.0.1:3555/docs`
- **JSON:** `http://127.0.0.1:3555/docs/swagger.json`

## `/api/v1/*` policy

The current OpenAPI policy is intentionally stricter than "render whatever swagger-jsdoc finds".

For every `/api/v1/*` operation:

- the route must exist in `wasp-app/main.wasp`
- the route must exist in `src/server/swagger/v1EndpointManifest.ts`
- the route must exist in the generated OpenAPI spec
- `operationId` is required
- `security` is required
- `requestBody` is required when the manifest marks the operation as body-bearing
- at least one `2xx`, `4xx`, and `5xx` response must exist
- `4xx` and `5xx` responses must reference `#/components/schemas/ErrorResponse`

This policy is enforced by `npm run openapi:contract`.

## Documented REST Endpoints

- **API Keys**: `/api/v1/api-keys`, `/api/v1/api-keys/:keyId`
- **Scans**: `/api/v1/scans`, `/api/v1/scans/:scanId`, `/api/v1/scans/stats`
- **Reports**: `/api/v1/reports/:scanId`, `/summary`, `/pdf`, `/ci-decision`
- **Webhooks**: `/api/v1/webhooks`, `/api/v1/webhooks/:webhookId`
- **Dashboard**: `/api/v1/dashboard/metrics`, `/recent-scans`,
  `/severity-breakdown`, `/quota`
- **Settings**: `/api/v1/settings/profile`, `/api/v1/settings/notifications`,
  `/api/v1/settings/scanner-access`

## Scanner-aware response model

OpenAPI schemas now reflect the provider-aware scanner model:

- scans expose `planned_sources`
- scan and dashboard summaries expose source-level breakdowns such as `counts_by_source`
- settings expose Snyk readiness/credential state through `scanner-access`

Legacy compatibility fields such as `free_count` and `enterprise_count` remain documented, but source-level breakdowns are the authoritative model.

## References

- [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc)
- [Swagger UI](https://github.com/swagger-api/swagger-ui)
- [Wasp Documentation](https://wasp.sh/docs)
