export type CycloneDXSpecVersion = "1.4" | "1.5" | "1.6";
export type IngestionStage = "parsing" | "validation" | "unification" | "ingestion";
export type IngestionStatus = "ingested" | "rejected";
export type IngestionErrorType = "parse_error" | "validation_error" | "unify_error";
export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";
export interface RawCycloneDXDocument {
    [key: string]: unknown;
}
export interface CycloneDXIssue {
    path: string;
    code: string;
    message: string;
    severity: "error" | "warning";
}
export interface IngestionContext {
    scanId?: string;
    scannerId?: string;
    stage?: IngestionStage;
    source?: string;
    toolVersion?: string;
    ingestedAt?: Date;
    [key: string]: unknown;
}
export interface IngestionError {
    type: IngestionErrorType;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    context?: IngestionContext;
    timestamp: Date;
}
export interface CycloneDxTool {
    vendor?: string;
    name?: string;
    version?: string;
}
export interface CycloneDxLicense {
    id?: string;
    name?: string;
}
export interface CycloneDxComponent {
    bomRef?: string;
    "bom-ref"?: string;
    type?: string;
    name?: string;
    version?: string;
    purl?: string;
    cpe?: string;
    supplier?: string;
    licenses?: Array<{
        license?: CycloneDxLicense;
    }>;
    properties?: Array<{
        name: string;
        value: string;
    }>;
    [key: string]: unknown;
}
export interface CycloneDxRating {
    source?: {
        name?: string;
        url?: string;
    };
    severity?: string;
    score?: number;
    vector?: string;
    method?: string;
}
export interface CycloneDxCwe {
    id?: string;
    name?: string;
}
export interface CycloneDxFix {
    version?: string;
    state?: string;
    [key: string]: unknown;
}
export interface CycloneDxReference {
    url?: string;
    category?: string;
    [key: string]: unknown;
}
export interface CycloneDxVulnerability {
    ref?: string;
    id?: string;
    source?: {
        name?: string;
        url?: string;
    };
    ratings?: CycloneDxRating[];
    cwes?: CycloneDxCwe[];
    fixes?: CycloneDxFix[];
    references?: CycloneDxReference[];
    affects?: Array<{
        ref?: string;
        [key: string]: unknown;
    }>;
    description?: string;
    [key: string]: unknown;
}
export interface ParsedCycloneDxDocument {
    bomFormat: "CycloneDX";
    specVersion: CycloneDXSpecVersion;
    serialNumber?: string;
    version: number;
    metadata?: {
        timestamp?: string;
        tools?: CycloneDxTool[] | {
            components?: CycloneDxTool[];
        };
        component?: Record<string, unknown>;
        [key: string]: unknown;
    };
    components: CycloneDxComponent[];
    vulnerabilities: CycloneDxVulnerability[];
    dependencies?: Array<{
        ref?: string;
        dependsOn?: string[];
        [key: string]: unknown;
    }>;
    _rawFields?: Record<string, unknown>;
}
export type ValidationIssue = CycloneDXIssue;
export interface ValidationMetadata {
    schemaVersion: CycloneDXSpecVersion | "unknown";
    isValid: boolean;
    issues: ValidationIssue[];
    validatedAt: Date;
}
export interface ValidatedCycloneDxDocument extends ParsedCycloneDxDocument {
    _validation: ValidationMetadata;
}
export interface UnifiedIdentifierSet {
    id?: string;
    ghsa?: string;
    osv?: string;
    aliases?: string[];
}
export interface UnifiedSeverity {
    level: SeverityLevel;
    cvssScore?: number;
    cvssVector?: string;
    cvssVersion?: string;
}
export interface UnifiedReference {
    url: string;
    category?: string;
}
export interface UnifiedComponent {
    bomRef: string;
    type: string;
    name: string;
    version: string;
    purl?: string;
    cpe?: string;
    licenses: CycloneDxLicense[];
    foundBy?: string;
    locations: string[];
    vulnerabilities: UnifiedVulnerability[];
    _rawFields?: Record<string, unknown>;
}
export interface UnifiedVulnerability {
    identifiers: UnifiedIdentifierSet;
    severity: UnifiedSeverity;
    cwes: CycloneDxCwe[];
    fixedVersions: string[];
    references: UnifiedReference[];
    description?: string;
    _sourceDocument?: string;
    _sourceId?: string;
    _rawFields?: Record<string, unknown>;
}
export interface UnifiedScanStats {
    componentCount: number;
    vulnerabilityCount: number;
    severityCounts: Partial<Record<SeverityLevel, number>>;
}
export interface UnifiedScanPayload {
    scanId: string;
    scannerId: string;
    scanTime: Date;
    components: UnifiedComponent[];
    vulnerabilities: UnifiedVulnerability[];
    stats: UnifiedScanStats;
    _originalDocument: ValidatedCycloneDxDocument;
    _unknownFields: Map<string, unknown>;
}
export interface IngestionSuccessResult {
    scanId: string;
    status: "ingested";
    payload: UnifiedScanPayload;
    processingTimeMs: number;
}
export interface IngestionFailureResult {
    scanId: string;
    status: "rejected";
    error: IngestionError;
    stage: IngestionStage;
    processingTimeMs: number;
}
export type IngestionResult = IngestionSuccessResult | IngestionFailureResult;
export interface CycloneDxFixtureExpectation {
    status: IngestionStatus;
    errorType?: IngestionErrorType;
    componentCount?: number;
    vulnerabilityCount?: number;
    severityCounts?: Partial<Record<SeverityLevel, number>>;
}
export interface CycloneDxFixtureManifestEntry {
    id: string;
    scannerId: string;
    specVersion: CycloneDXSpecVersion | "unknown";
    filePath: string;
    expected: CycloneDxFixtureExpectation;
}
export declare function parseCycloneDXDocument(rawDocument: string | RawCycloneDXDocument | ParsedCycloneDxDocument, context?: IngestionContext): ParsedCycloneDxDocument;
export declare function validateCycloneDX(document: string | RawCycloneDXDocument | ParsedCycloneDxDocument): {
    valid: boolean;
    errors: string[];
    spec_version: CycloneDXSpecVersion | "unknown";
};
export declare function unifyCycloneDXDocument(document: ValidatedCycloneDxDocument, context?: IngestionContext): UnifiedScanPayload;
export declare function fromCycloneDX(document: string | RawCycloneDXDocument, context?: IngestionContext): IngestionResult;
//# sourceMappingURL=cyclonedx-contracts.d.ts.map