/**
 * Alerting Rules for VibeScan
 *
 * Prometheus alerting rules for:
 * - Queue backlog (depth > 1000)
 * - High error rate (> 10%)
 * - Quota exhaustion warning (> 90%)
 * - Worker failure alert
 */

/**
 * Alerting rules configuration
 */
export const alertingRules = {
    groups: [
        {
            name: 'vibescan_alerts',
            rules: [
                {
                    alert: 'QueueBacklogHigh',
                    expr: 'vibescan_queue_depth > 1000',
                    for: '5m',
                    labels: {
                        severity: 'warning',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Queue backlog is high',
                        description: 'Queue {{ $labels.queue_name }} has {{ $value }} jobs waiting',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/queue-backlog',
                    },
                },
                {
                    alert: 'QueueBacklogCritical',
                    expr: 'vibescan_queue_depth > 5000',
                    for: '2m',
                    labels: {
                        severity: 'critical',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Queue backlog is critical',
                        description: 'Queue {{ $labels.queue_name }} has {{ $value }} jobs waiting',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/queue-backlog-critical',
                    },
                },
                {
                    alert: 'HighErrorRate',
                    expr: 'rate(vibescan_error_total[5m]) / rate(vibescan_http_requests_total[5m]) * 100 > 10',
                    for: '5m',
                    labels: {
                        severity: 'critical',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'High error rate detected',
                        description: 'Error rate is {{ $value }}% over the last 5 minutes',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/high-error-rate',
                    },
                },
                {
                    alert: 'ErrorRateSpike',
                    expr: 'increase(vibescan_error_total[1m]) > 10',
                    for: '1m',
                    labels: {
                        severity: 'warning',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Error rate spike detected',
                        description: '{{ $value }} errors in the last minute',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/error-rate-spike',
                    },
                },
                {
                    alert: 'QuotaExhaustionWarning',
                    expr: 'avg(vibescan_quota_usage) by (user_id) / avg(vibescan_quota_limit) by (user_id) * 100 > 90',
                    for: '10m',
                    labels: {
                        severity: 'warning',
                        team: 'billing',
                    },
                    annotations: {
                        summary: 'User quota approaching limit',
                        description: 'User {{ $labels.user_id }} is at {{ $value }}% of quota',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/quota-exhaustion',
                    },
                },
                {
                    alert: 'QuotaExceeded',
                    expr: 'vibescan_quota_remaining < 1',
                    for: '5m',
                    labels: {
                        severity: 'critical',
                        team: 'billing',
                    },
                    annotations: {
                        summary: 'User quota exceeded',
                        description: 'User {{ $labels.user_id }} has exceeded their quota',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/quota-exceeded',
                    },
                },
                {
                    alert: 'WorkerFailure',
                    expr: 'increase(vibescan_worker_latency_seconds_count{status="failed"}[5m]) > 5',
                    for: '5m',
                    labels: {
                        severity: 'critical',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Worker failures detected',
                        description: '{{ $value }} worker failures in the last 5 minutes',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/worker-failure',
                    },
                },
                {
                    alert: 'WorkerTimeout',
                    expr: 'increase(vibescan_worker_latency_seconds_count{status="timeout"}[10m]) > 3',
                    for: '10m',
                    labels: {
                        severity: 'warning',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Worker timeouts detected',
                        description: '{{ $value }} worker timeouts in the last 10 minutes',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/worker-timeout',
                    },
                },
                {
                    alert: 'DatabasePoolExhausted',
                    expr: 'vibescan_db_pool_size < 5',
                    for: '2m',
                    labels: {
                        severity: 'critical',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Database pool exhausted',
                        description: 'Database pool has fewer than 5 available connections',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/database-pool',
                    },
                },
                {
                    alert: 'RedisConnectionLow',
                    expr: 'vibescan_redis_connections < 3',
                    for: '5m',
                    labels: {
                        severity: 'warning',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Redis connections low',
                        description: 'Active Redis connections are below 3',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/redis-connections',
                    },
                },
                {
                    alert: 'ScanDurationHigh',
                    expr: 'histogram_quantile(0.95, rate(vibescan_scan_duration_seconds_bucket[5m])) > 300',
                    for: '15m',
                    labels: {
                        severity: 'warning',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Scan duration high',
                        description: '95th percentile scan duration is above 300 seconds',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/scan-duration',
                    },
                },
                {
                    alert: 'WebhookDeliveryFailure',
                    expr: 'increase(vibescan_webhook_deliveries_total{status="failed"}[5m]) > 5',
                    for: '5m',
                    labels: {
                        severity: 'warning',
                        team: 'platform',
                    },
                    annotations: {
                        summary: 'Webhook delivery failures',
                        description: '{{ $value }} webhook deliveries failed in the last 5 minutes',
                        runbook_url: 'https://runbooks.vibescan.io/alerts/webhook-delivery',
                    },
                },
            ],
        },
    ],
};

/**
 * Get alerting rules as YAML string
 */
export function getAlertingRulesYaml(): string {
    const yaml = require('js-yaml');
    return yaml.dump(alertingRules);
}

/**
 * Validate alerting rules
 */
export function validateAlertingRules(): boolean {
    try {
        const yaml = require('js-yaml');
        yaml.load(getAlertingRulesYaml());
        return true;
    } catch (error) {
        console.error('Invalid alerting rules:', error);
        return false;
    }
}

export default {
    alertingRules,
    getAlertingRulesYaml,
    validateAlertingRules,
};
