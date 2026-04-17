# VibeScan Operations Reference

Complete documentation of all 20 Wasp operations available in VibeScan. These are the core API endpoints that power the vulnerability scanning platform.

## Operations Summary

| Category | Count | Operations |
|----------|-------|-----------|
| **User Management** | 3 | getPaginatedUsers, updateIsUserAdminById, updateUserSettings |
| **API Keys** | 3 | generateApiKey, listApiKeys, revokeApiKey |
| **Scans** | 3 | getScans, getScanById, submitScan |
| **Reports** | 4 | getReport, getReportSummary, generateReportPDF, getCIDecision |
| **Webhooks** | 5 | createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook |
| **Billing** | 2 | getCustomerPortalUrl, generateCheckoutSession |
| **Total** | **20** | Full-stack Wasp operations |

---

## User Management Operations

### 1. getPaginatedUsers

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Retrieve paginated user list

**Usage**:
```typescript
import { getPaginatedUsers } from 'wasp/client/operations'

const { data: users } = await getPaginatedUsers({ 
  limit: 10, 
  offset: 0 
})
```

**Parameters**:
```typescript
{
  limit?: number      // Items per page (default: 10)
  offset?: number     // Pagination offset (default: 0)
}
```

**Response**:
```typescript
{
  data: Array<{
    id: string
    email: string
    username?: string
    createdAt: Date
    updatedAt: Date
  }>,
  total: number       // Total user count
}
```

**Error Codes**:
- `401`: Unauthorized
- `403`: Forbidden (admin access required)

---

### 2. updateIsUserAdminById

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Promote/demote user admin status

**Usage**:
```typescript
import { updateIsUserAdminById } from 'wasp/client/operations'

await updateIsUserAdminById({ 
  userId: "user-123", 
  isAdmin: true 
})
```

**Parameters**:
```typescript
{
  userId: string      // Target user ID
  isAdmin: boolean    // Admin status to set
}
```

**Response**:
```typescript
{
  id: string
  email: string
  isAdmin: boolean
  updatedAt: Date
}
```

**Error Codes**:
- `401`: Unauthorized
- `403`: Not an admin
- `404`: User not found

---

### 3. updateUserSettings

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Update current user's settings

**Usage**:
```typescript
import { updateUserSettings } from 'wasp/client/operations'

await updateUserSettings({ 
  theme: 'dark',
  emailNotifications: true,
  region: 'IN'
})
```

**Parameters**:
```typescript
{
  theme?: 'light' | 'dark'
  emailNotifications?: boolean
  region?: 'IN' | 'PK' | 'OTHER'
  language?: string
}
```

**Response**:
```typescript
{
  id: string
  email: string
  settings: {
    theme: string
    emailNotifications: boolean
    region: string
    language: string
  }
  updatedAt: Date
}
```

**Error Codes**:
- `401`: Unauthorized
- `422`: Invalid region or theme

---

## API Keys Operations

### 4. generateApiKey

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Create new API key for user

**Usage**:
```typescript
import { generateApiKey } from 'wasp/client/operations'

const { key, keyId } = await generateApiKey({ 
  name: "CI Integration" 
})
```

**Parameters**:
```typescript
{
  name: string        // Human-readable key name
  description?: string
}
```

**Response**:
```typescript
{
  keyId: string       // Use for display/revocation
  key: string         // Full key (ONLY returned once at generation!)
  name: string
  createdAt: Date
  expiresAt?: Date
}
```

**Important**:
- ⚠️ Raw API key returned **only at generation time**
- Store securely; cannot be retrieved later
- Used for CI/CD authentication via `Authorization: Bearer KEY`

**Error Codes**:
- `401`: Unauthorized
- `409`: Too many API keys (limit: 10 per user)

---

### 5. listApiKeys

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: List all API keys for current user

**Usage**:
```typescript
import { listApiKeys } from 'wasp/client/operations'

const { data: keys } = await listApiKeys()
```

**Parameters**:
```typescript
{} // No parameters required
```

