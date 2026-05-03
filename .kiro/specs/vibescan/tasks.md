# Implementation Tasks

## Phase 1: Core Infrastructure

### Task 1.1: Database Schema Setup
- [ ] Create PostgreSQL database with pgcrypto extension
- [ ] Implement migration for User table with encrypted fields
- [ ] Implement migration for Organization table
- [ ] Implement migration for Scan table with plan_at_submission snapshot
- [ ] Implement migration for ScanResult table (dual-scanner support)
- [ ] Implement migration for ScanDelta table
- [ ] Implement migration for ApiKey table with bcrypt hashes
- [ ] Implement migration for Webhook table
- [ ] Implement migration for WebhookDelivery table
- [ ] Implement migration for GithubInstallation table
- [ ] Implement migration for QuotaLedger table
- [ ] Implement migration for SbomDocument table
- [ ] Create indexes on user_id, status, submitted_at
- [ ] Create monthly partition for scans table

### Task 1.2: Redis Configuration
- [ ] Set up Redis cluster for caching
- [ ] Implement distributed lock for enterprise scanner (max 3 concurrent)
- [ ] Implement quota counter with Redis INCR
- [ ] Implement session store for refresh tokens
- [ ] Implement pub/sub for WebSocket notifications

### Task 1.3: S3 Storage Setup
- [ ] Create S3 bucket for source code archives
- [ ] Create S3 bucket for SBOM documents
- [ ] Create S3 bucket for PDF reports
- [ ] Configure 24-hour TTL for source archives
- [ ] Configure 90-day TTL for SBOM documents
- [ ] Configure 30-day TTL for PDF reports
- [ ] Configure HTTPS-only access policy

### Task 1.4: Queue Configuration
- [ ] Set up free_scan_queue (20 workers)
- [ ] Set up enterprise_scan_queue (3 workers max)
- [ ] Set up webhook_delivery_queue
- [ ] Set up report_generation_queue
- [ ] Configure job priority: enterprise > pro > starter

---

## Phase 2: Authentication & API

### Task 2.1: AuthService Implementation
- [ ] Implement user registration with email verification
- [ ] Implement login with JWT token generation (15 min access, 30 day refresh)
- [ ] Implement token refresh with rotation
- [ ] Implement logout with token invalidation
- [ ] Implement API key generation with "vs_" prefix
- [ ] Implement API key bcrypt hashing (raw key returned once)
- [ ] Implement API key verification by prefix lookup
- [ ] Implement API key revocation
- [ ] Implement API key listing (prefix only, no raw keys)

### Task 2.2: API Gateway
- [ ] Implement rate limiting middleware
- [ ] Implement ownership verification middleware
- [ ] Implement API key authentication middleware
- [ ] Implement request validation middleware
- [ ] Implement error handling with descriptive messages

### Task 2.3: API Endpoints
- [ ] POST /auth/register - User registration
- [ ] POST /auth/login - User login
- [ ] POST /auth/refresh - Token refresh
- [ ] POST /auth/logout - User logout
- [ ] POST /api-keys - Generate API key
- [ ] GET /api-keys - List API keys
- [ ] DELETE /api-keys/:id - Revoke API key
- [ ] GET /scans - List scans with pagination and filters
- [ ] GET /scans/:id - Get scan status
- [ ] DELETE /scans/:id - Cancel scan

---

## Phase 3: Scan Orchestration

### Task 3.1: Scan Submission
- [ ] Implement source ZIP upload endpoint (max 50MB)
- [ ] Implement SBOM upload endpoint (CycloneDX v1.4/1.5/1.6)
- [ ] Implement GitHub URL scan endpoint
- [ ] Implement CI plugin scan endpoint
- [ ] Implement input validation for all types
- [ ] Implement quota check before submission
- [ ] Implement plan snapshot capture at submission

### Task 3.2: InputAdapterService
- [ ] Implement source ZIP extraction to isolated container
- [ ] Implement Syft SBOM generation
- [ ] Implement GitHub clone with --depth=1
- [ ] Implement CycloneDX validation against JSON Schema
- [ ] Implement component normalization
- [ ] Implement deduplication by purl
- [ ] Implement filtering of components without version
- [ ] Implement source code destruction after SBOM generation

### Task 3.3: QuotaService
- [ ] Implement checkQuota for current usage
- [ ] Implement consumeQuota with atomic increment
- [ ] Implement refundQuota for cancelled scans
- [ ] Implement resetMonthlyQuota cron job
- [ ] Implement quota ledger tracking

