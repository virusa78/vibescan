import type { ScanJobInputType } from '../../queues/jobContract.js';
import type { PlannedScannerExecution, QueueScannerTarget } from './executionPlan.js';
type EnqueuePlannedExecutionInput = {
    scanId: string;
    userId: string;
    inputType: ScanJobInputType;
    inputRef: string;
};
export type EnqueuedPlannedExecution = {
    provider: PlannedScannerExecution['provider'];
    queueTarget: QueueScannerTarget;
    resultSource: PlannedScannerExecution['resultSource'];
    jobId: string;
    queuePosition: number;
};
export declare function enqueuePlannedExecution(input: EnqueuePlannedExecutionInput, execution: PlannedScannerExecution): Promise<any>;
export {};
//# sourceMappingURL=enqueuePlannedExecution.d.ts.map