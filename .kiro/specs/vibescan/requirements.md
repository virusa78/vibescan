# Requirements Document

## Introduction

VibeScan is a SaaS vulnerability scanning platform that scans software components for security vulnerabilities using both free (Grype) and enterprise (Codescoring/BlackDuck) scanners. The platform provides dual-scanner architecture with delta comparison to show enterprise-only vulnerabilities, tiered pricing models, GitHub integration for automated scanning, webhook notifications, and API keys for CI/CD integration.

Key capabilities include:
- Dual-scanner architecture running Grype and Codescoring/BlackDuck in parallel
- Delta comparison showing vulnerabilities found only by enterprise scanner
- Tiered pricing: free_trial, starter, pro, enterprise
- GitHub App integration for automatic scanning on push/PR events
- Webhook notifications with HMAC-SHA256 signing
- API keys for CI/CD integration with bcrypt-hashed storage
- Source code isolation: code never leaves isolated containers
- Quota management with monthly resets
- Regional pricing for India (IN) and Pakistan (PK)

## Glossary

- **VibeScan**: The vulnerability scanning SaaS platform
- **Grype**: Free open-source vulnerability scanner for container images and file systems
- **Codescoring/BlackDuck**: Enterprise vulnerability scanner with comprehensive CVE database
- **Scan**: A single vulnerability scanning job submitted by a user
- **ScanResult**: Results from a single scanner (free or enterprise) for a scan
- **ScanDelta**: Comparison result showing vulnerabilities found only by enterprise scanner
- **Vulnerability**: A security issue identified by a scanner with CVE/GHSA ID, severity, and details
- **SBOM**: Software Bill of Materials in CycloneDX format
- **User**: Platform user with a specific plan tier
- **Organization**: Team entity for enterprise plans with multiple members
- **Webhook**: HTTP endpoint configured by user to receive scan results
- **API Key**: Cryptographic key for CI/CD integration, stored as bcrypt hash
- **Quota**: Monthly scan limit based on user plan
- **Delta Vulnerabilities**: Enterprise-only vulnerabilities not found by free scanner
- **Paywall**: Feature restriction based on user plan tier

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a prospective user, I want to register with VibeScan and authenticate, so that I can access the scanning platform.

#### Acceptance Criteria

1. WHEN a new user provides valid email and password, THE AuthService SHALL create a User record with bcrypt-hashed password and send verification email
2. WHEN a user provides valid credentials, THE AuthService SHALL return access_token (15 minutes) and refresh_token (30 days)
3. WHEN a refresh_token is provided, THE AuthService SHALL rotate tokens and invalidate the old refresh_token
4. IF a user provides invalid credentials, THEN THE AuthService SHALL return 401 Unauthorized
5. WHERE a user wants to logout, THE AuthService SHALL invalidate the refresh_token immediately

### Requirement 2: API Key Management

**User Story:** As a developer, I want to generate and manage API keys for CI/CD integration, so that I can automate vulnerability scanning without exposing credentials.

#### Acceptance Criteria

1. WHEN a user requests an API key, THE AuthService SHALL generate a cryptographically random key with "vs_" prefix, return the raw key once, and store only bcrypt hash
2. WHEN an API key is provided for authentication, THE AuthService SHALL verify by prefix lookup and bcrypt hash comparison
3. WHERE a user wants to revoke an API key, THE AuthService SHALL set revoked_at timestamp and immediately invalidate the key
4. WHEN listing API keys, THE AuthService SHALL return key_id, key_prefix, label, scopes, last_used_at, and revoked_at without exposing raw keys
5. IF an API key is expired or revoked, THEN THE AuthService SHALL reject authentication attempts

### Requirement 3: Quota Management

**User Story:** As a user, I want to understand my scan limits and usage, so that I can plan my scanning activities.

#### Acceptance Criteria

1. WHEN a scan is submitted, THE QuotaService SHALL check current usage against plan limit and return {allowed, remaining, reset_at}
2. IF quota is exceeded, THEN THE QuotaService SHALL reject submission with {remaining: 0, reset_at}
3. WHEN a scan job is successfully queued, THE QuotaService SHALL atomically increment scans_used counter
4. WHERE a scan is cancelled before execution, THE QuotaService SHALL decrement scans_used to refund quota
5. ON the first day of each month at 00:00, THE QuotaService SHALL reset quota for all users by creating new QuotaLedger records

