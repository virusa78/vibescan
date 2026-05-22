import {
  type Prisma,
  type PrismaClient,
  type ScanResult,
  type ScanSource,
} from '@prisma/client';
import { emitWebhookEvent, buildWebhookPayload } from './webhookEventEmitter.js';
import { resolveExpectedScanSources } from '../lib/scanners/providerSelection.js';
import { syncGitHubCheckRunForScan } from './githubCheckRunService.js';
import { createCanonicalEventInput } from './eventPublisher.js';
import { publishAndRouteCanonicalEventSafely } from './eventPublicationSafety.js';

type ScanWithResults = {
  id: string;
  status: string;
  userId: string;
  planAtSubmission: string;
  plannedSources?: ScanSource[] | null;
  scanResults: Array<Pick<ScanResult, 'source'>>;
};

type ScanPrismaClient = Pick<PrismaClient, 'scan' | 'githubInstallation' | 'scanResult' | 'scanDelta'>;

type FinalizeScanInput = {
  prisma: ScanPrismaClient;
  scanId: string;
  userId: string;
  findingsCount: number;
  loggerLabel: string;
};

type HandleScannerFailureInput = {
  prisma: ScanPrismaClient;
  scanId: string;
  userId: string;
  scannerId: ScanSource;
  errorMessage: string;
  loggerLabel: string;
};

function getCompletedScanners(scan: ScanWithResults): ScanSource[] {
  return scan.scanResults.map((result) => result.source as ScanSource);
}

function getPlannedSources(scan: ScanWithResults): ScanSource[] | null {
  return Array.isArray(scan.plannedSources) && scan.plannedSources.length > 0
    ? scan.plannedSources
    : null;
}

function buildFailureUpdate(
  scan: ScanWithResults,
  scannerId: ScanSource,
  errorMessage: string,
): Prisma.ScanUpdateInput | null {
  const completedAt = new Date();
  const expectedScanners = getPlannedSources(scan) ?? resolveExpectedScanSources(scan.planAtSubmission);
  const completedScanners = getCompletedScanners(scan);
  const otherExpectedScanners = expectedScanners.filter((source) => source !== scannerId);
  const hasOtherExpectedSuccess = otherExpectedScanners.some((source) =>
    completedScanners.includes(source),
  );

  if (expectedScanners.includes(scannerId)) {
    if (hasOtherExpectedSuccess) {
      return {
        status: 'done',
        completedAt,
        errorMessage,
      };
    }

    return {
      status: 'error',
      completedAt,
      errorMessage,
    };
  }

  if (completedScanners.some((source) => expectedScanners.includes(source))) {
    return null;
  }

  return {
    status: 'error',
    completedAt,
    errorMessage,
  };
}

function countJsonArrayItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

async function publishScanDomainEvents(
  prisma: ScanPrismaClient,
  input: {
    scanId: string;
    userId: string;
    status: 'done' | 'error';
    findingsCount?: number;
    errorMessage?: string;
  },
): Promise<void> {
  const scanResults = await prisma.scanResult.findMany({
    where: { scanId: input.scanId },
    select: {
      source: true,
      vulnerabilities: true,
    },
  });

  const countsBySource = scanResults.reduce<Record<string, number>>((acc, result) => {
    acc[result.source] = countJsonArrayItems(result.vulnerabilities);
    return acc;
  }, {});

  const totalCount = Object.values(countsBySource).reduce((sum, count) => sum + count, 0);
  const winnerEntry = Object.entries(countsBySource).sort((a, b) => b[1] - a[1])[0] ?? null;
  const scanDelta = await prisma.scanDelta.findUnique({
    where: { scanId: input.scanId },
    select: {
      deltaCount: true,
      deltaBySeverity: true,
      isLocked: true,
      totalFreeCount: true,
      totalEnterpriseCount: true,
    },
  });

  const baseExtras = {
    userId: input.userId,
    entityType: 'scan',
    entityId: input.scanId,
    correlationId: input.scanId,
  } as const;

  await publishAndRouteCanonicalEventSafely(
    createCanonicalEventInput(
      input.status === 'done' ? 'scan.completed' : 'scan.failed',
      'scan.lifecycle',
      {
        scanId: input.scanId,
        status: input.status,
        findingsCount: input.findingsCount ?? totalCount,
        errorMessage: input.errorMessage ?? null,
      },
      baseExtras,
    ),
    `scan.${input.status}`,
  );

  if (input.status !== 'done') {
    return;
  }

  await publishAndRouteCanonicalEventSafely(
    createCanonicalEventInput(
      'scanner.comparison.completed',
      'scan.lifecycle',
      {
        scanId: input.scanId,
        totalFindings: totalCount,
        findingsByScanner: countsBySource,
        totalFreeCount: scanDelta?.totalFreeCount ?? countsBySource.grype ?? 0,
        totalEnterpriseCount: scanDelta?.totalEnterpriseCount ?? Math.max(0, totalCount - (countsBySource.grype ?? 0)),
      },
      baseExtras,
    ),
    'scanner.comparison.completed',
  );

  await publishAndRouteCanonicalEventSafely(
    createCanonicalEventInput(
      'scanner.delta.computed',
      'scan.lifecycle',
      {
        scanId: input.scanId,
        deltaCount: scanDelta?.deltaCount ?? 0,
        deltaBySeverity: scanDelta?.deltaBySeverity ?? {},
        isLocked: scanDelta?.isLocked ?? false,
      },
      baseExtras,
    ),
    'scanner.delta.computed',
  );

  if (winnerEntry) {
    await publishAndRouteCanonicalEventSafely(
      createCanonicalEventInput(
        'scanner.winner.updated',
        'scan.lifecycle',
        {
          scanId: input.scanId,
          winnerScanner: winnerEntry[0],
          winnerCount: winnerEntry[1],
          findingsByScanner: countsBySource,
        },
        baseExtras,
      ),
      'scanner.winner.updated',
    );
  }
}

