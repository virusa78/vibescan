import {
  type Prisma,
  type PrismaClient,
  type ScanResult,
  type ScanSource,
} from '@prisma/client';
import { emitWebhookEvent, buildWebhookPayload } from './webhookEventEmitter.js';
import { resolveExpectedScanSources } from '../lib/scanners/providerSelection.js';
import { syncGitHubCheckRunForScan } from './githubCheckRunService.js';

type ScanWithResults = {
  id: string;
  status: string;
  userId: string;
  planAtSubmission: string;
  plannedSources?: ScanSource[] | null;
  scanResults: Array<Pick<ScanResult, 'source'>>;
};

type ScanPrismaClient = Pick<PrismaClient, 'scan' | 'githubInstallation'>;

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
    const eventType = statusUpdate.status === 'error' ? 'scan_failed' : 'scan_complete';
    await emitWebhookEvent({
      scanId,
      eventType,
      userId,
      payload: buildWebhookPayload(eventType, scanId, userId, {
        status: statusUpdate.status,
        errorMessage: statusUpdate.errorMessage,
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
