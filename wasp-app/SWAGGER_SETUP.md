# Swagger/OpenAPI Setup for VibeScan API

## Current Status

Swagger UI and the OpenAPI JSON spec are **enabled** in the Wasp app.
They are served by `src/server/swaggerHandlers.ts` and wired in `main.wasp`
as `/docs` and `/docs/swagger.json`.

## Implementation Overview

- **Spec generation**: `swagger-jsdoc` reads `@swagger` JSDoc blocks from
  `src/server/operations/**/swagger-docs.ts`.
- **Shared schemas**: `src/server/swagger/schemas.ts`.
- **Routes**: `main.wasp` exposes:
  - `GET /docs`
  - `GET /docs/swagger.json`

## Access

- **UI:** `http://192.168.1.17:3555/docs`
- **JSON:** `http://192.168.1.17:3555/docs/swagger.json`

## Documented REST Endpoints

- **API Keys**: `/api/v1/api-keys`, `/api/v1/api-keys/:keyId`
- **Scans**: `/api/v1/scans`, `/api/v1/scans/:scanId`, `/api/v1/scans/stats`
- **Reports**: `/api/v1/reports/:scanId`, `/summary`, `/pdf`, `/ci-decision`
- **Webhooks**: `/api/v1/webhooks`, `/api/v1/webhooks/:webhookId`
- **Dashboard**: `/api/v1/dashboard/metrics`, `/recent-scans`,
  `/severity-breakdown`, `/quota`
- **Settings**: `/api/v1/settings/profile`, `/api/v1/settings/notifications`

## References

- [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc)
- [Swagger UI](https://github.com/swagger-api/swagger-ui)
- [Wasp Documentation](https://wasp.sh/docs)
