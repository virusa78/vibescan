/**
 * Alert Manager for VibeScan
 *
 * Manages alert notifications and integrations
 */

import { getPool } from '../database/client.js';

/**
 * Alert types
 */
export type AlertType = 'queue_backlog' | 'error_rate' | 'quota_exhaustion' | 'worker_failure' | 'database_pool' | 'redis_connections' | 'scan_duration' | 'webhook_failure';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Alert interface
 */
export interface Alert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    details: Record<string, any>;
    triggered_at: string;
    acknowledged_at?: string;
    resolved_at?: string;
    acknowledged_by?: string;
}

/**
 * Alert Manager
 */
export class AlertManager {
    private pool: any;
    private webhookUrl: string | null;
    private slackWebhookUrl: string | null;

    constructor() {
        this.pool = getPool();
        this.webhookUrl = process.env.ALERT_WEBHOOK_URL || null;
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    }

    /**
     * Create a new alert
     * @param type - Alert type
     * @param severity - Alert severity
     * @param message - Alert message
     * @param details - Additional details
     * @returns Created alert
     */
    async createAlert(
        type: AlertType,
        severity: AlertSeverity,
        message: string,
        details: Record<string, any> = {}
    ): Promise<Alert> {
        const alertId = this.generateUUID();
        const now = new Date().toISOString();

        const alert: Alert = {
            id: alertId,
            type,
            severity,
            message,
            details,
            triggered_at: now,
        };

        // Store alert in database
        await this.pool.query(
            `INSERT INTO alerts (id, type, severity, message, details, triggered_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alertId, type, severity, message, JSON.stringify(details), now]
        );

        // Send notification
        await this.sendNotification(alert);

        return alert;
    }

    /**
     * Acknowledge an alert
     * @param alertId - Alert ID
     * @param userId - User ID acknowledging the alert
     */
    async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
        const now = new Date().toISOString();

        await this.pool.query(
            `UPDATE alerts SET acknowledged_at = $1, acknowledged_by = $2 WHERE id = $3`,
            [now, userId, alertId]
        );
    }

    /**
     * Resolve an alert
     * @param alertId - Alert ID
     */
    async resolveAlert(alertId: string): Promise<void> {
        const now = new Date().toISOString();

        await this.pool.query(
            `UPDATE alerts SET resolved_at = $1 WHERE id = $2`,
            [now, alertId]
        );
    }

    /**
     * Get active alerts for a user or all
     * @param userId - Optional user ID
     * @returns List of active alerts
     */
    async getActiveAlerts(userId?: string): Promise<Alert[]> {
        let result;
        if (userId) {
            result = await this.pool.query(
                `SELECT * FROM alerts
                 WHERE acknowledged_at IS NULL AND resolved_at IS NULL
                 ORDER BY triggered_at DESC`,
                [userId]
            );
        } else {
            result = await this.pool.query(
                `SELECT * FROM alerts
                 WHERE acknowledged_at IS NULL AND resolved_at IS NULL
                 ORDER BY triggered_at DESC`
            );
        }

        return result.rows;
    }

    /**
     * Send alert notification
     * @param alert - Alert to notify
     */
    private async sendNotification(alert: Alert): Promise<void> {
        const payload = {
            alert: {
                id: alert.id,
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                details: alert.details,
                triggered_at: alert.triggered_at,
            },
            timestamp: new Date().toISOString(),
        };

        // Send to webhook
        if (this.webhookUrl) {
            try {
                await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } catch (error) {
                console.error('Failed to send webhook notification:', error);
            }
        }

        // Send to Slack
        if (this.slackWebhookUrl) {
            try {
                const slackPayload = {
                    attachments: [
                        {
                            color: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good',
                            title: `[${alert.severity.toUpperCase()}] ${alert.type.replace('_', ' ')}`,
                            text: alert.message,
                            fields: [
                                {
                                    title: 'Details',
                                    value: JSON.stringify(alert.details, null, 2),
                                    short: false,
                                },
                            ],
                            ts: Math.floor(new Date(alert.triggered_at).getTime() / 1000),
                        },
                    ],
                };

                await fetch(this.slackWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slackPayload),
                });
            } catch (error) {
                console.error('Failed to send Slack notification:', error);
            }
        }
    }

    /**
     * Generate a UUID
     */
    private generateUUID(): string {
        return require('crypto').randomUUID();
    }

    /**
     * Check if an alert should be suppressed (cooldown period)
     * @param type - Alert type
     * @param cooldownMinutes - Cooldown period in minutes
     * @returns true if alert should be suppressed
     */
    private async shouldSuppressAlert(type: AlertType, cooldownMinutes: number = 5): Promise<boolean> {
        const now = new Date();
        const cooldownDate = new Date(now.getTime() - cooldownMinutes * 60 * 1000);

        const result = await this.pool.query(
            `SELECT 1 FROM alerts WHERE type = $1 AND triggered_at > $2 LIMIT 1`,
            [type, cooldownDate]
        );

        return result.rows.length > 0;
    }
}

// Export singleton instance
export const alertManager = new AlertManager();

export default alertManager;
