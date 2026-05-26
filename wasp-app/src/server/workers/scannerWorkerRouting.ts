import type { Job } from 'bullmq';
import type { QueueScannerTarget } from '../lib/scanners/providerSelection.js';
import { QUEUE_NAMES, type ScanJob } from '../queues/jobContract.js';
import { scannerExecutionWorker } from './scannerExecutionWorker.js';

export type ScannerWorkerRole = QueueScannerTarget;

type ScannerWorkerDefinition = {
  queueName: string;
  concurrency: number;
  label: string;
  processor: (job: Job<ScanJob>) => Promise<unknown>;
};

function createScannerLaneProcessor(
  queueTarget: QueueScannerTarget,
): (job: Job<ScanJob>) => Promise<unknown> {
  return (job) => scannerExecutionWorker(job, queueTarget);
}

export const scannerWorkerDefinitions = {
  free: {
    queueName: QUEUE_NAMES.FREE_SCAN,
    concurrency: Number(process.env.FREE_SCAN_CONCURRENCY) || 20,
    label: 'Free Scanner',
    processor: createScannerLaneProcessor('free'),
  },
  enterprise: {
    queueName: QUEUE_NAMES.ENTERPRISE_SCAN,
    concurrency: Number(process.env.ENTERPRISE_SCAN_CONCURRENCY) || 3,
    label: 'Enterprise Scanner',
    processor: createScannerLaneProcessor('enterprise'),
  },
} satisfies Record<ScannerWorkerRole, ScannerWorkerDefinition>;
