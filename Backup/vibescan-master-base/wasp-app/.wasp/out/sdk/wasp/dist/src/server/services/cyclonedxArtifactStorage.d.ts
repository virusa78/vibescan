export type CycloneDxArtifactType = 'input_sbom' | 'scanner_result_normalized';
export interface CycloneDxArtifactDescriptor {
    artifactType: CycloneDxArtifactType;
    payload: unknown;
}
export interface CycloneDxArtifactMeta {
    artifactKey: string;
    sha256: string;
    sizeBytes: number;
    capturedAt: string;
    retentionUntil: string;
}
export interface CycloneDxArtifactCaptureResult {
    artifacts: CycloneDxArtifactMeta[];
    warnings: string[];
}
export interface CycloneDxArtifactCleanupResult {
    keptArtifacts: CycloneDxArtifactMeta[];
    removedArtifacts: CycloneDxArtifactMeta[];
    warnings: string[];
}
export declare function serializeArtifactPayload(payload: unknown): string;
export declare function buildArtifactRetentionTimestamp(capturedAt: Date, retentionDays: number): Date;
export declare function buildCycloneDxArtifactKey(options: {
    scanId: string;
    scannerId: string;
    artifactType: CycloneDxArtifactType;
    prefix: string;
    capturedAt: Date;
    sha256: string;
}): string;
export declare function captureCycloneDxArtifacts(options: {
    scanId: string;
    scannerId: string;
    artifacts: CycloneDxArtifactDescriptor[];
    now?: Date;
}): Promise<CycloneDxArtifactCaptureResult>;
export declare function cleanupExpiredCycloneDxArtifacts(options: {
    artifacts: CycloneDxArtifactMeta[];
    now?: Date;
}): Promise<CycloneDxArtifactCleanupResult>;
export declare function resetCycloneDxArtifactStorageForTests(): void;
//# sourceMappingURL=cyclonedxArtifactStorage.d.ts.map