### Requirement 4: Scan Submission - Source ZIP

**User Story:** As a user, I want to upload source code as a ZIP file for scanning, so that I can analyze my project's dependencies.

#### Acceptance Criteria

1. WHEN a user uploads a source ZIP file, THE ScanOrchestrator SHALL accept the upload, validate size (max 50MB), and return 202 Accepted with scan_id
2. IF the ZIP file exceeds 50MB, THEN THE ScanOrchestrator SHALL return 413 Payload Too Large
3. WHEN a valid ZIP is received, THE InputAdapterService SHALL extract to isolated container, run Syft to generate SBOM, and return normalized components
4. WHERE source code is processed, THE InputAdapterService SHALL ensure code exists only within container and is destroyed after SBOM generation
5. WHEN components are extracted, THE InputAdapterService SHALL deduplicate by purl and filter components without version

### Requirement 5: Scan Submission - SBOM Upload

**User Story:** As a developer, I want to upload a CycloneDX SBOM directly, so that I can skip source code upload for known dependency lists.

#### Acceptance Criteria

1. WHEN a CycloneDX SBOM document is submitted, THE InputAdapterService SHALL validate against JSON Schema v1.4/1.5/1.6
2. IF validation fails, THEN THE InputAdapterService SHALL return {error: 'invalid_sbom', validation_errors: [...]}
3. WHEN a valid SBOM is provided, THE InputAdapterService SHALL normalize components and create Scan record
4. WHERE an SBOM is submitted, THE ScanOrchestrator SHALL skip source code processing and proceed directly to scanning
5. THE SbomDocument record SHALL store spec_version, serial_number, component_count, tool_name, tool_version, and raw_s3_key for audit

### Requirement 6: Scan Submission - GitHub Integration

**User Story:** As a user with GitHub App installed, I want to trigger scans from GitHub repositories, so that I can scan specific commits or branches.

#### Acceptance Criteria

1. WHEN a GitHub scan request is submitted with installation_id, repo, and ref, THE ScanOrchestrator SHALL validate GitHub App authorization
2. IF the installation is not authorized for the specified repo, THEN THE ScanOrchestrator SHALL return 403 Forbidden
3. WHEN authorization succeeds, THE GithubIntegrationService SHALL generate installation access token and clone specific commit with --depth=1
4. WHERE a GitHub URL scan is submitted, THE InputAdapterService SHALL generate SBOM via Syft in isolated container and destroy local copy immediately
5. WHEN components are extracted, THE ScanOrchestrator SHALL proceed with dual-scanning pipeline

### Requirement 7: Dual-Scanner Architecture

**User Story:** As VibeScan, I want to run both free and enterprise scanners in parallel, so that I can provide comprehensive vulnerability coverage.

#### Acceptance Criteria

1. WHEN a scan is submitted, THE ScanOrchestrator SHALL queue parallel jobs to free_scan_queue and enterprise_scan_queue
2. WHERE a scan job is queued, THE ScanOrchestrator SHALL set scan status to pending and increment quota
3. WHEN a free scanner completes, THE ScanOrchestrator SHALL call handleWorkerResult with source="free" and save ScanResult
4. WHEN an enterprise scanner completes, THE ScanOrchestrator SHALL call handleWorkerResult with source="enterprise" and save ScanResult
5. IF only enterprise scanner fails, THEN THE ScanOrchestrator SHALL finalize with partial results (free only)
6. IF both scanners fail, THEN THE ScanOrchestrator SHALL set scan status to error

### Requirement 8: Free Scanner Worker (Grype)

**User Story:** As a scanning worker, I want to use Grype to scan components, so that I can provide free vulnerability detection.

#### Acceptance Criteria

1. WHEN a scan job is received, THE FreeScannerWorker SHALL call scanByComponents with normalized component list
2. WHERE components are scanned, THE FreeScannerWorker SHALL build SBOM from components and pipe to Grype via stdin without network access
3. WHEN Grype output is received, THE FreeScannerWorker SHALL normalize to Vulnerability[] array with source="free"
4. ON a scheduled basis (every 6 hours), THE FreeScannerWorker SHALL update CVE database via grype db update
5. THE cve_db_timestamp SHALL be stored in ScanResult for transparency on database age

### Requirement 9: Enterprise Scanner Worker (Codescoring/BlackDuck)