**Response**:
```typescript
Array<{
  id: string
  name: string
  description?: string
  lastUsedAt?: Date
  createdAt: Date
  expiresAt?: Date
}>
```

**Note**: Raw key content is never returned in lists (security)

**Error Codes**:
- `401`: Unauthorized

---

### 6. revokeApiKey

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Delete/revoke an API key

**Usage**:
```typescript
import { revokeApiKey } from 'wasp/client/operations'

await revokeApiKey({ keyId: "key-123" })
```

**Parameters**:
```typescript
{
  keyId: string       // API key ID to revoke
}
```

**Response**:
```typescript
{
  success: boolean
  keyId: string
  revokedAt: Date
}
```

**Error Codes**:
- `401`: Unauthorized
- `404`: API key not found

---

## Scans Operations

### 7. getScans

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Retrieve paginated list of user's scans

**Usage**:
```typescript
import { getScans } from 'wasp/client/operations'

const { data: scans } = await getScans({ 
  limit: 20,
  offset: 0,
  status: 'completed'
})
```

**Parameters**:
```typescript
{
  limit?: number        // Items per page
  offset?: number       // Pagination offset
  status?: 'queued' | 'running' | 'completed' | 'failed'
  fromDate?: Date       // Filter scans after date
  toDate?: Date         // Filter scans before date
}
```

**Response**:
```typescript
{
  data: Array<{
    id: string
    scanType: 'github_app' | 'sbom_upload' | 'source_zip'
    status: string
    findingsCount: number
    deltaCount: number
    createdAt: Date
    updatedAt: Date
  }>,
  total: number
}
```

**Error Codes**:
- `401`: Unauthorized
- `422`: Invalid date format

---

### 8. getScanById

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Get detailed information about a specific scan

**Usage**:
```typescript
import { getScanById } from 'wasp/client/operations'

const { data: scan } = await getScanById({ scanId: "scan-123" })
```

**Parameters**:
```typescript
{
  scanId: string      // Scan UUID
}
```

**Response**:
```typescript
{
  id: string
  scanType: string
  status: string
  findings: Array<{
    id: string
    cveId: string
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    package: string
    version: string
    fixedVersion?: string
  }>
  severityBreakdown: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  createdAt: Date
  completedAt?: Date
  error?: string
}
```

**Error Codes**:
- `401`: Unauthorized
- `403`: Scan not owned by user
- `404`: Scan not found

---

### 9. submitScan

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Submit a new vulnerability scan

**Usage - GitHub App**:
```typescript
import { submitScan } from 'wasp/client/operations'

const result = await submitScan({
  scanType: 'github_app',
  githubRepo: 'owner/repo',
  githubBranch: 'main'
})
```

**Usage - SBOM Upload**:
```typescript
const result = await submitScan({
  scanType: 'sbom_upload',
  sbomContent: spdxContent,
  sbomFormat: 'spdx'
})
```

**Usage - Source ZIP**:
```typescript
const result = await submitScan({
  scanType: 'source_zip',
  zipFile: fileBlob,
  zipName: 'myapp.zip'
})
```

**Parameters**:
```typescript
{
  scanType: 'github_app' | 'sbom_upload' | 'source_zip'
  
  // For github_app:
  githubRepo?: string           // 'owner/repo'
  githubBranch?: string         // default: 'main'
  
  // For sbom_upload:
  sbomContent?: string          // SPDX/CycloneDX content
  sbomFormat?: 'spdx' | 'cyclonedx'
  
  // For source_zip:
  zipFile?: Blob
  zipName?: string
}
```

**Response**:
```typescript
{
  scanId: string
  status: 'queued'
  estimatedDurationSeconds: number
  quotaRemaining: number
  queuePosition: number
}
```

**Error Codes**:
- `401`: Unauthorized
- `402`: Quota exceeded
- `413`: File too large (max 100MB)
- `422`: Invalid input (missing required fields)
- `429`: Rate limited (max 10 scans/hour)

---

## Reports Operations

### 10. getReport

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Full vulnerability report with all details

**Usage**:
```typescript
import { getReport } from 'wasp/client/operations'

const { data: report } = await getReport({ scanId: "scan-123" })
```

