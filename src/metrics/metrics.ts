/**
 * Prometheus Metrics for VibeScan
 *
 * Implements metrics for:
 * - Queue depth
 * - Worker latency
 * - Error rate
 * - Quota usage
 * - Scan duration
 */

import { Counter, Gauge, Histogram, Registry, register } from 'prom-client';

/**
 * Prometheus metrics registry
 */
export const metricsRegistry = new Registry();

/**
 * Queue depth metrics (Gauge)
 */
export const queueDepth = new Gauge({
    name: 'vibescan_queue_depth',
    help: 'Current number of jobs in each queue',
    labelNames: ['queue_name'],
    registers: [metricsRegistry],
});

/**
 * Worker latency metrics (Histogram in seconds)
 */
export const workerLatency = new Histogram({
    name: 'vibescan_worker_latency_seconds',
    help: 'Time taken to process a worker job',
    labelNames: ['worker_type', 'status'],
    registers: [metricsRegistry],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1200],
});

/**
 * Error rate metrics (Counter)
 */
export const errorCount = new Counter({
    name: 'vibescan_error_total',
    help: 'Total number of errors by category',
    labelNames: ['error_type', 'service'],
    registers: [metricsRegistry],
});

/**
 * Quota usage metrics (Gauge)
 */
export const quotaUsage = new Gauge({
    name: 'vibescan_quota_usage',
    help: 'Current quota usage per user',
    labelNames: ['user_id', 'plan'],
    registers: [metricsRegistry],
});

/**
 * Scan duration metrics (Histogram in seconds)
 */
export const scanDuration = new Histogram({
    name: 'vibescan_scan_duration_seconds',
    help: 'Time taken to complete a scan',
    labelNames: ['source', 'status'],
    registers: [metricsRegistry],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800],
});

/**
 * HTTP request metrics (Histogram)
 */
export const httpRequests = new Histogram({
    name: 'vibescan_http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'path', 'status_code'],
    registers: [metricsRegistry],
});

/**
 * HTTP request count (Counter)
 */
export const httpRequestsTotal = new Counter({
    name: 'vibescan_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status_code'],
    registers: [metricsRegistry],
});

/**
 * Database connection pool metrics (Gauge)
 */
export const dbPoolSize = new Gauge({
    name: 'vibescan_db_pool_size',
    help: 'Database connection pool size',
    labelNames: ['pool'],
    registers: [metricsRegistry],
});

/**
 * Redis connection metrics (Gauge)
 */
export const redisConnections = new Gauge({
    name: 'vibescan_redis_connections',
    help: 'Active Redis connections',
    registers: [metricsRegistry],
});

/**
 * Scan status gauge
 */
export const scanStatus = new Gauge({
    name: 'vibescan_scan_status',
    help: 'Current scan status',
    labelNames: ['status'],
    registers: [metricsRegistry],
});

/**
 * API key usage metrics (Counter)
 */
export const apiKeyUsage = new Counter({
    name: 'vibescan_api_key_usage_total',
    help: 'API key usage count',
    labelNames: ['user_id', 'scope'],
    registers: [metricsRegistry],
});

/**
 * Webhook delivery metrics (Histogram)
 */
export const webhookDeliveryDuration = new Histogram({
    name: 'vibescan_webhook_delivery_duration_seconds',
    help: 'Time taken to deliver a webhook',
    labelNames: ['status'],
    registers: [metricsRegistry],
});

/**
 * Webhook delivery count (Counter)
 */
export const webhookDeliveries = new Counter({
    name: 'vibescan_webhook_deliveries_total',
    help: 'Total webhook deliveries',
    labelNames: ['status'],
    registers: [metricsRegistry],
});

/**
 * Update queue depth metric
 * @param queueName - Name of the queue
 * @param depth - Current queue depth
 */
export function updateQueueDepth(queueName: string, depth: number): void {
    queueDepth.labels(queueName).set(depth);
}

/**
 * Observe worker latency
 * @param workerType - Type of worker (free, enterprise)
 * @param latencySeconds - Latency in seconds
 * @param status - Job status (success, failed, timeout)
 */
