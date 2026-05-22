/**
 * Enterprise Scanner Worker - Calls Codescoring/BlackDuck API
 * Handles premium vulnerability scanning for enterprise plans
 */
import { Job } from 'bullmq';
import type { ScanJob } from '../queues/jobContract.js';
export declare function enterpriseScannerWorker(job: Job<ScanJob>): Promise<import("../services/scannerExecutionTypes.js").ScannerExecutionResult>;
//# sourceMappingURL=enterpriseScannerWorker.d.ts.map