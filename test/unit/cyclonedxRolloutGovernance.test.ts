/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildCycloneDxRolloutEvidencePack,
  buildCycloneDxRolloutSnapshotRecord,
  buildCycloneDxRolloutMarkdown,
  evaluateCycloneDxStagingWindow,
  persistCycloneDxRolloutDecision,
  persistCycloneDxRolloutSnapshot,
  resolveCycloneDxRolloutStage,
  type CycloneDxRolloutSnapshotRecord,
} from '../../wasp-app/src/server/services/cyclonedxRolloutGovernance';
import type { CycloneDxIngestionMeta } from '../../wasp-app/src/server/services/cyclonedxIngestionService';

const trackedEnv = ['VIBESCAN_CYCLONEDX_CANARY_STAGE', 'VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD'];

function resetEnv(): void {
  for (const key of trackedEnv) {
    delete process.env[key];
  }
}

function makeTelemetry(scanId: string, scannerId: string, driftRate = 0): CycloneDxIngestionMeta['componentIngestion'] {
  return {
    scanId,
    scannerId,
    mode: 'cutover',
    stage: 'components',
    status: 'ingested',
    processingMs: 4,
    drift: {
      legacyComponents: 10,
      unifiedComponents: 10,
      missingInUnified: Math.round(driftRate * 10),
      extraInUnified: 0,
    },
    unifiedStats: {
      components: 10,
      vulnerabilities: 1,
      severity: { high: 1 },
    },
  };
}

function makeIngestionMeta(options: {
  scanId: string;
  scannerId: string;
  stage?: CycloneDxRolloutSnapshotRecord['rolloutStage'];
  decisionStatus?: CycloneDxRolloutSnapshotRecord['decisionStatus'];
  gateStatus?: CycloneDxRolloutSnapshotRecord['gateStatus'];
  driftRate?: number;
  reasons?: string[];
  blockerErrors?: Array<'validation_error' | 'unify_error'>;
}): CycloneDxIngestionMeta {
  const stage = options.stage || 'ready_for_prod';
  const driftRate = options.driftRate ?? 0;
  return {
    mode: 'cutover',
    componentIngestion: makeTelemetry(options.scanId, options.scannerId, driftRate),
    resultIngestion: {
      ...makeTelemetry(options.scanId, options.scannerId, driftRate),
      stage: 'scan_result',
    },
    resultStatus: 'ingested',
    unifiedStats: {
      componentCount: 10,
      vulnerabilityCount: 1,
      severityCounts: { high: 1 },
    },
    artifacts: [],
    unknownFieldCatalog: [],
    gate: {
      status: options.gateStatus || 'allow_cutover',
      mode: 'cutover',
      driftRate,
      driftThreshold: 0.1,
      blockerErrors: options.blockerErrors || [],
      reasons: options.reasons || ['allow_promote_window_clear'],
      canaryDecision: {
        scannerId: options.scannerId,
        stage,
        status: options.decisionStatus || 'allow_promote',
        nextStage: stage === 'ready_for_prod' ? null : 'ready_for_prod',
        reasons: options.reasons || ['allow_promote_window_clear'],
      },
    },
  };
}

afterEach(() => {
  resetEnv();
});

