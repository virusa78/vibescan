import type { PrismaClient } from '@prisma/client';
import type { CanaryRolloutStage, CutoverGateDecision, CycloneDxIngestionMeta, CutoverGateStatus } from './cyclonedxIngestionService.js';
export type CycloneDxRolloutStage = CanaryRolloutStage;
export type CycloneDxRolloutProgressStatus = 'in_progress' | 'blocked' | 'ready_for_prod' | 'rollback_active';
export type CycloneDxWindowDecisionStatus = 'allow_promote' | 'block_promote' | 'rollback_required';
export interface CycloneDxRolloutSnapshotRecord {
    id: string;
    createdAt: string;
    scannerId: string;
    scanResultId: string;
    rolloutStage: CycloneDxRolloutStage;
    progressStatus: CycloneDxRolloutProgressStatus;
    decisionStatus: CycloneDxWindowDecisionStatus;
    gateStatus: CutoverGateStatus;
    gate: CutoverGateDecision;
    ingestionMeta: CycloneDxIngestionMeta;
}
export interface CycloneDxRolloutWindowDecision {
    generatedAt: string;
    suite: 'cyclonedx-m4-staging-acceptance';
    status: CycloneDxWindowDecisionStatus;
    reasons: string[];
    warnings: string[];
    summary: {
        snapshotCount: number;
        scannerIds: string[];
        stageBreakdown: Record<CycloneDxRolloutStage, number>;
        blockerErrorCount: number;
        driftBlockerCount: number;
        warningCount: number;
        maxDriftRate: number;
        driftThreshold: number;
        observedFrom: string | null;
        observedTo: string | null;
    };
    snapshots: CycloneDxRolloutSnapshotRecord[];
}
export interface CycloneDxRolloutEvidencePack extends CycloneDxRolloutWindowDecision {
    promotionReady: boolean;
    phaseState: {
        scannerId: string | null;
        currentStage: CycloneDxRolloutStage;
        progressStatus: CycloneDxRolloutProgressStatus;
        latestDecisionStatus: CycloneDxWindowDecisionStatus;
        latestDecision: Record<string, unknown> | null;
    };
}
export interface CycloneDxRolloutStateUpdate {
    scannerId: string;
    currentStage: CycloneDxRolloutStage;
    progressStatus: CycloneDxRolloutProgressStatus;
    latestDecisionStatus: CycloneDxWindowDecisionStatus;
    latestDecision: Record<string, unknown>;
    latestSnapshotId: string;
}
export declare function resolveCycloneDxRolloutStage(): CycloneDxRolloutStage;
export declare function buildCycloneDxRolloutSnapshotRecord(options: {
    id: string;
    createdAt: Date;
    scanResultId: string;
    scannerId: string;
    ingestionMeta: CycloneDxIngestionMeta;
    stage?: CycloneDxRolloutStage;
}): CycloneDxRolloutSnapshotRecord;
export declare function evaluateCycloneDxStagingWindow(options: {
    snapshots: CycloneDxRolloutSnapshotRecord[];
    driftThreshold?: number;
    generatedAt?: Date;
}): CycloneDxRolloutWindowDecision;
export declare function buildCycloneDxRolloutEvidencePack(options: {
    decision: CycloneDxRolloutWindowDecision;
    scannerId: string | null;
    progressStatus: CycloneDxRolloutProgressStatus;
    currentStage: CycloneDxRolloutStage;
    latestDecisionStatus: CycloneDxWindowDecisionStatus;
    latestDecision: Record<string, unknown> | null;
}): CycloneDxRolloutEvidencePack;
export declare function buildCycloneDxRolloutMarkdown(evidence: CycloneDxRolloutEvidencePack): string;
export declare function persistCycloneDxRolloutSnapshot(options: {
    prisma: PrismaClient;
    scanResultId: string;
    scannerId: string;
    ingestionMeta: CycloneDxIngestionMeta;
    createdAt?: Date;
    stage?: CycloneDxRolloutStage;
}): Promise<CycloneDxRolloutSnapshotRecord>;
export declare function persistCycloneDxRolloutDecision(options: {
    prisma: PrismaClient;
    scannerId: string | null;
    decision: CycloneDxRolloutWindowDecision;
    currentStage?: CycloneDxRolloutStage;
}): Promise<CycloneDxRolloutEvidencePack>;
export declare function collectCycloneDxRolloutWindow(options: {
    prisma: PrismaClient;
    windowStart: Date;
    windowEnd?: Date;
    scannerIds?: string[];
}): Promise<CycloneDxRolloutSnapshotRecord[]>;
//# sourceMappingURL=cyclonedxRolloutGovernance.d.ts.map