/**
 * Shared queue/job contracts
 */
import type { ScanSource } from '@prisma/client';
import type { QueueScannerTarget } from '../lib/scanners/providerSelection.js';
import type { ScannerCredentialSource, ScannerProviderKind } from '../lib/scanners/providerTypes.js';
export declare const QUEUE_NAMES: {
    readonly FREE_SCAN: "free_scan_queue";
    readonly ENTERPRISE_SCAN: "enterprise_scan_queue";
    readonly WEBHOOK_DELIVERY: "webhook_delivery_queue";
    readonly EVENT_DELIVERY: "event_delivery_queue";
};
export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
export type ScanJobInputType = 'source_zip' | 'sbom_upload' | 'github_app';
export interface ScanJob {
    scanId: string;
    userId: string;
    inputType: ScanJobInputType;
    inputRef: string;
    s3Bucket: string;
    provider: ScannerProviderKind;
    queueTarget: QueueScannerTarget;
    resultSource: ScanSource;
    credentialSource: ScannerCredentialSource;
}
export interface WebhookDeliveryJob {
    deliveryId: string;
    webhookId: string;
    scanId: string;
    eventType: string;
    payload: string;
    payloadHash: string;
    targetUrl: string;
    signingSecretEncrypted: Buffer;
    attemptNumber: number;
}
export interface EventDeliveryJob {
    deliveryId: string;
    eventOutboxId: string;
    subscriptionId: string;
    destinationType: string;
    attemptNumber: number;
}
export interface WorkerStatusSnapshot {
    isRunning: boolean;
    isPaused: boolean;
}
export interface QueueWorkerStatus {
    free: WorkerStatusSnapshot;
    enterprise: WorkerStatusSnapshot;
    webhook: WorkerStatusSnapshot;
    event: WorkerStatusSnapshot;
}
//# sourceMappingURL=jobContract.d.ts.map