import type { Job } from 'bullmq';
import type { QueueScannerTarget } from '../lib/scanners/providerSelection.js';
import type { ScanJob } from '../queues/jobContract.js';
export declare function scannerExecutionWorker(job: Job<ScanJob>, expectedQueueTarget?: QueueScannerTarget): Promise<import("../services/scannerExecutionTypes.js").ScannerExecutionResult>;
//# sourceMappingURL=scannerExecutionWorker.d.ts.map