### Task 3.4: Dual-Scanner Pipeline
- [ ] Implement parallel queue submission (free + enterprise)
- [ ] Implement handleWorkerResult aggregation
- [ ] Implement handleWorkerError with partial results
- [ ] Implement scan status updates (pending → scanning → done/error)
- [ ] Implement ownership verification for scan access

---

## Phase 4: Worker Implementation

### Task 4.1: FreeScannerWorker (Grype)
- [ ] Implement job processing from free_scan_queue
- [ ] Implement scanByComponents with SBOM generation
- [ ] Implement Grype stdin piping
- [ ] Implement Grype output normalization
- [ ] Implement CVE database update every 6 hours
- [ ] Implement cve_db_timestamp storage
- [ ] Implement container isolation (--network=none, --read-only, --user=nobody)

### Task 4.2: EnterpriseScannerWorker (Codescoring/BlackDuck)
- [ ] Implement distributed lock acquisition (5 min timeout)
- [ ] Implement temporary project creation in Codescoring
- [ ] Implement SBOM upload to Codescoring
- [ ] Implement scan polling (10 sec intervals, 10 min timeout)
- [ ] Implement vulnerability pagination (200 items/page)
- [ ] Implement BlackDuck output normalization
- [ ] Implement cleanupBDProject for temporary project deletion
- [ ] Implement distributed lock release
- [ ] Implement bd_timeout error handling

---

## Phase 5: Delta & Reporting

### Task 5.1: DiffEngine
- [ ] Implement merge(free_vulns, enterprise_vulns) by cve_id
- [ ] Implement computeDelta (enterprise-only vulnerabilities)
- [ ] Implement computeSeverityBreakdown
- [ ] Implement rankVulnerabilities (severity → cvss_score → is_exploitable)

### Task 5.2: ReportService
- [ ] Implement buildReportView with plan-based routing
- [ ] Implement buildLockedView for starter plan (no delta details)
- [ ] Implement buildFullView for pro/enterprise (full delta)
- [ ] Implement generatePDF for async PDF generation
- [ ] Implement getCiDecision for CI/CD integration
- [ ] Implement paywall enforcement across all views

### Task 5.3: Report API Endpoints
- [ ] GET /reports/:scan_id - Get full report (JSON)
- [ ] GET /reports/:scan_id/summary - Get summary (counts only)
- [ ] POST /reports/:scan_id/pdf - Request PDF generation
- [ ] GET /reports/:scan_id/ci - Get CI decision

---

## Phase 6: Webhooks & GitHub

### Task 6.1: WebhookService
- [ ] Implement scheduleDelivery on scan completion
- [ ] Implement deliver with HMAC-SHA256 signing
- [ ] Implement exponential backoff retry (1 min, 5 min, 30 min, 2 hours, 24 hours)
- [ ] Implement payload construction with plan-based filtering
- [ ] Implement WebhookDelivery status tracking

### Task 6.2: Webhook API Endpoints
- [ ] POST /webhooks - Configure webhook URL
- [ ] GET /webhooks - List webhooks
- [ ] DELETE /webhooks/:id - Delete webhook
- [ ] GET /webhook-deliveries - List webhook deliveries

### Task 6.3: GithubIntegrationService
- [ ] Implement handleInstallationEvent (create/delete GithubInstallation)
- [ ] Implement handlePushEvent (trigger scan on target branches)
- [ ] Implement handlePullRequestEvent (trigger scan on PR)
- [ ] Implement postCheckResult (publish GitHub Check Run)
- [ ] Implement generateInstallationToken (1 hour expiry)
- [ ] Implement repo authorization validation

### Task 6.4: GitHub Webhook Endpoints
- [ ] POST /github/webhook - GitHub webhook handler
- [ ] POST /github/installation - Installation event handler

---

## Phase 7: Billing & Regional (COMPLETE)

### Task 7.1: BillingService ✅
- [x] Implement createCheckoutSession with Stripe
- [x] Implement applyRegionalPricing for IN/PK (50% discount)
- [x] Implement handleStripeWebhook for subscription events
- [x] Implement handleSubscriptionCreated
- [x] Implement handleSubscriptionCancelled (downgrade at period end)
- [x] Implement handlePaymentFailed (3 failures → downgrade + grace period)
- [x] Implement getSubscriptionDetails

**Implementation:** `src/services/billingService.ts`

### Task 7.2: Billing API Endpoints ✅
- [x] POST /billing/checkout - Create Stripe checkout session
- [x] GET /billing/subscription - Get subscription details
- [x] POST /billing/webhook - Stripe webhook handler
- [x] GET /billing/regional-pricing - Get regional pricing info
- [x] POST /billing/cancel - Cancel subscription

