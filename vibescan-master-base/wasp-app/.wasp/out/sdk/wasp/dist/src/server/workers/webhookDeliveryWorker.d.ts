/**
 * Webhook Delivery Worker
 * Processes webhook delivery jobs from the queue
 * Handles HTTP POST, retry logic, and error handling
 */
import type { Job } from 'bullmq';
import type { WebhookDeliveryJob } from '../queues/jobContract.js';
/**
 * Process a webhook delivery job
 */
export declare function webhookDeliveryWorker(job: Job<WebhookDeliveryJob>): Promise<{
    success: boolean;
    status: number;
}>;
//# sourceMappingURL=webhookDeliveryWorker.d.ts.map