/**
 * CycloneDX Ingestion Layer - Contracts & DTO
 * 
 * Canonical contracts for the entire ingestion pipeline:
 * Parser -> Validator -> Unifier -> scanOrchestrator
 */

// ============================================================================
// 1. CycloneDX Document Versions
// ============================================================================

export type CycloneDXSpecVersion = "1.4" | "1.5" | "1.6";

// ============================================================================
// 2. Raw CycloneDX JSON Structures (untyped parse)
// ============================================================================

export interface RawCycloneDXDocument {
  $schema?: string;
  bomFormat?: string;
  specVersion?: string;
  serialNumber?: string;
  version?: number;
  metadata?: Record<string, any>;
  components?: Record<string, any>[];
  vulnerabilities?: Record<string, any>[];
  dependencies?: Record<string, any>[];
  [key: string]: any;
}

// ============================================================================
// 3. Parser Output - ParsedCycloneDxDocument
// ============================================================================

export interface ParsedComponentMetadata {
  bomRef: string;
  type: string; // "library", "application", "file", etc
  name: string;
  version: string;
  licenses?: Array<{ id?: string; name?: string }>;
  cpe?: string;
  purl?: string;
  properties?: Array<{ name: string; value: string }>;
  [key: string]: any;
}

export interface ParsedVulnerability {
  ref: string;
  id: string; // CVE-XXX, GHSA-XXX, OSV-XXX, etc
  cveId?: string; // Explicit CVE ID for compatibility
  source?: { name?: string; url?: string };
  ratings?: Array<{ score?: number; severity?: string }>;
  cwe?: Array<{ id?: string }>;
  cwes?: Array<{ id: string } | number | string>; // Can be objects, numbers, or strings depending on source
  fixes?: Array<{ version?: string; versions?: string[] }>;
  references?: Array<{ url?: string; category?: string }>;
  [key: string]: any;
}

export interface ParsedCycloneDxDocument {
  // Header info
  bomFormat: string; // Must be "CycloneDX"
  specVersion: CycloneDXSpecVersion;
  serialNumber: string;
  version: number;

  // Metadata
  metadata?: {
    timestamp?: string;
    tools?: Array<{ name?: string; version?: string }>;
    component?: { name?: string; type?: string };
    [key: string]: any;
  };

  // Components
  components: ParsedComponentMetadata[];

  // Vulnerabilities
  vulnerabilities: ParsedVulnerability[];

  // Dependencies (optional)
  dependencies?: Array<{ ref?: string; depends?: string[] }>;

  // Traceability: original raw document for audit
  _raw?: RawCycloneDXDocument;
}

// ============================================================================
// 4. Validator Output - ValidatedCycloneDxDocument
// ============================================================================

export interface ValidationIssue {
  path: string; // JSON path where issue occurred
  code: string; // e.g. "required_field", "schema_mismatch", "invalid_format"
  message: string;
  severity: "error" | "warning"; // errors block progression, warnings are logged
}

export interface ValidatedCycloneDxDocument extends ParsedCycloneDxDocument {
  // Validation metadata
  _validation: {
    timestamp?: string;
    issueCount?: number;
    issues?: ValidationIssue[];
    specVersion?: CycloneDXSpecVersion;
    componentCount?: number;
    vulnerabilityCount?: number;
    warningCount?: number;
    isValid: boolean;
    validatedAt: Date;
    schemaVersion?: string;
  };
}

// ============================================================================
// 5. Unifier Output - Unified Vulnerability & Component DTO
// ============================================================================

export interface UnifiedSeverity {
  level: "critical" | "high" | "medium" | "low" | "info" | "unknown";
  cvssScore?: number;
  cvssVector?: string;
  cvssVersion?: "2.0" | "3.0" | "3.1";
}

export interface UnifiedVulnerabilityIdentifier {
  id: string; // CVE-YYYY-XXXXX
  ghsa?: string; // GHSA-XXXX-XXXX-XXXX
  osv?: string; // OSV identifier
  other?: Record<string, string>; // vendor-specific IDs
}

