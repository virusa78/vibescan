/**
 * WebhookService
 *
 * Delivers scan results via webhooks with HMAC-SHA256 signing.
 * Implements exponential backoff retry strategy.
 */

import { generateHMAC } from '../utils/index.js';
import { getPool } from '../database/client.js';
import { addWebhookDeliveryJob } from '../queues/config.js';
import { generateUUID } from '../utils/index.js';
import { randomBytes } from 'crypto';
import config from '../config/index.js';
import { getReportAccessPolicy } from './reportAccessPolicy.js';

const WEBHOOK_RETRY_DELAYS_MS = [60000, 300000, 1800000, 7200000, 86400000];

/**
 * WebhookService
 */
export class WebhookService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    /**
     * Schedule webhook delivery for a completed scan
     * @param scanId - Scan ID
     */
    async scheduleDelivery(scanId: string): Promise<void> {
        const pool = getPool();

        // Get scan and enabled webhook config
        const scanResult = await pool.query(
            `SELECT s.id, s.user_id, s.status, s.plan_at_submission, s.created_at,
                    w.id as webhook_id,
                    w.url as webhook_url,
                    pgp_sym_decrypt(w.signing_secret_encrypted::bytea, $2)::text as signing_secret
             FROM scans s
             JOIN webhooks w ON w.user_id = s.user_id
             WHERE s.id = $1 AND w.enabled = TRUE`,
            [scanId, config.ENCRYPTION_KEY]
        );

        if (scanResult.rows.length === 0) {
            return; // No webhook configured
        }

        const scan = scanResult.rows[0];

        // Get delta
        const deltaResult = await pool.query(
            'SELECT * FROM scan_deltas WHERE scan_id = $1',
            [scanId]
        );
        const delta = deltaResult.rows[0];

        // Get scan results for plan-aware payload shaping
        const resultsResult = await pool.query(
            'SELECT source, vulnerabilities FROM scan_results WHERE scan_id = $1',
            [scanId]
        );

        const payload = this.buildPayload(scan, delta, resultsResult.rows);
        const payloadString = this.serializePayload(payload);

        for (const webhook of scanResult.rows) {
            if (!webhook.signing_secret) {
                throw { code: 'webhook_signing_secret_missing', message: `Webhook signing secret missing for webhook ${webhook.webhook_id}` };
            }

            // Create webhook delivery record
            const deliveryId = generateUUID();
            await pool.query(
                `INSERT INTO webhook_deliveries (id, webhook_id, scan_id, target_url, payload_hash, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [deliveryId, webhook.webhook_id, scanId, webhook.webhook_url, generateHMAC(payloadString, webhook.signing_secret, 'sha256')]
            );

            // Queue delivery job
            await addWebhookDeliveryJob(deliveryId, scanId, payload, webhook.webhook_url);
        }
    }

    /**
     * Build webhook payload
     * @param scan - Scan record
     * @param delta - Scan delta
     * @returns Payload object
     */
    buildPayload(scan: any, delta: any, results: any[] = []): any {
        const freeVulnerabilities = results.find((r: any) => r.source === 'free')?.vulnerabilities || [];
        const enterpriseVulnerabilities = results.find((r: any) => r.source === 'enterprise')?.vulnerabilities || [];
        const policy = getReportAccessPolicy(scan.plan_at_submission);

        // Build summary
        const summary: any = {
            scanId: scan.id,
            status: scan.status,
            plan: scan.plan_at_submission,
            createdAt: scan.created_at,
            totalFreeCount: delta?.total_free_count || 0,
            totalEnterpriseCount: delta?.total_enterprise_count || 0,
            deltaCount: delta?.delta_count || 0,
            deltaBySeverity: delta?.delta_by_severity || {}
        };

        return {
            scanId: scan.id,
            status: scan.status,
            planAtSubmission: scan.plan_at_submission,
            locked: policy.locked,
            summary: summary,
            freeVulnerabilities,
            enterpriseVulnerabilities: policy.includeEnterpriseDetails ? enterpriseVulnerabilities : [],
            deltaVulnerabilities: policy.includeDeltaDetails ? (delta?.delta_vulnerabilities || []) : []
        };
    }

    /**
     * Sign payload with HMAC-SHA256
     * @param payload - Payload string
     * @param signingSecret - Webhook signing secret
     * @returns HMAC signature
     */
    signPayload(payload: string, signingSecret: string): string {
        return generateHMAC(payload, signingSecret, 'sha256');
    }

    private serializePayload(payload: any): string {
        return JSON.stringify(payload);
    }

    /**
     * Deliver webhook with exponential backoff retry
     * @param deliveryId - Delivery ID
     * @param payload - Payload to deliver
     * @param targetUrl - Target URL
     */
    async deliver(deliveryId: string, payload: any, targetUrl: string): Promise<void> {
        const pool = getPool();

        // Get delivery record
        const deliveryResult = await pool.query(
            'SELECT * FROM webhook_deliveries WHERE id = $1',
            [deliveryId]
        );

        if (deliveryResult.rows.length === 0) {
            throw { code: 'not_found', message: 'Webhook delivery not found' };
        }

        const delivery = deliveryResult.rows[0];

        const attemptNumber = Number(delivery.attempt_number || 1);
        const nextAttempt = attemptNumber + 1;

        try {
            // Sign payload
            const signingSecret = await this.getSigningSecretForDelivery(deliveryId);
            const serializedPayload = this.serializePayload(payload);
            const signature = this.signPayload(serializedPayload, signingSecret);

            // Make HTTP POST request
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-VibeScan-Signature': signature
                },
                body: serializedPayload
            });

            if (!response.ok) {
                throw new Error(`Webhook delivery failed with status ${response.status}`);
            }

            // Update delivery record
            await pool.query(
                `UPDATE webhook_deliveries
                 SET http_status = $1, delivered_at = NOW(), status = 'delivered'
                 WHERE id = $2`,
                [response.status, deliveryId]
            );

            console.log(`WebhookService: Delivered ${deliveryId} with status ${response.status}`);

        } catch (error: any) {
            if (nextAttempt > 5) {
                // Exhausted all retries
                await pool.query(
                    `UPDATE webhook_deliveries
                     SET status = 'exhausted', next_retry_at = NULL
                     WHERE id = $1`,
                    [deliveryId]
                );
                console.log(`WebhookService: Delivery ${deliveryId} exhausted after 5 attempts`);
            } else {
                // Schedule next retry
                const delay = WEBHOOK_RETRY_DELAYS_MS[attemptNumber - 1] || WEBHOOK_RETRY_DELAYS_MS[WEBHOOK_RETRY_DELAYS_MS.length - 1];
                const nextRetryAt = new Date(Date.now() + delay);
                await pool.query(
                    `UPDATE webhook_deliveries
                     SET attempt_number = $1, next_retry_at = $2, status = 'failed'
                     WHERE id = $3`,
                    [nextAttempt, nextRetryAt, deliveryId]
                );
                await addWebhookDeliveryJob(deliveryId, delivery.scan_id, payload, targetUrl, { delay });
                console.log(`WebhookService: Scheduled retry ${nextAttempt} for ${deliveryId} at ${nextRetryAt}`);
            }
        }
    }

    private async getSigningSecretForDelivery(deliveryId: string): Promise<string> {
        const pool = getPool();
        const result = await pool.query(
            `SELECT pgp_sym_decrypt(w.signing_secret_encrypted::bytea, $2)::text as signing_secret
             FROM webhook_deliveries wd
             JOIN webhooks w ON wd.webhook_id = w.id
             WHERE wd.id = $1`,
            [deliveryId, config.ENCRYPTION_KEY]
        );

        const signingSecret = result.rows[0]?.signing_secret;
        if (!signingSecret) {
            throw { code: 'webhook_signing_secret_missing', message: `Signing secret missing for delivery ${deliveryId}` };
        }

        return signingSecret;
    }

    /**
     * List webhook deliveries for a scan
     * @param scanId - Scan ID
     * @param userId - User ID (for ownership verification)
     * @returns List of deliveries
     */
    async listDeliveries(scanId: string, userId: string): Promise<any[]> {
        const pool = getPool();

        // Verify ownership
        const scanResult = await pool.query(
            'SELECT id, user_id FROM scans WHERE id = $1',
            [scanId]
        );

        if (scanResult.rows.length === 0) {
            throw { code: 'not_found', message: 'Scan not found' };
        }

        const scan = scanResult.rows[0];

        if (scan.user_id !== userId) {
            throw { code: 'forbidden', message: 'Cannot access scan' };
        }

        // Get deliveries
        const result = await pool.query(
            `SELECT id, target_url, attempt_number, http_status, delivered_at,
                    status, created_at
             FROM webhook_deliveries
             WHERE scan_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [scanId]
        );

        return result.rows;
    }

    /**
     * Configure webhook URL for user
     * @param userId - User ID
     * @param url - Webhook URL
     */
    async configureWebhook(userId: string, url: string): Promise<void> {
        const pool = getPool();

        // Generate signing secret
        const signingSecret = randomBytes(32).toString('hex');

        // Check if webhook exists
        const existingResult = await pool.query(
            'SELECT id FROM webhooks WHERE user_id = $1',
            [userId]
        );

        if (existingResult.rows.length > 0) {
            // Update existing webhook
            await pool.query(
                `UPDATE webhooks
                 SET url = $1, signing_secret_encrypted = pgp_sym_encrypt($2, $3), enabled = TRUE
                 WHERE user_id = $4`,
                [url, signingSecret, config.ENCRYPTION_KEY, userId]
            );
        } else {
            // Create new webhook
            await pool.query(
                `INSERT INTO webhooks (user_id, url, signing_secret_encrypted, enabled)
                 VALUES ($1, $2, pgp_sym_encrypt($3, $4), TRUE)`,
                [userId, url, signingSecret, config.ENCRYPTION_KEY]
            );
        }
    }

    /**
     * Get webhook for user
     * @param userId - User ID
     * @returns Webhook or null
     */
    async getWebhook(userId: string): Promise<any | null> {
        const pool = getPool();

        const result = await pool.query(
            'SELECT id, url, enabled, created_at FROM webhooks WHERE user_id = $1',
            [userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Disable webhook
     * @param userId - User ID
     */
    async disableWebhook(userId: string): Promise<void> {
        const pool = getPool();

        await pool.query(
            'UPDATE webhooks SET enabled = FALSE WHERE user_id = $1',
            [userId]
        );
    }
}

export const webhookService = new WebhookService();

export default webhookService;
