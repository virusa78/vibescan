import { PrismaClient } from '@prisma/client';
import type { Job } from 'bullmq';
import { getScannerProvider } from '../lib/scanners/scannerProviderRegistry.js';
import type { QueueScannerTarget } from '../lib/scanners/providerSelection.js';
import type { ScanJob } from '../queues/jobContract.js';
import { executeScannerForScan } from '../services/scannerExecutionService.js';
import type { ScannerExecutionPrismaClient } from '../services/scannerExecutionTypes.js';
import { handleJobFailure, SCAN_JOB_RETRY_CONFIG } from '../utils/retryPolicy.js';

const prisma = new PrismaClient();

function getLaneLabel(queueTarget: QueueScannerTarget): string {
  return queueTarget === 'enterprise' ? 'Enterprise Scanner' : 'Free Scanner';
}

export async function scannerExecutionWorker(
  job: Job<ScanJob>,
  expectedQueueTarget?: QueueScannerTarget,
) {
  const { scanId, userId, provider, resultSource, queueTarget, credentialSource } = job.data;

  if (expectedQueueTarget && queueTarget !== expectedQueueTarget) {
    throw new Error(
      `Scanner job lane mismatch for scan ${scanId}: expected ${expectedQueueTarget}, got ${queueTarget}`,
    );
  }

  const providerDefinition = getScannerProvider(provider);
  const loggerLabel = `${getLaneLabel(queueTarget)} / ${providerDefinition.displayName}`;

  try {
    return await executeScannerForScan({
      prisma: prisma as unknown as ScannerExecutionPrismaClient,
      scanId,
      userId,
      source: resultSource,
      providerKind: provider,
      credentialSource,
      loggerLabel,
    });
  } catch (error) {
    // Track retry attempt in database
    const attemptNumber = (job.attemptsMade ?? 0) + 1;
    await handleJobFailure(
      loggerLabel,
      scanId,
      job.id,
      attemptNumber,
      SCAN_JOB_RETRY_CONFIG.maxAttempts,
      error instanceof Error ? error : new Error(String(error)),
    );
    
    // Re-throw to trigger BullMQ retry mechanism
    throw error;
  }
}
