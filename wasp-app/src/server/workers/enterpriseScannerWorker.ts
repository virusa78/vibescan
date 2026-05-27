/**
 * Enterprise Scanner Worker - Calls Codescoring/BlackDuck API
 * Handles premium vulnerability scanning for enterprise plans
 */

import { Job } from 'bullmq';
import { prisma } from 'wasp/server';
import type { ScanJob } from '../queues/jobContract.js';
import { executeScannerForScan } from '../services/scannerExecutionService.js';

export async function enterpriseScannerWorker(job: Job<ScanJob>) {
  const { scanId, userId } = job.data;
  return executeScannerForScan({
    prisma,
    scanId,
    userId,
    source: 'codescoring_johnny',
    providerKind: 'codescoring-johnny',
    loggerLabel: 'Enterprise Scanner',
  });
}