describe('cyclonedxRolloutGovernance', () => {
  it('resolves ready_for_prod as a valid rollout stage', () => {
    process.env.VIBESCAN_CYCLONEDX_CANARY_STAGE = 'ready_for_prod';
    expect(resolveCycloneDxRolloutStage()).toBe('ready_for_prod');
  });

  it('evaluates a clean staging window as allow_promote', () => {
    const snapshots = [
      buildCycloneDxRolloutSnapshotRecord({
        id: 'snapshot-1',
        createdAt: new Date('2026-04-23T10:00:00.000Z'),
        scanResultId: 'scan-result-1',
        scannerId: 'free',
        ingestionMeta: makeIngestionMeta({
          scanId: 'scan-result-1',
          scannerId: 'free',
          reasons: ['allow_promote_window_clear', 'warning:artifact_upload_failed:timeout'],
        }),
      }),
      buildCycloneDxRolloutSnapshotRecord({
        id: 'snapshot-2',
        createdAt: new Date('2026-04-23T10:15:00.000Z'),
        scanResultId: 'scan-result-2',
        scannerId: 'enterprise',
        ingestionMeta: makeIngestionMeta({
          scanId: 'scan-result-2',
          scannerId: 'enterprise',
          reasons: ['allow_promote_window_clear'],
        }),
      }),
    ];

    const decision = evaluateCycloneDxStagingWindow({ snapshots });
    expect(decision.status).toBe('allow_promote');
    expect(decision.summary.snapshotCount).toBe(2);
    expect(decision.summary.warningCount).toBe(1);
    expect(decision.summary.blockerErrorCount).toBe(0);
    expect(decision.reasons).toContain('allow_promote_window_clear');
  });

  it('blocks an empty staging window with a deterministic reason', () => {
    const decision = evaluateCycloneDxStagingWindow({ snapshots: [] });

    expect(decision.status).toBe('block_promote');
    expect(decision.summary.snapshotCount).toBe(0);
    expect(decision.summary.blockerErrorCount).toBe(0);
    expect(decision.summary.driftBlockerCount).toBe(0);
    expect(decision.reasons).toContain('empty_window_no_observed_data');
  });

  it('blocks a staging window on blocker errors or drift above threshold', () => {
    const snapshots = [
      buildCycloneDxRolloutSnapshotRecord({
        id: 'snapshot-3',
        createdAt: new Date('2026-04-23T10:30:00.000Z'),
        scanResultId: 'scan-result-3',
        scannerId: 'free',
        ingestionMeta: makeIngestionMeta({
          scanId: 'scan-result-3',
          scannerId: 'free',
          driftRate: 0.11,
          gateStatus: 'block_cutover',
          decisionStatus: 'block_promote',
          reasons: ['blocker_error:validation_error', 'drift_rate_exceeded:0.1100>0.1000'],
          blockerErrors: ['validation_error'],
        }),
      }),
    ];

    const decision = evaluateCycloneDxStagingWindow({ snapshots });
    expect(decision.status).toBe('block_promote');
    expect(decision.summary.driftBlockerCount).toBe(1);
    expect(decision.summary.blockerErrorCount).toBe(1);
    expect(decision.reasons).toContain('blocker_error:validation_error');
  });

  it('returns rollback_required when rollback is present in the window', () => {
    const snapshots = [
      buildCycloneDxRolloutSnapshotRecord({
        id: 'snapshot-4',
        createdAt: new Date('2026-04-23T10:45:00.000Z'),
        scanResultId: 'scan-result-4',
        scannerId: 'free',
        stage: 'ready_for_prod',
        ingestionMeta: makeIngestionMeta({
          scanId: 'scan-result-4',
          scannerId: 'free',
          decisionStatus: 'rollback_required',
          gateStatus: 'allow_cutover',
          reasons: ['rollback_active'],
        }),
      }),
    ];

    const decision = evaluateCycloneDxStagingWindow({ snapshots });
    expect(decision.status).toBe('rollback_required');
    expect(decision.reasons).toContain('rollback_active');
  });

  it('persists snapshot and state updates through the rollout helpers', async () => {
    const upsertSnapshot = jest.fn();
    (upsertSnapshot as any).mockResolvedValue({ id: 'stored-snapshot-1' });
    const upsertState = jest.fn();
    (upsertState as any).mockResolvedValue({ id: 'stored-state-1' });
    const prisma = {
      cycloneDxRolloutSnapshot: { upsert: upsertSnapshot },
      cycloneDxRolloutState: { upsert: upsertState },
    } as const;

    const snapshot = await persistCycloneDxRolloutSnapshot({
      prisma: prisma as any,
      scanResultId: 'scan-result-5',
      scannerId: 'enterprise',
      createdAt: new Date('2026-04-23T11:00:00.000Z'),
      ingestionMeta: makeIngestionMeta({
        scanId: 'scan-result-5',
        scannerId: 'enterprise',
      }),
    });

    expect(snapshot.scanResultId).toBe('scan-result-5');
    expect(upsertSnapshot).toHaveBeenCalledTimes(1);
    expect(upsertState).toHaveBeenCalledTimes(1);
    expect(upsertState.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: { scannerId: 'enterprise' },
        create: expect.objectContaining({
          currentStage: 'ready_for_prod',
          progressStatus: 'ready_for_prod',
          latestSnapshotId: 'stored-snapshot-1',
        }),
      }),
    );
  });

  it('builds a stable evidence pack and markdown report', () => {
    const snapshots = [
      buildCycloneDxRolloutSnapshotRecord({
        id: 'snapshot-6',
        createdAt: new Date('2026-04-23T11:15:00.000Z'),
        scanResultId: 'scan-result-6',
        scannerId: 'free',
        ingestionMeta: makeIngestionMeta({
          scanId: 'scan-result-6',
          scannerId: 'free',
        }),
      }),
    ];
    const decision = evaluateCycloneDxStagingWindow({ snapshots });
    const evidence = buildCycloneDxRolloutEvidencePack({
      decision,
      scannerId: 'free',
      progressStatus: 'ready_for_prod',
      currentStage: 'ready_for_prod',
      latestDecisionStatus: decision.status,
      latestDecision: { snapshot: snapshots[0] },
    });

    expect(evidence.promotionReady).toBe(true);
    expect(buildCycloneDxRolloutMarkdown(evidence)).toContain('CycloneDX M4 Staging Acceptance Report');
  });

  it('persists the aggregated decision into the rollout state', async () => {
    const upsertState = jest.fn();
    (upsertState as any).mockResolvedValue({ id: 'state-2' });
    const prisma = {
      cycloneDxRolloutState: { upsert: upsertState },
    } as const;

    const evidence = await persistCycloneDxRolloutDecision({
      prisma: prisma as any,
      scannerId: 'enterprise',
      currentStage: 'ready_for_prod',
      decision: evaluateCycloneDxStagingWindow({
        snapshots: [
          buildCycloneDxRolloutSnapshotRecord({
            id: 'snapshot-7',
            createdAt: new Date('2026-04-23T11:30:00.000Z'),
            scanResultId: 'scan-result-7',
            scannerId: 'enterprise',
            ingestionMeta: makeIngestionMeta({
              scanId: 'scan-result-7',
              scannerId: 'enterprise',
            }),
          }),
        ],
      }),
    });

    expect(evidence.phaseState.currentStage).toBe('ready_for_prod');
    expect(upsertState).toHaveBeenCalledTimes(1);
  });
});
