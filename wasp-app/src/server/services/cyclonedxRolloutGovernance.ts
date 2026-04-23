import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CanaryRolloutStage,
  CutoverGateDecision,
  CycloneDxIngestionMeta,
  CutoverGateStatus,
} from './cyclonedxIngestionService.js';

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

function envFlag(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseNumberFlag(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, nested]) => [key, stableClone(nested)]));
  }

  return value;
}

function toJsonRecord<T>(value: T): T {
  return stableClone(value) as T;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return stableClone(value) as Prisma.InputJsonValue;
}

function isRollbackDecision(snapshot: CycloneDxRolloutSnapshotRecord): boolean {
  return snapshot.decisionStatus === 'rollback_required' || snapshot.progressStatus === 'rollback_active';
}

function extractWarnings(snapshot: CycloneDxRolloutSnapshotRecord): string[] {
  const reasons = snapshot.gate.reasons.filter((reason) => reason.startsWith('warning:'));
  return reasons.map((reason) => reason.slice('warning:'.length));
}

function deriveProgressStatus(options: {
  stage: CycloneDxRolloutStage;
  gate: CutoverGateDecision;
}): CycloneDxRolloutProgressStatus {
  if (options.gate.canaryDecision.status === 'rollback_required') {
    return 'rollback_active';
  }

  if (options.gate.status === 'block_cutover' || options.gate.canaryDecision.status === 'block_promote') {
    return 'blocked';
  }

  if (options.stage === 'ready_for_prod') {
    return 'ready_for_prod';
  }

  return 'in_progress';
}

function buildDecisionSummary(snapshot: CycloneDxRolloutSnapshotRecord): Record<string, unknown> {
  return toJsonRecord({
    snapshotId: snapshot.id,
    scanResultId: snapshot.scanResultId,
    scannerId: snapshot.scannerId,
    stage: snapshot.rolloutStage,
    progressStatus: snapshot.progressStatus,
    decisionStatus: snapshot.decisionStatus,
    gateStatus: snapshot.gateStatus,
    gateReasons: snapshot.gate.reasons,
    blockerErrors: snapshot.gate.blockerErrors,
    driftRate: snapshot.gate.driftRate,
    driftThreshold: snapshot.gate.driftThreshold,
    warnings: extractWarnings(snapshot),
    createdAt: snapshot.createdAt,
  });
}

function normalizeSnapshot(snapshot: CycloneDxRolloutSnapshotRecord): CycloneDxRolloutSnapshotRecord {
  return {
    ...snapshot,
    gate: toJsonRecord(snapshot.gate),
    ingestionMeta: toJsonRecord(snapshot.ingestionMeta),
  };
}

export function resolveCycloneDxRolloutStage(): CycloneDxRolloutStage {
  const raw = process.env.VIBESCAN_CYCLONEDX_CANARY_STAGE?.trim().toLowerCase();
  if (raw === 'shadow_smoke' || raw === 'canary_cutover_cohort' || raw === 'expand_cohort' || raw === 'ready_for_prod') {
    return raw;
  }

  return 'shadow_smoke';
}

export function buildCycloneDxRolloutSnapshotRecord(options: {
  id: string;
  createdAt: Date;
  scanResultId: string;
  scannerId: string;
  ingestionMeta: CycloneDxIngestionMeta;
  stage?: CycloneDxRolloutStage;
}): CycloneDxRolloutSnapshotRecord {
  const stage = options.stage || (options.ingestionMeta.gate.canaryDecision.stage as CycloneDxRolloutStage);
  const gate = options.ingestionMeta.gate;
  const progressStatus = deriveProgressStatus({ stage, gate });
  const decisionStatus = gate.canaryDecision.status;

  return normalizeSnapshot({
    id: options.id,
    createdAt: options.createdAt.toISOString(),
    scannerId: options.scannerId,
    scanResultId: options.scanResultId,
    rolloutStage: stage,
    progressStatus,
    decisionStatus,
    gateStatus: gate.status,
    gate,
    ingestionMeta: options.ingestionMeta,
  });
}