**User Story:** As a scanning worker, I want to use Codescoring/BlackDuck API to scan components, so that I can provide enterprise-grade vulnerability coverage.

#### Acceptance Criteria

1. WHEN a scan job is received, THE EnterpriseScannerWorker SHALL acquire distributed lock via Redis before scanning
2. IF lock cannot be acquired within 5 minutes, THEN THE EnterpriseScannerWorker SHALL retry the job
3. WHERE a lock is acquired, THE EnterpriseScannerWorker SHALL create temporary project in Codescoring, upload SBOM, and start async scan
4. WHEN scan completion is polled, THE EnterpriseScannerWorker SHALL poll every 10 seconds for up to 10 minutes
5. IF timeout occurs, THEN THE EnterpriseScannerWorker SHALL return error code bd_timeout for partial result handling
6. WHEN vulnerabilities are fetched, THE EnterpriseScannerWorker SHALL paginate through 200-item pages until complete
7. WHERE results are received, THE EnterpriseScannerWorker SHALL normalize to Vulnerability[] with source="enterprise"
8. WHEN processing completes, THE EnterpriseScannerWorker SHALL cleanupBDProject to delete temporary Codescoring project
9. WHERE concurrency is managed, THE EnterpriseScannerWorker SHALL maintain max 3 parallel BD requests via distributed lock

### Requirement 10: Delta Comparison Engine

**User Story:** As VibeScan, I want to compare free and enterprise scan results to identify enterprise-only vulnerabilities, so that I can demonstrate value of enterprise tier.

#### Acceptance Criteria

1. WHEN both scan results are available, THE DiffEngine SHALL merge free_vulns and enterprise_vulns by cve_id, preferring enterprise versions
2. WHERE merge is complete, THE DiffEngine SHALL compute delta by comparing cve_ids and returning only enterprise-found vulnerabilities
3. WHEN delta is computed, THE DiffEngine SHALL calculate severity breakdown {CRITICAL: N, HIGH: N, MEDIUM: N, LOW: N}
4. WHERE vulnerabilities are ranked, THE DiffEngine SHALL sort by severity (CRITICAL→LOW), then cvss_score DESC, then is_exploitable DESC
5. THE ScanDelta record SHALL store total_free_count, total_enterprise_count, delta_count, delta_by_severity, and delta_vulnerabilities

### Requirement 11: Report Generation - Full View

**User Story:** As a pro or enterprise user, I want to see complete scan results including delta vulnerabilities, so that I can prioritize remediation.

#### Acceptance Criteria

1. WHEN a report is requested for pro/enterprise user, THE ReportService SHALL call buildFullView with full delta vulnerabilities
2. WHERE full view is built, THE ReportService SHALL return enterprise_vulns array with all details and delta_vulnerabilities with full details
3. WHEN PDF generation is requested, THE ReportService SHALL generate PDF with executive summary, full vulnerability table, delta section, and prioritization recommendations
4. WHERE CI decision is requested, THE ReportService SHALL return {pass, max_severity, blocking_count, exit_code} based on threshold severity
5. THE ReportService SHALL rank vulnerabilities using DiffEngine.rankVulnerabilities for display order

### Requirement 12: Report Generation - Locked View

**User Story:** As a starter plan user, I want to see free vulnerabilities and delta counts but not delta details, so that I understand my risk level without accessing enterprise features.

#### Acceptance Criteria

1. WHEN a report is requested for starter user, THE ReportService SHALL call buildLockedView with scan_delta
2. WHERE locked view is built, THE ReportService SHALL return free_vulns array with all details but delta_count and delta_by_severity only
3. IF delta vulnerabilities are accessed, THEN THE ReportService SHALL NOT expose any delta_vulnerabilities details to starter plan
4. WHEN webhook payload is built for starter user, THE WebhookService SHALL exclude delta details from payload
5. THE ScanDelta.is_locked field SHALL be true for starter plan users

### Requirement 13: Webhook Delivery

**User Story:** As a user, I want to receive scan results via webhook, so that I can integrate scanning into my CI/CD pipeline.

#### Acceptance Criteria