**Parameters**:
```typescript
{
  scanId: string      // Scan UUID
}
```

**Response**:
```typescript
{
  scan: {
    id: string
    status: string
    createdAt: Date
  },
  findings: Array<{
    id: string
    cveId: string
    severity: string
    package: string
    version: string
    fixedVersion?: string
    description: string
    cvssScore: number
    source: 'free' | 'enterprise'
    isPaid: boolean
  }>,
  delta: {
    enterpriseOnly: Array<Finding>
    freeOnly: Array<Finding>
    common: Array<Finding>
  },
  severityBreakdown: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  },
  quotaUsage: number
}
```

**Note**: Starter plan sees `delta.enterpriseOnly` as count-only (no details)

**Error Codes**:
- `401`: Unauthorized
- `403`: Scan not owned by user
- `404`: Scan not found

---

### 11. getReportSummary

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Summary view (counts only, faster)

**Usage**:
```typescript
import { getReportSummary } from 'wasp/client/operations'

const { data: summary } = await getReportSummary({ 
  scanId: "scan-123" 
})
```

**Parameters**:
```typescript
{
  scanId: string
}
```

**Response**:
```typescript
{
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  deltaCount: number          // Enterprise only
  lastScannedAt: Date
  status: string
  completionPercentage: number
}
```

**Error Codes**:
- `401`: Unauthorized
- `404`: Scan not found

---

### 12. generateReportPDF

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Generate PDF report (async job)

**Usage**:
```typescript
import { generateReportPDF } from 'wasp/client/operations'

const { jobId } = await generateReportPDF({ 
  scanId: "scan-123",
  includeEnterprise: true
})

// Poll for completion
const checkJob = setInterval(async () => {
  const { status, url } = await checkReportJob({ jobId })
  if (status === 'completed') {
    clearInterval(checkJob)
    window.open(url, '_blank')
  }
}, 2000)
```

**Parameters**:
```typescript
{
  scanId: string
  includeEnterprise?: boolean     // Include delta findings
  format?: 'pdf'                  // Currently PDF only
}
```

**Response**:
```typescript
{
  jobId: string
  status: 'queued'
  estimatedSeconds: number
}
```

**Error Codes**:
- `401`: Unauthorized
- `403`: Scan not owned by user
- `404`: Scan not found

---

### 13. getCIDecision

**Type**: Query (read-only)  
**Auth Required**: Yes (or via API key header)  
**Scope**: CI/CD pipeline decision endpoint

**Usage**:
```typescript
// From CI/CD with API Key:
const response = await fetch('/.../reports/ci-decision', {
  headers: {
    'Authorization': `Bearer YOUR_API_KEY`,
    'X-Scan-ID': 'scan-123'
  }
})

const { decision, severity } = await response.json()
```

**Parameters**:
```typescript
{
  scanId: string
  // OR via X-Scan-ID header in API calls
}
```

**Response**:
```typescript
{
  decision: 'pass' | 'fail'
  severity: string
  message: string
  criticalCount: number
  highCount: number
  failThreshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
}
```

**Decision Logic**:
- `fail`: If any critical/high findings (configurable by plan)
- `pass`: All findings below fail threshold

**Error Codes**:
- `401`: Unauthorized
- `404`: Scan not found

---

## Webhooks Operations

### 14. createWebhook

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Register webhook endpoint for events

**Usage**:
```typescript
import { createWebhook } from 'wasp/client/operations'

const webhook = await createWebhook({
  url: 'https://your-api.com/webhook',
  events: ['scan.completed', 'scan.failed']
})
```

**Parameters**:
```typescript
{
  url: string                             // HTTPS only
  events: Array<
    'scan.submitted' | 
    'scan.completed' | 
    'scan.failed' |
    'delta.detected'
  >
  description?: string
  active?: boolean                        // default: true
}
```

**Response**:
```typescript
{
  id: string
  url: string
  events: string[]
  active: boolean
  secret: string                          // HMAC signing secret (save securely!)
  createdAt: Date
  lastTriggeredAt?: Date
  successCount: number
  failureCount: number
}
```

