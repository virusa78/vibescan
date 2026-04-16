# VibeScan Settings API Specification

## Overview

The Settings API provides comprehensive user settings management including profile, plan/quota information, API keys, webhooks, notifications, security, and regional settings.

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