async function loadScanWithResults(
  prisma: ScanPrismaClient,
  scanId: string,
): Promise<ScanWithResults | null> {
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      scanResults: {
        select: {
          source: true,
        },
      },
    },
  });
}

export async function finalizeScanIfReady({
  prisma,
  scanId,
  userId,
  findingsCount,
  loggerLabel,
}: FinalizeScanInput): Promise<void> {
  const currentScan = await loadScanWithResults(prisma, scanId);

  if (!currentScan || currentScan.status !== 'scanning') {
    return;
  }

  const expectedScanners = getPlannedSources(currentScan) ?? resolveExpectedScanSources(currentScan.planAtSubmission);
  const completedScanners = getCompletedScanners(currentScan);
  const allExpectedComplete = expectedScanners.every((scanner) => completedScanners.includes(scanner));

  if (!allExpectedComplete) {
    return;
  }

  const completedAt = new Date();
  const completedScan = await prisma.scan.updateMany({
    where: {
      id: scanId,
      status: 'scanning',
    },
    data: {
      status: 'done',
      completedAt,
    },
  });

  if (completedScan.count === 0) {
    return;
  }

  try {
    await publishScanDomainEvents(prisma, {
      scanId,
      userId,
      status: 'done',
      findingsCount,
    });
  } catch (eventError) {
    console.error(`[${loggerLabel}] Failed to publish canonical scan events for ${scanId}:`, eventError);
  }

  try {
    await emitWebhookEvent({
      scanId,
      eventType: 'scan_complete',
      userId,
      payload: buildWebhookPayload('scan_complete', scanId, userId, {
        status: 'done',
        completedAt,
        findingsCount,
      }),
      timestamp: completedAt,
    });
  } catch (webhookError) {
    console.error(`[${loggerLabel}] Failed to emit webhook for scan ${scanId}:`, webhookError);
  }

  try {
    await syncGitHubCheckRunForScan({
      prisma,
      scanId,
      status: 'completed',
      findingsCount,
    });
  } catch (githubError) {
    console.error(`[${loggerLabel}] Failed to sync GitHub check run for scan ${scanId}:`, githubError);
  }
}

export async function handleScannerFailure({
  prisma,
  scanId,
  userId,
  scannerId,
  errorMessage,
  loggerLabel,
}: HandleScannerFailureInput): Promise<void> {
  const existingScan = await loadScanWithResults(prisma, scanId);

  if (!existingScan || existingScan.status !== 'scanning') {
    return;
  }

  const statusUpdate = buildFailureUpdate(existingScan, scannerId, errorMessage);
  if (!statusUpdate) {
    return;
  }
  const statusErrorMessage =
    typeof statusUpdate.errorMessage === 'string' ? statusUpdate.errorMessage : undefined;

  const updatedAt = new Date();
  const updatedScan = await prisma.scan.updateMany({
    where: {
      id: scanId,
      status: 'scanning',
    },
    data: statusUpdate,
  });

  if (updatedScan.count === 0) {
    return;
  }

  try {
    await publishScanDomainEvents(prisma, {
      scanId,
      userId,
      status: statusUpdate.status === 'error' ? 'error' : 'done',
      errorMessage: statusErrorMessage,
    });
  } catch (eventError) {
    console.error(`[${loggerLabel}] Failed to publish canonical scan events for ${scanId}:`, eventError);
  }

  try {
    const eventType = statusUpdate.status === 'error' ? 'scan_failed' : 'scan_complete';
    await emitWebhookEvent({
      scanId,
      eventType,
      userId,
      payload: buildWebhookPayload(eventType, scanId, userId, {
        status: statusUpdate.status,
        errorMessage: statusErrorMessage,
      }),
      timestamp: updatedAt,
    });
  } catch (webhookError) {
    console.error(`[${loggerLabel}] Failed to emit webhook for scan ${scanId}:`, webhookError);
  }

  try {
    await syncGitHubCheckRunForScan({
      prisma,
      scanId,
      status: 'completed',
      ...(statusUpdate.status === 'error'
        ? { errorMessage }
        : {}),
    });
  } catch (githubError) {
    console.error(`[${loggerLabel}] Failed to sync GitHub check run for scan ${scanId}:`, githubError);
  }
}
