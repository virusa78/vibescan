/**
 * Free Scanner Worker - Runs Grype vulnerability scanner.
 * Consumes GitHub-first scan jobs and legacy compatibility inputs.
 */

import { Job } from 'bullmq';
import { prisma } from 'wasp/server';
import type { ScanJob } from '../queues/jobContract.js';
import { executeScannerForScan } from '../services/scannerExecutionService.js';

export async function freeScannerWorker(job: Job<ScanJob>) {
  const { scanId, userId } = job.data;
  return executeScannerForScan({
    prisma,
    scanId,
    userId,
    source: 'grype',
    providerKind: 'grype',
    loggerLabel: 'Free Scanner',
  });
}
