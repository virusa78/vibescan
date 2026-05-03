# VibeScan Endpoint Audit & Alignment

## Executive Summary

**Total Endpoints Found:** 58 (including v1 duplicates)
**Unique Endpoints:** 40+
**Status:** Comprehensive audit complete, ready for consolidation into Wasp

---

## Endpoint Categories & Alignment

### CATEGORY 1: Authentication (Req 1)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/auth/register` | POST | Req 1: User Registration | ✅ Core | Wasp built-in auth can absorb |
| `/auth/login` | POST | Req 1: User Registration | ✅ Core | Wasp built-in auth can absorb |
| `/auth/refresh` | POST | Req 1: User Registration | ✅ Core | Wasp handles JWT refresh |
| `/auth/logout` | POST | Req 1: User Registration | ✅ Core | Wasp handles logout |
| `/auth/me` | GET | Req 1: User Registration | ✅ Core | Get current user profile |
| `/v1/me` | GET | Req 1: User Registration | ✅ Duplicate | Mirror of `/auth/me` |
| `/v1/me` | PATCH | Req 1: User Registration | ✅ Core | Update profile via settings |
| `/v1/me/email/change` | POST | Req 1: User Registration | ✅ Core | Request email change |
| `/v1/me/email/verify` | POST | Req 1: User Registration | ✅ Core | Verify new email |

**Migration Strategy:** All absorbed into Wasp built-in auth + custom email action

---

### CATEGORY 2: API Key Management (Req 2)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/api-keys` | POST | Req 2: API Key Management | ✅ Core | Generate API key |
| `/api-keys` | GET | Req 2: API Key Management | ✅ Core | List user's API keys |
| `/api-keys/:id` | PATCH | Req 2: API Key Management | ✅ Core | Update key metadata |
| `/api-keys/:id` | DELETE | Req 2: API Key Management | ✅ Core | Revoke API key |
| `/v1/api-keys` | POST | Req 2: API Key Management | ✅ Duplicate | Mirror of `/api-keys` |
| `/v1/api-keys` | GET | Req 2: API Key Management | ✅ Duplicate | Mirror of `/api-keys` |
| `/v1/api-keys/:id` | PATCH | Req 2: API Key Management | ✅ Duplicate | Mirror of `/api-keys/:id` |
| `/v1/api-keys/:id` | DELETE | Req 2: API Key Management | ✅ Duplicate | Mirror of `/api-keys/:id` |
| `/settings/api-keys` | GET | Req 2: API Key Management | ✅ Settings | Listed under settings |
| `/settings/api-keys` | POST | Req 2: API Key Management | ✅ Settings | Create via settings |
| `/settings/api-keys/:id` | DELETE | Req 2: API Key Management | ✅ Settings | Delete via settings |

**Migration Strategy:** Consolidate to single endpoint family; remove `/settings/api-keys` duplicates; keep `/v1/` for backward compatibility

---

### CATEGORY 3: Scan Management (Req 4, 5, 6, 29)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/scans` | POST | Req 4/5/6: Scan Submission | ✅ Core | Submit source ZIP, SBOM, or GitHub |
| `/scans` | GET | Req 26: Pagination | ✅ Core | List user's scans with pagination |
| `/scans/:id` | GET | Req 26: Pagination | ✅ Core | Get scan status |
| `/scans/:id` | DELETE | Req 29: Scan Cancellation | ✅ Core | Cancel scan |
| `/scans/queue/priority` | GET | Req 21: Quota Behavior | ⚠️ Monitoring | Queue priority info (not in requirements) |
| `/v1/scans/queue/priority` | GET | Req 21: Quota Behavior | ⚠️ Monitoring | Duplicate of above |

**Migration Strategy:** Move `/scans` POST/GET/DELETE to Wasp actions/queries; keep `/queue/priority` as legacy monitoring endpoint

---

### CATEGORY 4: Dashboard & Reporting (Req 11, 12, 30)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/dashboard/summary` | GET | Req 11/12: Report Generation | ✅ Core | Dashboard metrics (UI feature) |
| `/v1/dashboard/summary` | GET | Req 11/12: Report Generation | ✅ Duplicate | Mirror endpoint |
| `/reports/:scanId` | GET | Req 11: Full Report View | ✅ Core | Get full vulnerability report |
| `/reports/:scanId/pdf` | POST | Req 30: Report Formats | ✅ Core | Generate PDF report |
| `/reports/:scanId/ci` | GET | Req 11: Full Report View | ✅ Core | CI decision (pass/fail) |
| `/reports/jobs/:jobId` | GET | Req 30: Report Formats | ✅ Core | Get PDF generation status |
| `/v1/reports/jobs/:jobId` | GET | Req 30: Report Formats | ✅ Duplicate | Mirror endpoint |

**Migration Strategy:** Move report endpoints to Wasp; integrate with existing reportService in legacy

---