export function evaluateCycloneDxStagingWindow(options: {
  snapshots: CycloneDxRolloutSnapshotRecord[];
  driftThreshold?: number;
  generatedAt?: Date;
}): CycloneDxRolloutWindowDecision {
  const generatedAt = options.generatedAt || new Date();
  const driftThreshold = options.driftThreshold ?? parseNumberFlag(process.env.VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD, 0.1);
  const snapshots = options.snapshots.map(normalizeSnapshot);

  const stageBreakdown: Record<CycloneDxRolloutStage, number> = {
    shadow_smoke: 0,
    canary_cutover_cohort: 0,
    expand_cohort: 0,
    ready_for_prod: 0,
  };

  const scannerIds = new Set<string>();
  const warnings = new Set<string>();
  const reasons = new Set<string>();
  let blockerErrorCount = 0;
  let driftBlockerCount = 0;
  let maxDriftRate = 0;
  let observedFrom: string | null = null;
  let observedTo: string | null = null;
  let rollbackSeen = false;
  const emptyWindow = snapshots.length === 0;

  for (const snapshot of snapshots) {
    scannerIds.add(snapshot.scannerId);
    stageBreakdown[snapshot.rolloutStage] += 1;
    maxDriftRate = Math.max(maxDriftRate, snapshot.gate.driftRate);

    if (!observedFrom || snapshot.createdAt < observedFrom) {
      observedFrom = snapshot.createdAt;
    }
    if (!observedTo || snapshot.createdAt > observedTo) {
      observedTo = snapshot.createdAt;
    }

    for (const warning of extractWarnings(snapshot)) {
      warnings.add(warning);
    }

    blockerErrorCount += snapshot.gate.blockerErrors.length;

    if (snapshot.gate.driftRate > driftThreshold) {
      driftBlockerCount += 1;
      reasons.add(`drift_rate_exceeded:${snapshot.gate.driftRate.toFixed(4)}>${driftThreshold.toFixed(4)}`);
    }

    for (const blockerError of snapshot.gate.blockerErrors) {
      reasons.add(`blocker_error:${blockerError}`);
    }

    if (isRollbackDecision(snapshot)) {
      rollbackSeen = true;
      reasons.add('rollback_active');
    }
  }

  if (warnings.size > 0) {
    reasons.add(`warnings:${warnings.size}`);
  }

  if (emptyWindow) {
    reasons.add('empty_window_no_observed_data');
  }

  if (snapshotHasAnyBlockers(snapshots, driftThreshold)) {
    reasons.add('block_promote_window_blockers_detected');
  }

  const status: CycloneDxWindowDecisionStatus = rollbackSeen
    ? 'rollback_required'
    : emptyWindow || blockerErrorCount > 0 || driftBlockerCount > 0
      ? 'block_promote'
      : 'allow_promote';

  if (status === 'allow_promote') {
    reasons.add('allow_promote_window_clear');
  }

  return {
    generatedAt: generatedAt.toISOString(),
    suite: 'cyclonedx-m4-staging-acceptance',
    status,
    reasons: Array.from(reasons).sort(),
    warnings: Array.from(warnings).sort(),
    summary: {
      snapshotCount: snapshots.length,
      scannerIds: Array.from(scannerIds).sort(),
      stageBreakdown,
      blockerErrorCount,
      driftBlockerCount,
      warningCount: warnings.size,
      maxDriftRate,
      driftThreshold,
      observedFrom,
      observedTo,
    },
    snapshots,
  };
}

function snapshotHasAnyBlockers(snapshots: CycloneDxRolloutSnapshotRecord[], driftThreshold: number): boolean {
  return snapshots.some((snapshot) => {
    return (
      snapshot.decisionStatus === 'rollback_required' ||
      snapshot.progressStatus === 'rollback_active' ||
      snapshot.gate.blockerErrors.length > 0 ||
      snapshot.gate.driftRate > driftThreshold
    );
  });
}

