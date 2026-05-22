/**
 * BullMQ Queue Configuration
 * Defines free and enterprise scan queues with priority levels
 */
import { Queue } from 'bullmq';
import { type EventDeliveryJob, type QueueWorkerStatus, type ScanJob, type WebhookDeliveryJob } from './jobContract.js';
export declare const freeScanQueue: Queue<ScanJob, any, string, ScanJob, any, string>;
export declare const enterpriseScanQueue: Queue<ScanJob, any, string, ScanJob, any, string>;
export declare const webhookDeliveryQueue: Queue<WebhookDeliveryJob, any, string, WebhookDeliveryJob, any, string>;
export declare const eventDeliveryQueue: Queue<EventDeliveryJob, any, string, EventDeliveryJob, any, string>;
export declare function initializeWorkers(): Promise<void>;
export declare function closeWorkers(): Promise<void>;
export declare function getWorkerStatus(): QueueWorkerStatus;
//# sourceMappingURL=config.d.ts.map