**Webhook Payload Format**:
```typescript
POST {url}
Headers:
  - X-VibeScan-Signature: sha256=HMAC_HEX_DIGEST
  - X-VibeScan-Delivery-ID: UUID
  - Content-Type: application/json

Body:
{
  event: 'scan.completed',
  timestamp: Date,
  data: {
    scanId: string
    userId: string
    status: string
    findings: number
    delta: number
    severity: object
  }
}
```

**Verify Signature**:
```typescript
import crypto from 'crypto'

const signature = request.headers['x-vibescan-signature']
const [algo, digest] = signature.split('=')
const computed = crypto
  .createHmac(algo, WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')

if (computed !== digest) throw new Error('Invalid signature')
```

**Error Codes**:
- `401`: Unauthorized
- `400`: Invalid URL (not HTTPS) or events
- `409`: Webhook already exists for this URL

---

### 15. listWebhooks

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: List all webhooks for user

**Usage**:
```typescript
import { listWebhooks } from 'wasp/client/operations'

const { data: webhooks } = await listWebhooks()
```

**Parameters**:
```typescript
{} // No parameters
```

**Response**:
```typescript
Array<{
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt: Date
  lastTriggeredAt?: Date
  successCount: number
  failureCount: number
}>
```

**Error Codes**:
- `401`: Unauthorized

---

### 16. getWebhook

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Get detailed webhook info + delivery history

**Usage**:
```typescript
import { getWebhook } from 'wasp/client/operations'

const { data: webhook } = await getWebhook({ 
  webhookId: "webhook-123" 
})
```

**Parameters**:
```typescript
{
  webhookId: string
}
```

**Response**:
```typescript
{
  id: string
  url: string
  events: string[]
  active: boolean
  secret: string                  // Not shown in plain text
  createdAt: Date
  lastTriggeredAt?: Date
  successCount: number
  failureCount: number
  deliveries: Array<{
    id: string
    event: string
    statusCode: number
    timestamp: Date
    nextRetry?: Date
    attempt: number
  }>
}
```

**Error Codes**:
- `401`: Unauthorized
- `404`: Webhook not found

---

### 17. updateWebhook

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Modify webhook configuration

**Usage**:
```typescript
import { updateWebhook } from 'wasp/client/operations'

await updateWebhook({
  webhookId: "webhook-123",
  active: false,
  events: ['scan.completed']
})
```

**Parameters**:
```typescript
{
  webhookId: string
  url?: string                    // Update endpoint URL
  events?: string[]               // Update subscribed events
  active?: boolean                // Enable/disable
  description?: string
}
```

**Response**:
```typescript
{
  id: string
  url: string
  events: string[]
  active: boolean
  updatedAt: Date
}
```

**Error Codes**:
- `401`: Unauthorized
- `404`: Webhook not found
- `400`: Invalid URL or events

---

### 18. deleteWebhook

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Remove webhook entirely

**Usage**:
```typescript
import { deleteWebhook } from 'wasp/client/operations'

await deleteWebhook({ webhookId: "webhook-123" })
```

**Parameters**:
```typescript
{
  webhookId: string
}
```

**Response**:
```typescript
{
  success: boolean
  deletedAt: Date
}
```

**Error Codes**:
- `401`: Unauthorized
- `404`: Webhook not found

---

## Billing Operations

### 19. getCustomerPortalUrl

**Type**: Query (read-only)  
**Auth Required**: Yes  
**Scope**: Get Stripe customer portal link for subscription management

**Usage**:
```typescript
import { getCustomerPortalUrl } from 'wasp/client/operations'

const { url } = await getCustomerPortalUrl()

// Redirect user:
window.location.href = url
```

**Parameters**:
```typescript
{} // No parameters
```

**Response**:
```typescript
{
  url: string                     // Stripe-hosted portal URL
  expiresAt: Date
}
```

**Error Codes**:
- `401`: Unauthorized
- `402`: No subscription (free user)
- `500`: Stripe API error

---

### 20. generateCheckoutSession