export function buildCycloneDxRolloutEvidencePack(options: {
  decision: CycloneDxRolloutWindowDecision;
  scannerId: string | null;
  progressStatus: CycloneDxRolloutProgressStatus;
  currentStage: CycloneDxRolloutStage;
  latestDecisionStatus: CycloneDxWindowDecisionStatus;
  latestDecision: Record<string, unknown> | null;
}): CycloneDxRolloutEvidencePack {
  return {
    ...options.decision,
    promotionReady: options.decision.status === 'allow_promote',
    phaseState: {
      scannerId: options.scannerId,
      currentStage: options.currentStage,
      progressStatus: options.progressStatus,
      latestDecisionStatus: options.latestDecisionStatus,
      latestDecision: options.latestDecision,
    },
  };
}

export function buildCycloneDxRolloutMarkdown(evidence: CycloneDxRolloutEvidencePack): string {
  const stageRows = Object.entries(evidence.summary.stageBreakdown)
    .map(([stage, count]) => `- ${stage}: ${count}`)
    .join('\n');

  const snapshotRows = evidence.snapshots
    .map(
      (snapshot) =>
        `- ${snapshot.scannerId} / ${snapshot.scanResultId} / ${snapshot.rolloutStage} / ${snapshot.decisionStatus} / ${snapshot.gateStatus}`,
    )
    .join('\n');

  return [
    '# CycloneDX M4 Staging Acceptance Report',
    '',
    `Generated at: ${evidence.generatedAt}`,
    `Status: ${evidence.status}`,
    `Promotion ready: ${evidence.promotionReady}`,
    '',
    '## Summary',
    `- Snapshots: ${evidence.summary.snapshotCount}`,
    `- Scanners: ${evidence.summary.scannerIds.join(', ') || 'none'}`,
    `- Blocker errors: ${evidence.summary.blockerErrorCount}`,
    `- Drift blockers: ${evidence.summary.driftBlockerCount}`,
    `- Warning count: ${evidence.summary.warningCount}`,
    `- Max drift rate: ${evidence.summary.maxDriftRate.toFixed(4)}`,
    `- Drift threshold: ${evidence.summary.driftThreshold.toFixed(4)}`,
    `- Observed from: ${evidence.summary.observedFrom || 'n/a'}`,
    `- Observed to: ${evidence.summary.observedTo || 'n/a'}`,
    '',
    '## Stage Breakdown',
    stageRows || '- none',
    '',
    '## Snapshots',
    snapshotRows || '- none',
    '',
    '## Decisions',
    `- Latest stage: ${evidence.phaseState.currentStage}`,
    `- Latest progress status: ${evidence.phaseState.progressStatus}`,
    `- Latest decision status: ${evidence.phaseState.latestDecisionStatus}`,
    `- Decision reasons: ${evidence.reasons.join(', ') || 'none'}`,
  ].join('\n');
}

export async function persistCycloneDxRolloutSnapshot(options: {
  prisma: PrismaClient;
  scanResultId: string;
  scannerId: string;
  ingestionMeta: CycloneDxIngestionMeta;
  createdAt?: Date;
  stage?: CycloneDxRolloutStage;
}): Promise<CycloneDxRolloutSnapshotRecord> {
  const createdAt = options.createdAt || new Date();
  const snapshot = buildCycloneDxRolloutSnapshotRecord({
    id: `${options.scanResultId}:${options.scannerId}`,
    createdAt,
    scanResultId: options.scanResultId,
    scannerId: options.scannerId,
    ingestionMeta: options.ingestionMeta,
    stage: options.stage,
  });

  const storedSnapshot = await options.prisma.cycloneDxRolloutSnapshot.upsert({
    where: {
      scanResultId: options.scanResultId,
    },
    create: {
      scannerId: options.scannerId,
      scanResultId: options.scanResultId,
      rolloutStage: snapshot.rolloutStage,
      progressStatus: snapshot.progressStatus,
      decisionStatus: snapshot.decisionStatus,
      gateStatus: snapshot.gateStatus,
      gateSnapshot: toInputJsonValue(snapshot.gate),
      ingestionMeta: toInputJsonValue(snapshot.ingestionMeta),
      summary: toInputJsonValue(buildDecisionSummary(snapshot)),
    },
    update: {
      scannerId: options.scannerId,
      rolloutStage: snapshot.rolloutStage,
      progressStatus: snapshot.progressStatus,
      decisionStatus: snapshot.decisionStatus,
      gateStatus: snapshot.gateStatus,
      gateSnapshot: toInputJsonValue(snapshot.gate),
      ingestionMeta: toInputJsonValue(snapshot.ingestionMeta),
      summary: toInputJsonValue(buildDecisionSummary(snapshot)),
    },
  });

  await options.prisma.cycloneDxRolloutState.upsert({
    where: { scannerId: options.scannerId },
    create: {
      scannerId: options.scannerId,
      currentStage: snapshot.rolloutStage,
      progressStatus: snapshot.progressStatus,
      latestSnapshotId: storedSnapshot.id,
      latestDecision: toInputJsonValue(buildDecisionSummary(snapshot)),
    },
    update: {
      currentStage: snapshot.rolloutStage,
      progressStatus: snapshot.progressStatus,
      latestSnapshotId: storedSnapshot.id,
      latestDecision: toInputJsonValue(buildDecisionSummary(snapshot)),
    },
  });

  return snapshot;
}