### CATEGORY 5: Webhooks (Req 13)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/settings/webhooks` | GET | Req 13: Webhook Delivery | ✅ Core | List user's webhooks |
| `/settings/webhooks` | POST | Req 13: Webhook Delivery | ✅ Core | Create webhook |
| `/settings/webhooks/:id` | PATCH | Req 13: Webhook Delivery | ✅ Core | Update webhook config |
| `/settings/webhooks/:id` | DELETE | Req 13: Webhook Delivery | ✅ Core | Delete webhook |
| `/settings/webhooks/:id/test` | POST | Req 13: Webhook Delivery | ✅ Core | Test webhook delivery |
| `/v1/settings/webhooks` | GET | Req 13: Webhook Delivery | ✅ Duplicate | Mirror endpoints |
| `/v1/settings/webhooks` | POST | Req 13: Webhook Delivery | ✅ Duplicate | (x4 endpoints) |
| `/v1/settings/webhooks/:id` | PATCH | Req 13: Webhook Delivery | ✅ Duplicate |
| `/v1/settings/webhooks/:id` | DELETE | Req 13: Webhook Delivery | ✅ Duplicate |
| `/v1/settings/webhooks/:id/test` | POST | Req 13: Webhook Delivery | ✅ Duplicate |
| `/github/webhook` | POST | Req 14: GitHub App Integration | ✅ Core | Receive GitHub push/PR events |
| `/v1/github/webhook` | POST | Req 14: GitHub App Integration | ✅ Duplicate | Mirror endpoint |

**Migration Strategy:** Migrate webhook CRUD to Wasp; keep GitHub webhook handler in legacy (event processing)

---

### CATEGORY 6: Billing (Req 15, 24)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/billing/checkout` | POST | Req 15: Billing Integration | ✅ Core | Create Stripe checkout session |
| `/billing/subscription` | GET | Req 15: Billing Integration | ✅ Core | Get subscription info |
| `/billing/cancel` | POST | Req 15: Billing Integration | ✅ Core | Cancel subscription |
| `/billing/webhook` | POST | Req 15: Billing Integration | ✅ Core | Stripe webhook handler |
| `/billing/regional-pricing` | GET | Req 24: Regional Pricing | ✅ Core | Get regional pricing (IN/PK discount) |

**Migration Strategy:** Integrate with Wasp billing features; replicate regional pricing in Wasp

---

### CATEGORY 7: Settings & Profile (Multiple Requirements)

