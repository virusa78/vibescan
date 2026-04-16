# Swagger/OpenAPI Setup for VibeScan API

## Current Status

Wasp uses Express as the HTTP server internally, which makes it compatible with Express middleware like `swagger-ui-express` and `swagger-jsdoc`.

**Status:** ⏳ Pending implementation (requires Wasp server hook)

## Installation

The necessary packages have been installed:
```bash
npm install --save swagger-ui-express swagger-jsdoc
```

## Implementation

The swagger configuration is defined in `src/server/swagger.ts` with:
- OpenAPI 3.0.0 spec
- VibeScan API documentation
- Authentication methods (JWT, API Key)
- Tags for all API endpoints

## How to Enable

Once Wasp supports server initialization hooks or custom middleware injection, add this to the Express router:

```typescript
import { swaggerUiMiddleware, swaggerUiSetup, swaggerSpecHandler } from '@src/server/swagger';

router.get('/docs/swagger.json', swaggerSpecHandler);
router.use('/docs', swaggerUiMiddleware, swaggerUiSetup);
```

## Alternative: Manual Route Addition

If Wasp doesn't support middleware hooks, you can:

1. Create a custom Express router file: `src/server/routes/swagger.ts`
2. Import and mount it in the Wasp-generated routes

## API Endpoints to Document

The Swagger documentation should cover:

### Authentication
- POST `/auth/register` - User registration
- POST `/auth/login` - User login
- POST `/auth/refresh` - Token refresh
- POST `/auth/logout` - User logout

### API Keys
- POST `/api-keys/generate` - Generate new API key
- GET `/api-keys` - List user's API keys
- DELETE `/api-keys/{id}` - Revoke API key

### Scans
- POST `/scans` - Submit new scan
- GET `/scans` - List user's scans
- GET `/scans/{id}` - Get scan details
- DELETE `/scans/{id}` - Cancel scan

### Reports
- GET `/reports/{scan_id}` - Get full report
- GET `/reports/{scan_id}/summary` - Get summary
- POST `/reports/{scan_id}/pdf` - Request PDF generation

### Webhooks
- POST `/webhooks` - Configure webhook
- GET `/webhooks` - List webhooks
- DELETE `/webhooks/{id}` - Delete webhook

### Billing
- POST `/billing/checkout` - Create checkout session
- GET `/billing/subscription` - Get subscription details
- POST `/billing/webhook` - Stripe webhook handler

## Access

Once enabled, Swagger will be available at:
- **UI:** `http://localhost:3001/docs`
- **JSON:** `http://localhost:3001/docs/swagger.json`

## References

- [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)
- [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc)
- [Wasp Documentation](https://wasp.sh/docs)

