/**
 * Webhook Delivery Service
 * Manages webhook event queuing and delivery orchestration
 */
export type WebhookEventType = 'scan_complete' | 'scan_failed' | 'report_ready';
export type WebhookPayloadData = Record<string, unknown>;
export interface WebhookEvent {
    scanId: string;
    eventType: WebhookEventType;
    userId: string;
    payload: WebhookPayloadData;
    timestamp: Date;
}
/**
 * Emit a webhook event
 * Finds all webhooks subscribed to the event and enqueues delivery jobs
 * @param event The webhook event to emit
 */
export declare function emitWebhookEvent(event: WebhookEvent): Promise<void>;
/**
 * Build a webhook payload for a scan event
 */
export declare function buildWebhookPayload(eventType: WebhookEventType, scanId: string, userId: string, scanData: WebhookPayloadData): {
    event: WebhookEventType;
    timestamp: string;
    data: {
        scanId: string;
        userId: string;
    } & WebhookPayloadData;
};
//# sourceMappingURL=webhookEventEmitter.d.ts.map