1. WHEN a scan completes, THE WebhookService SHALL check if user has webhook_url configured
2. WHERE webhook is configured, THE WebhookService SHALL create WebhookDelivery record and queue delivery job
3. WHEN delivery is attempted, THE WebhookService SHALL POST to target_url with HMAC-SHA256 signature in X-VibeScan-Signature header
4. IF delivery fails, THE WebhookService SHALL implement exponential backoff: 1 min, 5 min, 30 min, 2 hours, 24 hours
5. WHERE 5 attempts are exhausted, THE WebhookService SHALL set status to exhausted and notify user
6. WHEN payload is built for starter plan, THE WebhookService SHALL exclude delta_vulnerabilities details

### Requirement 14: GitHub App Integration

**User Story:** As a user, I want to install GitHub App and receive automatic scans on push/PR events, so that I can enforce security gates.

#### Acceptance Criteria

1. WHEN GitHub sends installation event, THE GithubIntegrationService SHALL create or delete GithubInstallation record
2. WHEN GitHub sends push event, THE GithubIntegrationService SHALL check if branch matches target_branches and generate installation token
3. WHERE push event matches, THE GithubIntegrationService SHALL create Scan with input_type=github_app and trigger pipeline
4. WHEN GitHub sends pull request event, THE GithubIntegrationService SHALL create Scan and trigger pipeline
5. WHEN scan completes, THE GithubIntegrationService SHALL call postCheckResult to publish GitHub Check Run with results
6. WHERE check run is posted, THE GithubIntegrationService SHALL include pass/fail status, vulnerability summary table, and full report link

### Requirement 15: Billing Integration

**User Story:** As a user, I want to upgrade my plan and manage subscription, so that I can access more features and higher quotas.

#### Acceptance Criteria

1. WHEN a user requests checkout, THE BillingService SHALL create Stripe Checkout Session with appropriate price_id
2. WHERE user region is IN or PK, THE BillingService SHALL apply 50% PPP discount via Stripe Coupon
3. WHEN Stripe subscription_created webhook is received, THE BillingService SHALL update User.plan and create new QuotaLedger
4. WHEN Stripe subscription_cancelled webhook is received, THE BillingService SHALL schedule plan downgrade at period end (not immediately)
5. WHERE payment fails 3 times, THE BillingService SHALL downgrade to starter, notify user, and grant 7-day grace period
6. WHEN subscription details are requested, THE BillingService SHALL return {plan, status, current_period_end, cancel_at_period_end}

### Requirement 16: Security - Source Code Isolation

**User Story:** As VibeScan, I want to ensure source code never leaves isolated containers, so that user code remains confidential.

#### Acceptance Criteria

1. WHERE source ZIP is processed, THE InputAdapterService SHALL extract to isolated Docker container with --network=none, --read-only, --user=nobody
2. WHERE GitHub URL is cloned, THE InputAdapterService SHALL use --depth=1 for single commit and destroy local copy immediately after SBOM generation
3. WHERE SBOM upload is used, THE InputAdapterService SHALL skip source code processing entirely
4. WHEN container processing completes, THE FreeScannerWorker AND EnterpriseScannerWorker SHALL destroy container immediately
5. THE S3 storage SHALL NOT store source code archives longer than 24 hours (TTL auto-deletion)

### Requirement 17: Security - API Key Storage

**User Story:** As VibeScan, I want to store API keys only as bcrypt hashes, so that even database compromise cannot expose keys.

#### Acceptance Criteria

1. WHEN API key is generated, THE AuthService SHALL generate cryptographically random key, store key_prefix (first 8 chars) and bcrypt hash, return raw key once
2. WHERE API key is verified, THE AuthService SHALL look up by prefix, compare bcrypt hash, and reject if hash mismatch
3. IF raw key is lost, THE AuthService SHALL require user to generate new key (cannot recover)
4. WHEN listing API keys, THE AuthService SHALL return key_prefix but never raw_key or key_hash
5. THE ApiKey table SHALL store key_hash (bcrypt), key_prefix, scopes, expires_at, revoked_at

### Requirement 18: Security - Data Encryption

**User Story:** As VibeScan, I want to encrypt sensitive data at rest, so that database backups cannot expose user information.

#### Acceptance Criteria

1. WHERE Stripe IDs are stored, THE PostgreSQL SHALL encrypt stripe_customer_id and stripe_subscription_id via pgcrypto
2. WHERE API key hashes are stored, THE PostgreSQL SHALL encrypt key_hash via pgcrypto
3. WHERE webhook signing secrets are stored, THE PostgreSQL SHALL encrypt signing_secret via pgcrypto
4. THE encryption keys SHALL be managed separately from database (e.g., AWS KMS or HashiCorp Vault)

