import type { NormalizedComponent } from './inputAdapterService.js';
import { type IngestionErrorType, type IngestionResult, type SeverityLevel, type UnifiedScanPayload } from '../../ingestion/cyclonedx-contracts.js';
import type { CycloneDxArtifactMeta } from './cyclonedxArtifactStorage.js';
export type CycloneDxPipelineMode = 'legacy' | 'shadow' | 'cutover' | 'rollback';
export type UnknownFieldTriageStatus = 'new' | 'accepted' | 'mapped' | 'ignored';
export type CutoverGateStatus = 'allow_cutover' | 'block_cutover' | 'not_applicable';
export type CanaryDecisionStatus = 'allow_promote' | 'block_promote' | 'rollback_required';
export type CanaryRolloutStage = 'shadow_smoke' | 'canary_cutover_cohort' | 'expand_cohort' | 'ready_for_prod';
export interface ScannerFindingInput {
    cveId: string;
    severity: string;
    package: string;
    version: string;
    fixedVersion?: string;
    description?: string;
    cvssScore?: number;
}
export interface CycloneDxComponentDecision {
    mode: CycloneDxPipelineMode;
    selectedComponents: NormalizedComponent[];
    ingestionResult: IngestionResult | null;
    telemetry: CycloneDxTelemetry;
}
export interface CycloneDxScanResultDecision {
    mode: CycloneDxPipelineMode;
    ingestionResult: IngestionResult;
    telemetry: CycloneDxTelemetry;
}
export interface CycloneDxTelemetry {
    scanId: string;
    scannerId: string;
    mode: CycloneDxPipelineMode;
    stage: 'components' | 'scan_result';
    status: 'skipped' | 'ingested' | 'rejected';
    processingMs: number;
    errorType?: IngestionErrorType;
    errorCode?: string;
    drift?: {
        legacyComponents: number;
        unifiedComponents: number;
        missingInUnified: number;
        extraInUnified: number;
    };
    unifiedStats?: {
        components: number;
        vulnerabilities: number;
        severity: Partial<Record<SeverityLevel, number>>;
    };
}
export interface UnknownFieldCatalogEntry {
    scannerId: string;
    specVersion: string;
    path: string;
    firstSeen: Date;
    lastSeen: Date;
    count: number;
    status: UnknownFieldTriageStatus;
}
export interface UnknownFieldCatalogSnapshotEntry {
    scannerId: string;
    specVersion: string;
    path: string;
    firstSeen: string;
    lastSeen: string;
    count: number;
    status: UnknownFieldTriageStatus;
}
export interface CutoverGateDecision {
    status: CutoverGateStatus;
    mode: CycloneDxPipelineMode;
    driftRate: number;
    driftThreshold: number;
    blockerErrors: IngestionErrorType[];
    reasons: string[];
    canaryDecision: {
        scannerId: string;
        stage: CanaryRolloutStage;
        status: CanaryDecisionStatus;
        nextStage: CanaryRolloutStage | null;
        reasons: string[];
    };
}
export interface CycloneDxIngestionMeta {
    mode: CycloneDxPipelineMode;
    componentIngestion: CycloneDxTelemetry;
    resultIngestion: CycloneDxTelemetry;
    resultStatus: IngestionResult['status'];
    unifiedStats: UnifiedScanPayload['stats'] | null;
    artifacts: CycloneDxArtifactMeta[];
    unknownFieldCatalog: UnknownFieldCatalogSnapshotEntry[];
    gate: CutoverGateDecision;
}
export declare function resolveCanaryRolloutStage(): CanaryRolloutStage;
export declare function getUnknownFieldCatalogSnapshot(): UnknownFieldCatalogSnapshotEntry[];
export declare function resetUnknownFieldCatalogForTests(): void;
export declare function setUnknownFieldTriageStatus(options: {
    scannerId: string;
    specVersion: string;
    path: string;
    status: UnknownFieldTriageStatus;
}): UnknownFieldCatalogSnapshotEntry;
export declare function evaluateCutoverQualityGate(options: {
    scannerId: string;
    mode: CycloneDxPipelineMode;
    componentTelemetry?: CycloneDxTelemetry;
    result: IngestionResult;
    warnings?: string[];
}): CutoverGateDecision;
export declare function buildCycloneDxIngestionMeta(options: {
    mode: CycloneDxPipelineMode;
    scannerId: string;
    componentDecision: CycloneDxComponentDecision;
    resultDecision: CycloneDxScanResultDecision;
    artifacts?: CycloneDxArtifactMeta[];
    artifactWarnings?: string[];
}): CycloneDxIngestionMeta;
export declare function resolveCycloneDxPipelineMode(): CycloneDxPipelineMode;
export declare function decideComponentsWithCycloneDx(options: {
    scanId: string;
    scannerId: string;
    sbomRaw?: Record<string, unknown> | null;
    legacyComponents: NormalizedComponent[];
}): CycloneDxComponentDecision;
export declare function ingestScannerFindingsWithCycloneDx(options: {
    scanId: string;
    scannerId: string;
    components: NormalizedComponent[];
    findings: ScannerFindingInput[];
}): CycloneDxScanResultDecision;
export declare function logCycloneDxTelemetry(telemetry: CycloneDxTelemetry): void;
//# sourceMappingURL=cyclonedxIngestionService.d.ts.map