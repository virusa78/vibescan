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

        // Get scan and user
        const scanResult = await pool.query(
            `SELECT s.id, s.user_id, s.status, s.plan_at_submission, s.created_at,
                    u.webhook_url
             FROM scans s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND u.webhook_url IS NOT NULL`,
            [scanId]
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

        // Build payload (excluding delta details for starter plan)
        const payload = this.buildPayload(scan, delta);

        // Create webhook delivery record
        const deliveryId = generateUUID();
        await pool.query(
            `INSERT INTO webhook_deliveries (id, scan_id, target_url, payload_hash, status)
             VALUES ($1, $2, $3, $4, 'pending')`,
            [deliveryId, scanId, scan.webhook_url, generateHMAC(JSON.stringify(payload), 'webhook')]
        );

        // Queue delivery job
        await addWebhookDeliveryJob(deliveryId, scanId, payload, scan.webhook_url);
    }

    /**
     * Build webhook payload
     * @param scan - Scan record
     * @param delta - Scan delta
     * @returns Payload object
     */
    buildPayload(scan: any, delta: any): any {
        // Determine if delta details should be excluded (starter plan)
        const isStarter = scan.plan_at_submission === 'starter';

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

        // For starter plan, only include counts - no vulnerability details
        if (isStarter) {
            return {
                scanId: scan.id,
                status: scan.status,
                summary: {
                    ...summary,
                    freeVulnerabilities: null,
                    enterpriseVulnerabilities: null,
                    deltaVulnerabilities: null
                }
            };
        }

        // For pro/enterprise, include full details
        return {
            scanId: scan.id,
            status: scan.status,
            summary: summary,
            freeVulnerabilities: [], // In production, fetch from DB
            enterpriseVulnerabilities: [], // In production, fetch from DB
            deltaVulnerabilities: delta?.delta_vulnerabilities || []
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

        // Calculate retry delay based on attempt number (exponential backoff)
        // 1 min, 5 min, 30 min, 2 hours, 24 hours
        const retryDelays = [60000, 300000, 1800000, 7200000, 86400000];
        const attemptNumber = delivery.attempt_number;
        const delay = retryDelays[attemptNumber - 1] || 86400000; // Default to 24 hours

        try {
            // Sign payload
            const signature = this.signPayload(JSON.stringify(payload), delivery.signing_secret || 'default');

            // Make HTTP POST request
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-VibeScan-Signature': signature
                },
                body: JSON.stringify(payload)
            });

            // Update delivery record
            await pool.query(
                `UPDATE webhook_deliveries
                 SET http_status = $1, delivered_at = NOW(), status = 'delivered'
                 WHERE id = $2`,
                [response.status, deliveryId]
            );

            console.log(`WebhookService: Delivered ${deliveryId} with status ${response.status}`);

        } catch (error: any) {
            // Update delivery record with error
            const nextAttempt = attemptNumber + 1;

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
                const nextRetryAt = new Date(Date.now() + delay);
                await pool.query(
                    `UPDATE webhook_deliveries
                     SET attempt_number = $1, next_retry_at = $2, status = 'failed'
                     WHERE id = $3`,
                    [nextAttempt, nextRetryAt, deliveryId]
                );
                console.log(`WebhookService: Scheduled retry ${nextAttempt} for ${deliveryId} at ${nextRetryAt}`);
            }
        }
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
        const signingSecret = require('crypto').randomBytes(32).toString('hex');

        // Check if webhook exists
        const existingResult = await pool.query(
            'SELECT id FROM webhooks WHERE user_id = $1',
            [userId]
        );

        if (existingResult.rows.length > 0) {
            // Update existing webhook
            await pool.query(
                `UPDATE webhooks SET url = $1, signing_secret = $2, enabled = TRUE
                 WHERE user_id = $3`,
                [url, signingSecret, userId]
            );
        } else {
            // Create new webhook
            await pool.query(
                `INSERT INTO webhooks (user_id, url, signing_secret, enabled)
                 VALUES ($1, $2, $3, TRUE)`,
                [userId, url, signingSecret]
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
