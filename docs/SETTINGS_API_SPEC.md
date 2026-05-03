# VibeScan Settings API Specification

## Overview

The active Settings API surface is the `/api/v1/settings/*` family exposed from `wasp-app/main.wasp` and documented in the generated OpenAPI spec. For the current scanner model, the important addition is `scanner-access`, which exposes Snyk readiness and credential state alongside scanner health snapshots.

## API Endpoints

### Profile Management

#### GET /settings/profile
Returns current user profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "region": "OTHER",
    "timezone": "America/New_York",
    "language": "en",
    "created_at": "2026-01-01T00:00:00Z",
    "plan": "pro"
  }
}
```

#### PATCH /settings/profile
Updates user profile fields.

**Request:**
```json
{
  "name": "John Doe",
  "timezone": "America/New_York",
  "language": "en"
}
```

**Validation:**
- name: 1-100 characters
- timezone: Must be in IANA database
- language: One of [en, es, fr, de, ja, zh]

### Plan Information

#### GET /settings/plan
Returns current plan and quota information.

**Response:**
```json
{
  "success": true,
  "data": {
    "current_plan": "pro",
    "monthly_limit": 100,
    "scans_used": 47,
    "remaining": 53,
    "reset_at": "2026-05-01T00:00:00Z",
    "usage_percentage": 47,
    "warning": false
  }
}
```

### API Keys

#### GET /settings/api-keys
Lists all API keys for the user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "key_prefix": "vs_abc1234",
      "label": "Production CI/CD",
      "scopes": ["scan_read", "sbom_submit"],
      "created_at": "2026-01-01T00:00:00Z",
      "last_used_at": "2026-04-07T10:00:00Z",
      "revoked_at": null
    }
  ]
}
```

#### POST /settings/api-keys
Creates a new API key.

**Request:**
```json
{
  "label": "Production CI/CD",
  "scopes": ["scan_read"],
  "expires_at": "2026-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "raw_key": "vs_<random-32-chars>",
    "key_id": "uuid",
    "message": "Store this key securely. It won't be shown again."
  }
}
```

**Rate Limit:** 5 requests per hour per user

#### DELETE /settings/api-keys/:id
Revokes an API key.

**Response:** 204 No Content

### Webhooks

#### GET /settings/webhooks
Lists all webhooks.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "url": "https://example.com/webhook",
      "label": "CI Pipeline",
      "enabled": true,
      "created_at": "2026-01-01T00:00:00Z",
      "last_delivery_status": "success"
    }
  ]
}
```

#### POST /settings/webhooks
Creates a new webhook.

**Request:**
```json
{
  "url": "https://example.com/webhook",
  "label": "CI Pipeline",
  "enabled": true
}
```

**Validation:**
- URL must be HTTPS
- Domain must not be in blocked list
- free_trial plan: max 3 webhooks

**Rate Limit:** 10 requests per hour per user

### Notifications

#### GET /settings/notifications
Returns notification preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "email_enabled": true,
    "webhook_enabled": true,
    "slack_enabled": false,
    "preferred_delivery_time": "09:00"
  }
}
```

#### PATCH /settings/notifications
Updates notification preferences.

### Scanner Access

#### GET /api/v1/settings/scanner-access
Returns scanner access state for the authenticated user.

This endpoint is the readiness view for the provider-aware enterprise path.

**Response:**
```json
{
  "snyk_api_key_attached": true,
  "snyk_api_key_preview": "snyk...3456",
  "snyk_enabled": true,
  "snyk_ready": true,
  "snyk_ready_reason": null,
  "snyk_credential_source": "user-secret",
  "scanner_health": {
    "johnny": {
      "kind": "johnny",
      "configured": true,
      "healthy": true
    },
    "snyk": {
      "kind": "snyk",
      "configured": true,
      "healthy": true
    }
  }
}
```

**Notes:**
- `snyk_credential_source` is `environment`, `user-secret`, or `null`
- readiness is computed from feature flag + credential mode + attached credentials
- the endpoint reports state; it does not itself select providers

#### POST /api/v1/settings/scanner-access
Attaches or clears the authenticated user's Snyk API key.

**Request:**
```json
{
  "snyk_api_key": "snyk-token-abcdef123456"
}
```

**Clear stored key:**
```json
{
  "snyk_api_key": ""
}
```

**Credential mode semantics:**
- `VIBESCAN_ENABLE_SNYK_SCANNER=true` enables Snyk planning
- `VIBESCAN_SNYK_CREDENTIAL_MODE=auto` prefers `SNYK_TOKEN`, then falls back to the user's stored key
- `VIBESCAN_SNYK_CREDENTIAL_MODE=environment` requires `SNYK_TOKEN`
- `VIBESCAN_SNYK_CREDENTIAL_MODE=user-secret` requires an attached user key and authenticated user context

If enterprise scanning has Snyk enabled but readiness is not satisfied, scan submission fails closed instead of silently switching to another provider pair.

### Security

#### GET /settings/security
Returns security settings including active sessions.

#### POST /settings/security/revoke-session/:id
Revokes a specific session.

### Regional Settings

#### GET /settings/regional
Returns regional settings.

#### PATCH /settings/regional
Updates regional settings.

## Validation

### Common Validators

- **Email:** RFC 5322 format, not in blocked domains
- **Timezone:** IANA timezone database
- **Language:** [en, es, fr, de, ja, zh]
- **Currency:** [USD, EUR, GBP, INR, PKR]
- **Webhook URL:** HTTPS only, not localhost/127.0.0.1
- **API Key Scopes:** [sbom_submit, scan_read, webhook_manage, settings_manage]
- **Label:** 1-50 characters, alphanumeric with spaces/hyphens

## Error Responses

### Validation Error (400)
```json
{
  "error": "validation_error",
  "validation_errors": [
    {
      "field": "name",
      "message": "Name must be 1-100 characters"
    }
  ]
}
```

### Quota Exceeded (403)
```json
{
  "error": "quota_exceeded",
  "remaining": 0,
  "reset_at": "2026-05-01T00:00:00Z"
}
```

### Rate Limit Exceeded (429)
```json
{
  "error": "rate_limit_exceeded",
  "retry_after": 60
}
```

## Security

- All endpoints require JWT authentication
- Ownership verification: users can only access their own settings
- API key authentication requires [settings_manage] scope
- Sensitive data encrypted via pgcrypto
- All changes logged to audit table

## Rate Limits

- Profile updates: 10/minute per user
- API key creation: 5/hour per user
- Webhook creation: 10/hour per user
- General settings: 100/minute per user