### Requirement 19: Scalability - Queue Architecture

**User Story:** As VibeScan, I want to use queues for scan processing, so that I can scale workers independently.

#### Acceptance Criteria

1. WHERE free scans are queued, THE free_scan_queue SHALL support 20 concurrent workers with high throughput
2. WHERE enterprise scans are queued, THE enterprise_scan_queue SHALL limit concurrency to 3 due to Codescoring license restrictions
3. WHERE webhook deliveries are queued, THE webhook_delivery_queue SHALL operate independently from scan queues
4. WHERE PDF generation is queued, THE report_generation_queue SHALL handle async PDF generation without blocking scans
5. WHEN job priority is set, THE enterprise plan jobs SHALL have higher priority than pro > starter

### Requirement 20: Reliability - Error Handling

**User Story:** As VibeScan, I want to handle scanner errors gracefully, so that single failures don't break entire pipeline.

#### Acceptance Criteria

1. WHEN free scanner fails, THE ScanOrchestrator SHALL log error and continue with enterprise result if available
2. WHEN enterprise scanner fails, THE ScanOrchestrator SHALL log error and finalize with free result only
3. WHEN both scanners fail, THE ScanOrchestrator SHALL set scan status to error with error_message
4. WHERE Codescoring timeout occurs, THE EnterpriseScannerWorker SHALL return bd_timeout error code for partial result handling
5. WHEN quota check fails, THE ScanOrchestrator SHALL return 429 Too Many Requests with {remaining, reset_at}

### Requirement 21: Quota Behavior

**User Story:** As VibeScan, I want to decrement quota only on job submission, not completion, so that scanner errors don't consume quota.

#### Acceptance Criteria

1. WHEN a scan is submitted successfully, THE QuotaService SHALL decrement quota immediately via atomic increment
2. IF a scan fails before queuing, THE QuotaService SHALL NOT decrement quota
3. IF a scan fails after queuing, THE QuotaService SHALL NOT refund quota (already consumed)
4. WHERE a scan is cancelled before execution, THE QuotaService SHALL refund quota via decrement
5. THE quota_ledger.scans_used SHALL reflect jobs submitted, not jobs completed

### Requirement 22: Plan Snapshot at Submission

**User Story:** As VibeScan, I want to snapshot user plan at scan submission, so that plan changes during scanning don't affect results.

#### Acceptance Criteria

1. WHEN a scan is submitted, THE ScanOrchestrator SHALL capture User.plan and store in Scan.plan_at_submission
2. WHERE report is generated, THE ReportService SHALL use Scan.plan_at_submission to determine view type (locked vs full)
3. IF user downgrades during scan, THE ReportService SHALL still show view based on plan_at_submission
4. WHERE webhook is delivered, THE WebhookService SHALL use Scan.plan_at_submission to determine payload content
5. THE Scan.plan_at_submission field SHALL be immutable after submission

### Requirement 23: Delta Paywall Enforcement

**User Story:** As VibeScan, I want to enforce delta paywall across all interfaces, so that starter users never see enterprise-only vulnerabilities.

#### Acceptance Criteria

1. WHEN API returns scan results, THE ReportService SHALL return locked view for starter plan (no delta_vulnerabilities details)
2. WHEN webhook delivers results, THE WebhookService SHALL exclude delta details for starter plan
3. WHEN PDF is generated, THE ReportService SHALL exclude delta section for starter plan
4. WHEN GitHub Check Run is posted, THE GithubIntegrationService SHALL show only free vulnerabilities for starter plan
5. WHEN report API is called with format=summary, THE ReportService SHALL return only counts for starter plan

### Requirement 24: Regional Pricing

**User Story:** As VibeScan, I want to apply regional pricing for India and Pakistan, so that I can offer PPP-discounted rates.

#### Acceptance Criteria

1. WHERE user registers with region IN or PK, THE BillingService SHALL create Stripe Coupon for 50% discount
2. WHEN checkout session is created for IN/PK user, THE BillingService SHALL apply discount coupon to price_id
3. WHERE subscription is created, THE BillingService SHALL store regional pricing flag in Stripe metadata
4. WHEN subscription details are requested, THE BillingService SHALL indicate if regional discount applied
5. THE applyRegionalPricing function SHALL determine region by IP at registration time

