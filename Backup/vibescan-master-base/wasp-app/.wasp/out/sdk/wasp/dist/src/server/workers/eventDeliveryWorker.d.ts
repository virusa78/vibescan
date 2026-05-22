import type { Job } from 'bullmq';
import type { EventDeliveryJob } from '../queues/jobContract.js';
export declare function eventDeliveryWorker(job: Job<EventDeliveryJob>): Promise<{
    success: boolean;
    status: number;
}>;
//# sourceMappingURL=eventDeliveryWorker.d.ts.map