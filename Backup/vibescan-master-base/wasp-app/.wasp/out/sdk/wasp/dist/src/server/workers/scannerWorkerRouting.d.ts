import type { Job } from 'bullmq';
import type { QueueScannerTarget } from '../lib/scanners/providerSelection.js';
import { type ScanJob } from '../queues/jobContract.js';
export type ScannerWorkerRole = QueueScannerTarget;
export declare const scannerWorkerDefinitions: {
    readonly free: {
        readonly queueName: "free_scan_queue";
        readonly concurrency: 20;
        readonly label: "Free Scanner";
        readonly processor: (job: Job<ScanJob>) => Promise<unknown>;
    };
    readonly enterprise: {
        readonly queueName: "enterprise_scan_queue";
        readonly concurrency: 3;
        readonly label: "Enterprise Scanner";
        readonly processor: (job: Job<ScanJob>) => Promise<unknown>;
    };
};
//# sourceMappingURL=scannerWorkerRouting.d.ts.map