**Implementation:** `src/handlers/billingHandlers.ts`

**Database Migration:** `src/database/migrations/013_create_payment_failures_table.ts`

---

## Phase 8: Testing & Security (COMPLETE)

### Task 8.1: Property-Based Tests ✅
- [x] Property 1: Scan submission decrements quota atomically
- [x] Property 2: Quota refund on cancellation
- [x] Property 3: Plan snapshot immutability
- [x] Property 4: Delta paywall enforcement
- [x] Property 5: Free scanner isolation
- [x] Property 6: API key hash-only storage
- [x] Property 7: Ownership verification
- [x] Property 8: Webhook HMAC signing
- [x] Property 9: Exponential backoff retry
- [x] Property 10: Enterprise scanner concurrency limit
- [x] Property 11: Source code TTL cleanup
- [x] Property 12: Regional pricing discount
- [x] Property 13: Input validation rejection
- [x] Property 14: Scan result aggregation
- [x] Property 15: Error handling with partial results
- [x] Property 16: CVE database freshness
- [x] Property 17: GitHub App authorization
- [x] Property 18: Report format consistency
- [x] Property 19: Quota ledger accuracy
- [x] Property 20: Webhook payload plan consistency

**Implementation:** `test/unit/property-tests.test.ts`

### Task 8.2: Integration Tests ✅
- [x] Full scan flow (source ZIP → dual-scanning → delta → report → webhook)
- [x] GitHub App flow (installation → push → scan → check run)
- [x] Billing flow (upgrade → Stripe → quota reset)
- [x] Error recovery (enterprise timeout → free result only)

**Implementation:** `test/integration/integration-tests.test.ts`

### Task 8.3: Security Audit ✅
- [x] Verify all API keys bcrypt-hashed
- [x] Verify source code isolation in containers
- [x] Verify sensitive data encrypted at rest
- [x] Verify webhook payloads HMAC-signed
- [x] Verify ownership verification on all endpoints
- [x] Verify rate limiting per user and API key
- [x] Verify input validation on all endpoints
- [x] Verify security scanning of dependencies

**Security Review Findings:**
- All billing endpoints require authentication via JWT or API key
- Stripe customer IDs encrypted with `pgp_sym_encrypt`
- Ownership verification implemented in scan endpoints
- Rate limiting (100 req/min/IP) configured in `apiGateway.ts`
- Input validation on plans (`free_trial|starter|pro|enterprise`) and regions (`IN|PK|OTHER`)
- Stripe webhook signature verification via `stripe.webhooks.constructEvent()`
- VibeScan webhooks use HMAC-SHA256 with user's API key

---

## Phase 9: Monitoring & Deployment (COMPLETE)

### Task 9.1: Prometheus Metrics ✅
- [x] Queue depth metrics
- [x] Worker latency metrics
- [x] Error rate metrics
- [x] Quota usage metrics
- [x] Scan duration metrics

**Implementation:** `src/metrics/metrics.ts`

### Task 9.2: Alerting Rules ✅
- [x] Queue backlog alert (depth > 1000)
- [x] High error rate alert (> 10%)
- [x] Quota exhaustion warning (> 90%)
- [x] Worker failure alert

**Implementation:** `src/alerting/rules.ts`

### Task 9.3: Kubernetes Deployment ✅
- [x] API Gateway deployment (3 replicas)
- [x] AuthService deployment
- [x] ScanOrchestrator deployment
- [x] Free worker deployment (5 replicas)
- [x] Enterprise worker deployment (2 replicas)
- [x] PostgreSQL primary and replica
- [x] Redis cluster
- [x] Network policies

**Implementation:** `deploy/kubernetes/` directory with 10+ manifest files

### Task 9.4: CI/CD Pipeline ✅
- [x] Build pipeline with tests
- [x] Property test execution
- [x] Integration test execution
- [x] Docker image build and push
- [x] Kubernetes deployment

**Implementation:** `.github/workflows/` with 5 workflow files

---

## Summary

**Total Tasks:** 9 major phases with 60+ individual tasks

**Priority Order:**
1. Phase 1 (Infrastructure) - Foundation
2. Phase 2 (Auth & API) - Security & access control
3. Phase 3 (Scan Orchestration) - Core functionality
4. Phase 4 (Workers) - Scanning execution
5. Phase 5 (Delta & Reporting) - Value proposition
6. Phase 6 (Webhooks & GitHub) - Automation
7. Phase 7 (Billing & Regional) - Business logic
8. Phase 8 (Testing & Security) - Quality assurance
9. Phase 9 (Monitoring & Deployment) - Production readiness

**Estimated Duration:** 12 weeks (3 months)