**Type**: Action (mutation)  
**Auth Required**: Yes  
**Scope**: Create Stripe checkout session for plan upgrade

**Usage**:
```typescript
import { generateCheckoutSession } from 'wasp/client/operations'

const { sessionUrl } = await generateCheckoutSession({
  plan: 'pro',
  billingPeriod: 'monthly'
})

// Redirect to Stripe:
window.location.href = sessionUrl
```

**Parameters**:
```typescript
{
  plan: 'free_trial' | 'starter' | 'pro' | 'enterprise'
  billingPeriod: 'monthly' | 'yearly'
  promoCode?: string              // Discount code
}
```

**Response**:
```typescript
{
  sessionUrl: string              // Stripe checkout URL
  sessionId: string
  expiresAt: Date
}
```

**Pricing** (per plan):
- `free_trial`: $0 (14 days)
- `starter`: $29/mo or $290/yr
- `pro`: $99/mo or $990/yr
- `enterprise`: Custom pricing (contact sales)

**Regional Pricing**:
- India (IN) / Pakistan (PK): 50% discount applied

**Error Codes**:
- `401`: Unauthorized
- `400`: Invalid plan
- `409`: Already subscribed to this plan
- `500`: Stripe API error

---

## General Error Responses

All operations follow consistent error format:

```typescript
{
  error: string                   // Machine-readable error code
  message: string                 // Human-readable message
  details?: object                // Additional context
  timestamp: Date
  traceId?: string                // For support tickets
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `unauthorized` | 401 | Missing/invalid auth token |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource doesn't exist |
| `validation_error` | 422 | Invalid input parameters |
| `rate_limited` | 429 | Too many requests |
| `quota_exceeded` | 402 | Plan limit reached |
| `internal_error` | 500 | Server error |

---

## Pagination

List operations support cursor-based pagination:

```typescript
{
  limit: number          // Items per page (default: 20, max: 100)
  offset: number         // Skip N items (default: 0)
  // OR
  cursor?: string        // Opaque cursor from previous response
  pageSize?: number      // Items per page
}
```

Response includes:
```typescript
{
  data: Array<T>
  total: number
  hasMore: boolean
  nextCursor?: string
}
```

---

## Retries & Idempotency

**Retryable Operations**:
- All queries are safely retryable
- Mutations with `Idempotency-Key` header are idempotent

**Idempotency**:
```typescript
const response = await submitScan(
  { /* args */ },
  { headers: { 'Idempotency-Key': crypto.randomUUID() } }
)
```

---

## Rate Limiting

All endpoints have per-user rate limits:

- **Free Plan**: 10 requests/minute, 100 scans/month
- **Starter**: 100 requests/minute, 500 scans/month
- **Pro**: 1000 requests/minute, 5000 scans/month
- **Enterprise**: Custom limits

Response headers indicate current limits:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703001234
```

---

## SDK Usage

### TypeScript/JavaScript Client

```typescript
import { 
  getScans, 
  submitScan, 
  getCIDecision 
} from 'wasp/client/operations'

// In React component:
const { data: scans, isLoading } = await getScans({ limit: 10 })

// Actions return promises:
const { scanId } = await submitScan({ 
  scanType: 'github_app',
  githubRepo: 'myorg/myrepo'
})
```

### cURL Examples

**List Scans**:
```bash
curl -X GET http://localhost:3555/api/scans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Submit GitHub Scan**:
```bash
curl -X POST http://localhost:3555/api/scans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scanType": "github_app",
    "githubRepo": "owner/repo",
    "githubBranch": "main"
  }'
```

**CI/CD Decision Check**:
```bash
curl -X GET http://localhost:3555/api/reports/ci-decision \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Scan-ID: scan-123"
```

---

## OpenAPI/Swagger

Interactive API documentation available at:
- **Dev**: http://localhost:3555/docs
- **Prod**: https://app.vibescan.app/docs

Download OpenAPI spec:
```bash
curl http://localhost:3555/openapi.json | jq .
```

---

**Last Updated**: April 2026  
**Wasp Version**: 0.23+  
**Node.js**: 24.14.1 LTS  
**Status**: Production Ready