export async function persistCycloneDxRolloutDecision(options: {
  prisma: PrismaClient;
  scannerId: string | null;
  decision: CycloneDxRolloutWindowDecision;
  currentStage?: CycloneDxRolloutStage;
}): Promise<CycloneDxRolloutEvidencePack> {
  const latestSnapshot = options.decision.snapshots.at(-1) || null;
  const progressStatus: CycloneDxRolloutProgressStatus = options.decision.status === 'rollback_required'
    ? 'rollback_active'
    : options.decision.status === 'allow_promote'
      ? 'ready_for_prod'
      : 'blocked';
  const stateScannerId = options.scannerId || latestSnapshot?.scannerId || null;
  const currentStage = options.currentStage || latestSnapshot?.rolloutStage || 'shadow_smoke';
  const latestDecision = latestSnapshot ? buildDecisionSummary(latestSnapshot) : null;

  if (stateScannerId) {
    await options.prisma.cycloneDxRolloutState.upsert({
      where: { scannerId: stateScannerId },
      create: {
        scannerId: stateScannerId,
        currentStage,
        progressStatus,
        latestSnapshotId: latestSnapshot?.id || null,
        latestDecision: toInputJsonValue({
          windowDecision: options.decision,
        }),
      },
      update: {
        currentStage,
        progressStatus,
        latestSnapshotId: latestSnapshot?.id || null,
        latestDecision: toInputJsonValue({
          windowDecision: options.decision,
        }),
      },
    });
  }

  return buildCycloneDxRolloutEvidencePack({
    decision: options.decision,
    scannerId: stateScannerId,
    progressStatus,
    currentStage,
    latestDecisionStatus: options.decision.status,
    latestDecision,
  });
}

export async function collectCycloneDxRolloutWindow(options: {
  prisma: PrismaClient;
  windowStart: Date;
  windowEnd?: Date;
  scannerIds?: string[];
}): Promise<CycloneDxRolloutSnapshotRecord[]> {
  const windowEnd = options.windowEnd || new Date();
  const snapshots = await options.prisma.cycloneDxRolloutSnapshot.findMany({
    where: {
      createdAt: {
        gte: options.windowStart,
        lte: windowEnd,
      },
      ...(options.scannerIds && options.scannerIds.length > 0
        ? {
            scannerId: {
              in: options.scannerIds,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return snapshots.map((snapshot) =>
    normalizeSnapshot({
      id: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
      scannerId: snapshot.scannerId,
      scanResultId: snapshot.scanResultId,
      rolloutStage: snapshot.rolloutStage as CycloneDxRolloutStage,
      progressStatus: snapshot.progressStatus as CycloneDxRolloutProgressStatus,
      decisionStatus: snapshot.decisionStatus as CycloneDxWindowDecisionStatus,
      gateStatus: snapshot.gateStatus as CutoverGateStatus,
      gate: snapshot.gateSnapshot as unknown as CutoverGateDecision,
      ingestionMeta: snapshot.ingestionMeta as unknown as CycloneDxIngestionMeta,
    }),
  );
}
