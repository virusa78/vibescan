/**
 * Free Scanner Worker - Runs Grype vulnerability scanner.
 * Consumes GitHub-first scan jobs and legacy compatibility inputs.
 */
import { Job } from 'bullmq';
import type { ScanJob } from '../queues/jobContract.js';
export declare function freeScannerWorker(job: Job<ScanJob>): Promise<import("../services/scannerExecutionTypes.js").ScannerExecutionResult>;
//# sourceMappingURL=freeScannerWorker.d.ts.map