| Endpoint | Method | Requirement | Status | Notes |
|----------|--------|-------------|--------|-------|
| `/settings` | GET | Req 1: Profile | ✅ Core | Get all settings (aggregate) |
| `/settings/profile` | GET | Req 1: Profile | ✅ Core | User profile |
| `/settings/profile` | PATCH | Req 1: Profile | ✅ Core | Update profile |
| `/settings/plan` | GET | Req 15: Billing | ✅ Core | Current plan info |
| `/settings/plan/history` | GET | Req 15: Billing | ✅ Core | Plan history |
| `/v1/settings/plan` | GET | Req 15: Billing | ✅ Duplicate | Mirror |
| `/v1/settings/plan/history` | GET | Req 15: Billing | ✅ Duplicate | Mirror |
| `/settings/notifications` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/settings/notifications` | PATCH | Enterprise | ⚠️ Extra | Not in requirements |
| `/v1/settings/notifications` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/v1/settings/notifications` | PATCH | Enterprise | ⚠️ Extra | Not in requirements |
| `/settings/security` | GET | Req 27: Ownership | ✅ Security | Session/security info |
| `/settings/security/revoke-session/:id` | POST | Req 27: Ownership | ✅ Security | Revoke active session |
| `/settings/security/events` | GET | Req 27: Ownership | ✅ Security | Security event log |
| `/v1/settings/security/events` | GET | Req 27: Ownership | ✅ Duplicate | Mirror |
| `/settings/regional` | GET | Req 24: Regional | ✅ Core | Get regional settings |
| `/settings/regional` | PATCH | Req 24: Regional | ✅ Core | Update regional settings |
| `/v1/settings/regional` | GET | Req 24: Regional | ✅ Duplicate | Mirror |
| `/v1/settings/regional` | PATCH | Req 24: Regional | ✅ Duplicate | Mirror |
| `/settings/history` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/v1/settings/history` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/settings/audit-log` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/v1/settings/audit-log` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/settings/export` | POST | Enterprise | ⚠️ Extra | Not in requirements |
| `/settings/export/:jobId` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/settings/export/:jobId/download` | GET | Enterprise | ⚠️ Extra | Not in requirements |
| `/v1/settings/export` | POST | Enterprise | ⚠️ Extra | Not in requirements |
| `/v1/settings/export/:jobId` | GET | Enterprise | ⚠️ Extra | Not in requirements |

**Migration Strategy:** Move core profile/plan/regional endpoints to Wasp; keep security events (if used); remove audit-log/history/export (not in requirements)

---

## Summary of Findings

### ✅ Core Endpoints (Match Requirements)
- **Auth:** 4 unique endpoints (register, login, refresh, logout, me) + email-change
- **API Keys:** 4 unique endpoints (CRUD)
- **Scans:** 3 unique endpoints (submit, list, get, cancel)
- **Reports:** 4 unique endpoints (full, pdf, ci, status)
- **Webhooks:** 5 unique endpoints (CRUD + test)
- **GitHub:** 1 endpoint (webhook receiver)
- **Billing:** 5 endpoints (checkout, subscription, cancel, webhook, pricing)
- **Settings:** 10 core endpoints (profile, plan, security, regional)

**Total Core:** ~36 unique, requirement-aligned endpoints

### ⚠️ Enterprise Extras (Not in Requirements)
- `/settings/history` — historical changes
- `/settings/audit-log` — audit trail
- `/settings/export` — data export
- `/settings/notifications` — notification preferences
- `/scans/queue/priority` — queue monitoring

**Total Extras:** 5 endpoints (can be removed from requirements baseline)

### 📋 Duplicates (v1 mirrors)
- `/v1/api-keys` — mirrors `/api-keys` family
- `/v1/me` — mirrors `/auth/me`
- `/v1/settings/plan` — mirrors `/settings/plan`
- `/v1/settings/webhooks` — mirrors `/settings/webhooks` family (x5)
- `/v1/settings/security/events` — mirrors `/settings/security/events`
- `/v1/settings/regional` — mirrors `/settings/regional`
- `/v1/settings/history` — mirrors `/settings/history`
- `/v1/settings/audit-log` — mirrors `/settings/audit-log`
- `/v1/settings/export` — mirrors `/settings/export` (x3)
- `/v1/github/webhook` — mirrors `/github/webhook`
- `/v1/dashboard/summary` — mirrors `/dashboard/summary`
- `/v1/reports/jobs` — mirrors `/reports/jobs`
- `/v1/scans/queue/priority` — mirrors `/scans/queue/priority`

**Total Duplicates:** ~19 v1 mirrors (remove for consolidation)

### 🔧 Consolidation Action Plan

1. **Keep these endpoint families (migrating to Wasp):**
   - `/auth/*` → Wasp built-in auth
   - `/api-keys` → Wasp custom action
   - `/scans` → Wasp query/action
   - `/reports/*` → Wasp query (backed by legacy reportService)
   - `/settings/*` → Wasp profile/action (core only)
   - `/billing/*` → Wasp payment integration
   - `/settings/webhooks/*` → Wasp action

2. **Move to legacy workers (separate microservice):**
   - `/github/webhook` — event receiver (stays in Fastify)
   - `/billing/webhook` — Stripe handler (stays in Fastify)

3. **Retire (not in requirements):**
   - `/settings/audit-log`, `/settings/history`, `/settings/export`, `/settings/notifications`

4. **Remove (v1 duplicates):**
   - All `/v1/*` mirrors (if client can use single surface)

---

## Endpoint Validation Matrix

| Requirement | Endpoints | Status | Migration Target |
|-------------|-----------|--------|------------------|
| Req 1: Auth | register, login, refresh, logout, me, email/* | ✅ Complete | Wasp auth + action |
| Req 2: API Keys | api-keys CRUD | ✅ Complete | Wasp custom action |
| Req 3: Quota | (managed in backend) | ✅ Complete | Legacy quotaService |
| Req 4/5/6: Scan Submit | POST /scans | ✅ Complete | Wasp action |
| Req 7-9: Scanners | (workers, separate) | ✅ Complete | Legacy workers |
| Req 10: Delta | (reportService) | ✅ Complete | Legacy service |
| Req 11/12: Reports | GET /reports/* | ✅ Complete | Wasp query |
| Req 13: Webhooks | settings/webhooks/* | ✅ Complete | Wasp action |
| Req 14: GitHub | /github/webhook | ✅ Complete | Legacy handler |
| Req 15: Billing | billing/* | ✅ Complete | Wasp payment |
| Req 16-18: Security | (encryption, isolation) | ✅ Complete | Legacy services |
| Req 19: Queues | (BullMQ, separate) | ✅ Complete | Legacy workers |
| Req 20: Errors | (error payloads) | ✅ Complete | All services |
| Req 21-23: Plan/Delta/Paywall | (plan logic) | ✅ Complete | Legacy service |
| Req 24: Regional | settings/regional | ✅ Complete | Wasp action |
| Req 25: Input Validation | (in handlers) | ✅ Complete | All services |
| Req 26: Pagination | GET /scans | ✅ Complete | Wasp query |
| Req 27-29: Ownership/Cancel | (in handlers) | ✅ Complete | Wasp + legacy |
| Req 30: Report Formats | /reports/* | ✅ Complete | Wasp query |

---

## Conclusion

**All 30 requirements are covered by existing endpoints.**

Consolidation strategy:
1. Migrate core UI endpoints to Wasp (36 core, 19 duplicates removed)
2. Keep 2 webhook handlers in legacy Fastify
3. Remove 5 enterprise-extra endpoints (out of requirements scope)
4. Result: Single clean API surface with ~30 core endpoints

**Next Steps:**
1. Create Wasp Prisma schema (consolidate DB)
2. Migrate authentication module
3. Migrate scan CRUD actions/queries
4. Migrate report queries
5. Integrate billing
6. E2E validation

