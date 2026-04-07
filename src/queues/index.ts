/**
 * Queue module exports
 *
 * Provides unified access to BullMQ queue functionality.
 */

export {
    getFreeScanQueue,
    getEnterpriseScanQueue,
    getWebhookDeliveryQueue,
    getReportGenerationQueue,
    getFreeScanQueueEvents,
    getEnterpriseScanQueueEvents,
    getWebhookDeliveryQueueEvents,
    getReportGenerationQueueEvents,
    createWorker,
    getWorkerConfigs,
    addJob,
    addFreeScanJob,
    addEnterpriseScanJob,
    addWebhookDeliveryJob,
    addReportGenerationJob,
    getQueueStats,
    closeAllQueues,
    QUEUE_FREE_SCAN,
    QUEUE_ENTERPRISE_SCAN,
    QUEUE_WEBHOOK_DELIVERY,
    QUEUE_REPORT_GENERATION,
    PRIORITY_WEIGHTS
} from './config.js';