export function observeWorkerLatency(
    workerType: string,
    latencySeconds: number,
    status: string
): void {
    workerLatency.labels(workerType, status).observe(latencySeconds);
}

/**
 * Increment error counter
 * @param errorType - Type of error
 * @param service - Service where error occurred
 */
export function incrementErrorCount(errorType: string, service: string): void {
    errorCount.labels(errorType, service).inc();
}

/**
 * Update quota usage metric
 * @param userId - User ID
 * @param usage - Current usage
 * @param plan - User plan
 */
export function updateQuotaUsage(userId: string, usage: number, plan: string): void {
    quotaUsage.labels(userId, plan).set(usage);
}

/**
 * Observe scan duration
 * @param source - Scanner source (free, enterprise)
 * @param durationSeconds - Duration in seconds
 * @param status - Scan status
 */
export function observeScanDuration(
    source: string,
    durationSeconds: number,
    status: string
): void {
    scanDuration.labels(source, status).observe(durationSeconds);
}

/**
 * Increment HTTP request counter
 * @param method - HTTP method
 * @param path - Request path
 * @param statusCode - HTTP status code
 */
export function incrementHttpRequestCounter(
    method: string,
    path: string,
    statusCode: number
): void {
    httpRequestsTotal.labels(method, path, statusCode.toString()).inc();
}

/**
 * Observe HTTP request duration
 * @param method - HTTP method
 * @param path - Request path
 * @param statusCode - HTTP status code
 * @param durationSeconds - Duration in seconds
 */
export function observeHttpRequestDuration(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number
): void {
    httpRequests.labels(method, path, statusCode.toString()).observe(durationSeconds);
}

/**
 * Update database pool size metric
 * @param poolName - Pool name
 * @param size - Current pool size
 * @param available - Available connections
 */
export function updateDbPoolSize(poolName: string, size: number, available: number): void {
    dbPoolSize.labels(poolName).set(available);
}

/**
 * Update Redis connection metric
 * @param connections - Active connections
 */
export function updateRedisConnections(connections: number): void {
    redisConnections.set(connections);
}

/**
 * Update scan status metric
 * @param status - Scan status
 * @param count - Number of scans with this status
 */
export function updateScanStatus(status: string, count: number): void {
    scanStatus.labels(status).set(count);
}

/**
 * Increment API key usage counter
 * @param userId - User ID
 * @param scope - API key scope
 */
export function incrementApiKeyUsage(userId: string, scope: string): void {
    apiKeyUsage.labels(userId, scope).inc();
}

/**
 * Observe webhook delivery duration
 * @param status - Delivery status
 * @param durationSeconds - Duration in seconds
 */
export function observeWebhookDeliveryDuration(
    status: string,
    durationSeconds: number
): void {
    webhookDeliveryDuration.labels(status).observe(durationSeconds);
}

/**
 * Increment webhook deliveries counter
 * @param status - Delivery status
 */
export function incrementWebhookDeliveries(status: string): void {
    webhookDeliveries.labels(status).inc();
}

/**
 * Collect all metrics
 * @returns Metrics string
 */
export function collectMetrics(): Promise<string> {
    return register.metrics();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
    register.clear();
}

export default {
    queueDepth,
    workerLatency,
    errorCount,
    quotaUsage,
    scanDuration,
    httpRequests,
    httpRequestsTotal,
    dbPoolSize,
    redisConnections,
    scanStatus,
    apiKeyUsage,
    webhookDeliveryDuration,
    webhookDeliveries,
    updateQueueDepth,
    observeWorkerLatency,
    incrementErrorCount,
    updateQuotaUsage,
    observeScanDuration,
    incrementHttpRequestCounter,
    observeHttpRequestDuration,
    updateDbPoolSize,
    updateRedisConnections,
    updateScanStatus,
    incrementApiKeyUsage,
    observeWebhookDeliveryDuration,
    incrementWebhookDeliveries,
    collectMetrics,
    resetMetrics,
};