### Requirement 25: Input Validation

**User Story:** As VibeScan, I want to validate all inputs before processing, so that invalid data doesn't consume resources.

#### Acceptance Criteria

1. WHEN source ZIP is uploaded, THE ScanOrchestrator SHALL validate file size ≤ 50MB and ZIP format
2. WHEN SBOM is submitted, THE InputAdapterService SHALL validate against CycloneDX JSON Schema v1.4/1.5/1.6
3. WHEN GitHub URL is submitted, THE ScanOrchestrator SHALL validate repo format (owner/repo) and ref format
4. WHEN API key scopes are specified, THE AuthService SHALL validate against allowed scopes [sbom_submit, scan_read, webhook_manage]
5. WHEN webhook URL is set, THE WebhookService SHALL validate URL is HTTPS protocol

### Requirement 26: Pagination and Filtering

**User Story:** As a user, I want to list and filter my scans, so that I can find specific scans efficiently.

#### Acceptance Criteria

1. WHEN listing scans, THE ScanOrchestrator SHALL support status filter (pending | scanning | done | error)
2. WHERE status filter is applied, THE ScanOrchestrator SHALL return only matching scans
3. WHEN listing scans, THE ScanOrchestrator SHALL support input_type filter (sbom_upload | source_zip | github_app | ci_plugin)
4. WHERE date filter is applied, THE ScanOrchestrator SHALL return scans from specified date forward
5. WHEN listing scans, THE ScanOrchestrator SHALL support limit (default 20, max 100) and cursor pagination

### Requirement 27: Ownership Verification

**User Story:** As VibeScan, I want to verify scan ownership, so that users cannot access other users' scans.

#### Acceptance Criteria

1. WHEN scan status is requested, THE ScanOrchestrator SHALL verify user_id matches scan.user_id or scan.org_id contains user
2. IF ownership verification fails, THEN THE ScanOrchestrator SHALL return 404 Not Found (not 403 to prevent enumeration)
3. WHEN report is requested, THE ReportService SHALL verify ownership before returning results
4. WHEN webhook deliveries are listed, THE WebhookService SHALL filter by user ownership
5. WHEN API keys are listed, THE AuthService SHALL return only keys owned by current user

### Requirement 28: Error Messages

**User Story:** As a user, I want descriptive error messages, so that I can understand and fix issues.

#### Acceptance Criteria

1. WHEN validation fails, THE API SHALL return {error, validation_errors: [...]} with specific field errors
2. WHEN quota exceeded, THE API SHALL return {remaining: 0, reset_at: ISO8601}
3. WHEN GitHub App not authorized, THE API SHALL return {error: 'not_authorized', repo: owner/repo}
4. WHEN Codescoring timeout occurs, THE API SHALL return {error: 'bd_timeout', retry_after: 600}
5. WHEN API key is expired, THE API SHALL return {error: 'api_key_expired', key_prefix: vs_xxxx}

### Requirement 29: Scan Cancellation

**User Story:** As a user, I want to cancel pending scans, so that I can refund quota and stop unnecessary processing.

#### Acceptance Criteria

1. WHEN a scan in pending or scanning status is cancelled, THE ScanOrchestrator SHALL attempt to revoke job from queue
2. IF job is successfully revoked, THE ScanOrchestrator SHALL set status to cancelled and refund quota
3. IF job cannot be revoked (already processing), THE ScanOrchestrator SHALL return 409 Conflict
4. WHERE scan is cancelled, THE ScanOrchestrator SHALL return 204 No Content
5. WHEN cancelled scan is queried, THE ScanOrchestrator SHALL return status: cancelled

### Requirement 30: Report Formats

**User Story:** As a user, I want multiple report formats, so that I can integrate with different tools.

#### Acceptance Criteria

1. WHEN report is requested with format=json, THE ReportService SHALL return full JSON with vulnerabilities array
2. WHEN report is requested with format=summary, THE ReportService SHALL return only counts and severity breakdown
3. WHEN PDF is requested, THE ReportService SHALL return 202 Accepted with job_id for async generation
4. WHERE PDF generation completes, THE ReportService SHALL email link to user
5. WHEN CI decision is requested, THE ReportService SHALL return {pass, max_severity, blocking_count, exit_code: 0|1}
