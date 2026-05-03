/**
 * Free Scanner Worker - Runs Grype vulnerability scanner.
 * Consumes GitHub-first scan jobs and legacy compatibility inputs.
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import type { ScanJob } from '../queues/jobContract.js';
import { executeScannerForScan } from '../services/scannerExecutionService.js';

const prisma = new PrismaClient();

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
