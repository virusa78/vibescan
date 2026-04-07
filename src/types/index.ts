/**
 * Type definitions
 *
 * Shared TypeScript types for the application.
 */

// User types
export interface User {
    id: string;
    email: string;
    password_hash: string;
    name?: string;
    plan: PlanTier;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    api_key_hash?: string;
    api_key_created_at?: string;
    webhook_url?: string;
    created_at: string;
    last_active_at?: string;
    region: Region;
}

export type PlanTier = 'free_trial' | 'starter' | 'pro' | 'enterprise';
export type Region = 'IN' | 'PK' | 'OTHER';

// Organization types
export interface Organization {
    id: string;
    name: string;
    owner_user_id: string;
    members: string[];
    plan: PlanTier;
    github_installation_id?: string;
    gitlab_integration_token?: string;
    created_at: string;
}

// Scan types
export interface Scan {
    id: string;
    user_id: string;
    org_id?: string;
    input_type: InputType;
    input_ref: string;
    sbom_raw?: any;
    components: Component[];
    status: ScanStatus;
    plan_at_submission: PlanTier;
    error_message?: string;
    created_at: string;
    completed_at?: string;
}

export type InputType = 'sbom_upload' | 'source_zip' | 'github_app' | 'ci_plugin';
export type ScanStatus = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';

// Component types
export interface Component {
    name: string;
    version: string;
    purl: string;
    type: 'library' | 'application' | 'framework' | 'os' | 'container' | 'device' | 'firmware' | 'file';
    ecosystem?: string;
}

// Vulnerability types
export interface Vulnerability {
    id: string;
    cve_id?: string;
    ghsa_id?: string;
    severity: Severity;
    cvss_score: number;
    package_name: string;
    package_ecosystem: Ecosystem;
    installed_version: string;
    fixed_version?: string;
    purl: string;
    epss_score?: number;
    is_exploitable: boolean;
    description: string;
    references: string[];
    source: 'free' | 'enterprise';
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Ecosystem = 'npm' | 'pypi' | 'maven' | 'cargo' | 'gem' | 'nuget' | 'go' | 'other';

// Scan result types
export interface ScanResult {
    id: string;
    scan_id: string;
    source: 'free' | 'enterprise';
    raw_output: any;
    vulnerabilities: Vulnerability[];
    scanner_version: string;
    cve_db_timestamp: string;
    duration_ms: number;
    created_at: string;
}

// Scan delta types
export interface ScanDelta {
    id: string;
    scan_id: string;
    total_free_count: number;
    total_enterprise_count: number;
    delta_count: number;
    delta_by_severity: {
        CRITICAL: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    delta_vulnerabilities?: Vulnerability[];
    is_locked: boolean;
    created_at: string;
}

// API key types
export interface ApiKey {
    id: string;
    user_id: string;
    key_prefix: string;
    key_hash: string;
    label: string;
    scopes: ApiKeyScope[];
    last_used_at?: string;
    expires_at?: string;
    revoked_at?: string;
    created_at: string;
}

export type ApiKeyScope = 'sbom_submit' | 'scan_read' | 'webhook_manage';

// Webhook types
export interface Webhook {
    id: string;
    user_id: string;
    url: string;
    signing_secret: string;
    enabled: boolean;
    created_at: string;
}

export interface WebhookDelivery {
    id: string;
    webhook_id: string;
    scan_id: string;
    target_url: string;
    payload_hash: string;
    attempt_number: number;
    http_status?: number;
    response_body?: string;
    delivered_at?: string;
    next_retry_at?: string;
    status: 'pending' | 'delivered' | 'failed' | 'exhausted';
    created_at: string;
}

// GitHub installation types
export interface GithubInstallation {
    id: string;
    org_id: string;
    github_installation_id: number;
    github_app_id: string;
    repos_scope: string[];
    trigger_on_push: boolean;
    trigger_on_pr: boolean;
    target_branches: string[];
    fail_pr_on_severity: Severity | 'NONE';
    created_at: string;
}

// Quota ledger types
export interface QuotaLedger {
    id: string;
    user_id: string;
    month: string;
    scans_used: number;
    scans_limit: number;
    reset_at: string;
    plan_at_creation: PlanTier;
    created_at: string;
    updated_at: string;
}

// SBOM document types
export interface SbomDocument {
    id: string;
    scan_id: string;
    spec_version: string;
    serial_number: string;
    component_count: number;
    tool_name: string;
    tool_version: string;
    raw_document_s3_key: string;
    validated_at?: string;
    validation_errors: string[];
    created_at: string;
}

// Report types
export interface ReportView {
    scan_id: string;
    status: ScanStatus;
    plan: PlanTier;
    free_vulnerabilities: Vulnerability[];
    enterprise_vulnerabilities?: Vulnerability[];
    delta_vulnerabilities?: Vulnerability[];
    delta_count: number;
    delta_by_severity: {
        CRITICAL: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    total_free_count: number;
    total_enterprise_count: number;
    created_at: string;
}

export interface CiDecision {
    pass: boolean;
    max_severity: Severity;
    blocking_count: number;
    exit_code: 0 | 1;
    blocking_vulns: Vulnerability[];
}

// Input adapter types
export interface InputAdapterResult {
    components: Component[];
    sbom_raw?: any;
}

export interface CycloneDXValidationResult {
    valid: boolean;
    errors: string[];
    spec_version?: string;
}

// Worker job types
export interface ScanJob {
    scanId: string;
    components: Component[];
}

export interface WorkerResult {
    scanId: string;
    source: 'free' | 'enterprise';
    rawOutput: any;
    vulnerabilities: Vulnerability[];
    scannerVersion: string;
    cveDbTimestamp: string;
    durationMs: number;
}

// Auth types
export interface JwtPayload {
    userId: string;
    email: string;
    plan: PlanTier;
    iat: number;
    exp: number;
}

export interface RefreshTokenPayload {
    userId: string;
    iat: number;
    exp: number;
}

// API response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
    items: T[];
    nextCursor?: string;
    prevCursor?: string;
    total: number;
    limit: number;
}

// Quota types
export interface QuotaResult {
    allowed: boolean;
    remaining: number;
    resetAt: string;
}

// Event types
export interface ScanStatusEvent {
    scanId: string;
    status: ScanStatus;
    details?: Record<string, any>;
    timestamp: string;
}

export interface ScanCompleteEvent {
    scanId: string;
    result: {
        free: ScanResult;
        enterprise: ScanResult;
        delta: ScanDelta;
    };
    timestamp: string;
}

export interface ScanErrorEvent {
    scanId: string;
    error: string;
    source?: 'free' | 'enterprise';
    timestamp: string;
}