export interface UnifiedVulnerability {
  // Core identity
  identifiers: UnifiedVulnerabilityIdentifier;

  // Severity & scoring
  severity: UnifiedSeverity;

  // Taxonomy
  cwes: Array<{ id: string; name?: string }>;

  // Remediation
  fixedVersions: string[];
  fixedIn?: Array<{ component: string; version: string }>;

  // References
  references: Array<{
    url: string;
    category?: "advisory" | "evidence" | "fix" | "detection" | "exploited_by";
  }>;

  // Description
  description?: string;
  details?: Record<string, string>;

  // Traceability
  _sourceDocument?: string; // scanner name (grype, trivy, etc)
  _sourceId?: string; // vuln ID in original format
  _rawFields?: Record<string, any>; // unknown fields preserved
}

export interface UnifiedComponent {
  // Core identity
  bomRef: string;
  type: "library" | "application" | "framework" | "device" | "file" | "os" | "container" | "other";
  name: string;
  version: string;

  // Package identifiers
  purl?: string; // Package URL
  cpe?: string;

  // Licensing
  licenses: Array<{ id?: string; name?: string }>;

  // Location & tooling
  foundBy?: string; // e.g. "npm-lock-cataloger"
  locations?: string[]; // file paths

  // Vulnerabilities affecting this component
  vulnerabilities?: UnifiedVulnerability[];

  // Traceability
  _rawFields?: Record<string, any>;
}

export interface UnifiedScanPayload {
  // Scan metadata
  scanId: string;
  scannerId: string; // "grype", "trivy", "snyk", etc
  scanTime: Date;

  // Unified components and vulns
  components: UnifiedComponent[];
  vulnerabilities: UnifiedVulnerability[];

  // Statistics
  stats: {
    componentCount: number;
    vulnerabilityCount: number;
    severityCounts: Record<string, number>;
  };

  // Original document for audit trail
  _originalDocument: ValidatedCycloneDxDocument;

  // Unknown fields catalog (format learning loop)
  _unknownFields: Map<string, number>; // field name -> occurrence count
}

// ============================================================================
// 6. Error Contracts
// ============================================================================

export type IngestionErrorType = "parse_error" | "validation_error" | "unify_error" | "adapter_error";

export interface IngestionError {
  type: IngestionErrorType;
  code: string; // "parse_json_failed", "missing_required_field", etc
  message: string;
  details?: {
    path?: string;
    expected?: string;
    actual?: string;
    [key: string]: any;
  };
  context?: {
    scanId?: string;
    scannerId?: string;
    stage?: "parsing" | "validation" | "unification" | "orchestration";
  };
  timestamp: Date;
}

// ============================================================================
// 7. Ingestion Pipeline Options & Context
// ============================================================================

export interface IngestionContext {
  scanId: string;
  scannerId: "grype" | "trivy" | "snyk" | "blackduck" | "osv-scanner" | "clair" | string;
  userId: string;
  sourceRef: string; // repo URL, SBOM serial, etc
  expectedSpecVersion?: CycloneDXSpecVersion;
}

export interface IngestionOptions {
  strictValidation?: boolean; // default: true - fail on validation errors
  allowUnknownFields?: boolean; // default: true - collect unknown fields for analysis
  trackRawArtifacts?: boolean; // default: true - save raw BOM for audit
  learningMode?: boolean; // default: false - collect stats on format variations
}

// ============================================================================
// 8. Orchestration Result (success case)
// ============================================================================

export interface SuccessfulIngestion {
  scanId: string;
  status: "ingested";
  payload: UnifiedScanPayload;
  processingTimeMs: number;
}

export interface FailedIngestion {
  scanId: string;
  status: "failed" | "rejected";
  error: IngestionError;
  stage: "parsing" | "validation" | "unification";
}

export type IngestionResult = SuccessfulIngestion | FailedIngestion;
