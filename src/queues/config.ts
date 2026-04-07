/**
 * Queue configuration using BullMQ
 *
 * Manages four queues:
 * - free_scan_queue: High throughput, 20 workers
 * - enterprise_scan_queue: Limited concurrency, 3 workers max
 * - webhook_delivery_queue: Retry with backoff
 * - report_generation_queue: Async PDF generation
 */

import { Queue, QueueEvents, Worker, QueueOptions, WorkerOptions } from 'bullmq';

// Queue configuration
const QUEUE_PREFIX = 'vibescan_queue_';

// Queue names
export const QUEUE_FREE_SCAN = `${QUEUE_PREFIX}free_scan`;
export const QUEUE_ENTERPRISE_SCAN = `${QUEUE_PREFIX}enterprise_scan`;
export const QUEUE_WEBHOOK_DELIVERY = `${QUEUE_PREFIX}webhook_delivery`;
export const QUEUE_REPORT_GENERATION = `${QUEUE_PREFIX}report_generation`;

// Get Redis connection configuration from environment
function getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        // Parse Redis URL: redis://[host]:[port]
        const url = new URL(redisUrl);
        return {
            host: url.hostname,
            port: parseInt(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined
        };
    }
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
    };
}

// Queue settings
const QUEUE_SETTINGS: Record<string, Partial<QueueOptions>> = {
    [QUEUE_FREE_SCAN]: {
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: false
        },
        connection: getRedisConnection()
    },
    [QUEUE_ENTERPRISE_SCAN]: {
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false
        },
        connection: getRedisConnection()
    },
    [QUEUE_WEBHOOK_DELIVERY]: {
        defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 60000 // Start with 1 minute
            },
            removeOnComplete: true,
            removeOnFail: false
        },
        connection: getRedisConnection()
    },
    [QUEUE_REPORT_GENERATION]: {
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false
        },
        connection: getRedisConnection()
    }
};

// Priority weights for enterprise queue
export const PRIORITY_WEIGHTS = {
    enterprise: 100,
    pro: 50,
    starter: 10,
    free_trial: 5
};

// Queue instances
let freeScanQueue: Queue | null = null;
let enterpriseScanQueue: Queue | null = null;
let webhookDeliveryQueue: Queue | null = null;
let reportGenerationQueue: Queue | null = null;

// Queue events listeners
let freeScanQueueEvents: QueueEvents | null = null;
let enterpriseScanQueueEvents: QueueEvents | null = null;
let webhookDeliveryQueueEvents: QueueEvents | null = null;
let reportGenerationQueueEvents: QueueEvents | null = null;

/**
 * Get queue instance
 */
async function getQueue(name: string): Promise<Queue> {
    const settings = QUEUE_SETTINGS[name] as QueueOptions;
    const queue = new Queue(name, settings);
    return queue;
}

/**
 * Get free scan queue
 */
export async function getFreeScanQueue(): Promise<Queue> {
    if (!freeScanQueue) {
        freeScanQueue = await getQueue(QUEUE_FREE_SCAN);
    }
    return freeScanQueue;
}

/**
 * Get enterprise scan queue
 */
export async function getEnterpriseScanQueue(): Promise<Queue> {
    if (!enterpriseScanQueue) {
        enterpriseScanQueue = await getQueue(QUEUE_ENTERPRISE_SCAN);
    }
    return enterpriseScanQueue;
}

/**
 * Get webhook delivery queue
 */
export async function getWebhookDeliveryQueue(): Promise<Queue> {
    if (!webhookDeliveryQueue) {
        webhookDeliveryQueue = await getQueue(QUEUE_WEBHOOK_DELIVERY);
    }
    return webhookDeliveryQueue;
}

/**
 * Get report generation queue
 */
export async function getReportGenerationQueue(): Promise<Queue> {
    if (!reportGenerationQueue) {
        reportGenerationQueue = await getQueue(QUEUE_REPORT_GENERATION);
    }
    return reportGenerationQueue;
}

/**
 * Get queue events listener
 */
async function getQueueEvents(name: string): Promise<QueueEvents> {
    return new QueueEvents(name, { connection: getRedisConnection() });
}

/**
 * Get free scan queue events
 */
export async function getFreeScanQueueEvents(): Promise<QueueEvents> {
    if (!freeScanQueueEvents) {
        freeScanQueueEvents = await getQueueEvents(QUEUE_FREE_SCAN);
    }
    return freeScanQueueEvents;
}

/**
 * Get enterprise scan queue events
 */
export async function getEnterpriseScanQueueEvents(): Promise<QueueEvents> {
    if (!enterpriseScanQueueEvents) {
        enterpriseScanQueueEvents = await getQueueEvents(QUEUE_ENTERPRISE_SCAN);
    }
    return enterpriseScanQueueEvents;
}

/**
 * Get webhook delivery queue events
 */
export async function getWebhookDeliveryQueueEvents(): Promise<QueueEvents> {
    if (!webhookDeliveryQueueEvents) {
        webhookDeliveryQueueEvents = await getQueueEvents(QUEUE_WEBHOOK_DELIVERY);
    }
    return webhookDeliveryQueueEvents;
}

/**
 * Get report generation queue events
 */
export async function getReportGenerationQueueEvents(): Promise<QueueEvents> {
    if (!reportGenerationQueueEvents) {
        reportGenerationQueueEvents = await getQueueEvents(QUEUE_REPORT_GENERATION);
    }
    return reportGenerationQueueEvents;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
    name: string;
    concurrency: number;
    processor: (job: any) => Promise<void>;
}

/**
 * Create a worker
 */
export async function createWorker(config: WorkerConfig): Promise<Worker> {
    const worker = new Worker(config.name, config.processor, {
        connection: getRedisConnection(),
        concurrency: config.concurrency,
        lockDuration: 60000, // 60 seconds
        maxStalledCount: 3
    });

    worker.on('completed', (job) => {
        console.log(`Worker ${config.name}: Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
        console.error(`Worker ${config.name}: Job ${job?.id} failed:`, error);
    });

    return worker;
}

/**
 * Get worker configurations for each queue
 */
export function getWorkerConfigs(): WorkerConfig[] {
    return [
        {
            name: QUEUE_FREE_SCAN,
            concurrency: 20,
            processor: async (job) => {
                // Free scanner worker implementation
                console.log('Processing free scan:', job.id);
            }
        },
        {
            name: QUEUE_ENTERPRISE_SCAN,
            concurrency: 3,
            processor: async (job) => {
                // Enterprise scanner worker implementation
                console.log('Processing enterprise scan:', job.id);
            }
        },
        {
            name: QUEUE_WEBHOOK_DELIVERY,
            concurrency: 10,
            processor: async (job) => {
                // Webhook delivery worker implementation
                console.log('Processing webhook delivery:', job.id);
            }
        },
        {
            name: QUEUE_REPORT_GENERATION,
            concurrency: 5,
            processor: async (job) => {
                // Report generation worker implementation
                console.log('Processing report generation:', job.id);
            }
        }
    ];
}

/**
 * Add a job to a queue
 */
export async function addJob(
    queueName: string,
    name: string,
    data: any,
    options?: { priority?: number; delay?: number }
): Promise<string> {
    let queue: Queue;

    switch (queueName) {
        case QUEUE_FREE_SCAN:
            queue = await getFreeScanQueue();
            break;
        case QUEUE_ENTERPRISE_SCAN:
            queue = await getEnterpriseScanQueue();
            break;
        case QUEUE_WEBHOOK_DELIVERY:
            queue = await getWebhookDeliveryQueue();
            break;
        case QUEUE_REPORT_GENERATION:
            queue = await getReportGenerationQueue();
            break;
        default:
            throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.add(name, data, {
        priority: options?.priority,
        delay: options?.delay
    });

    return job.id;
}

/**
 * Add a free scan job
 */
export async function addFreeScanJob(
    scanId: string,
    components: any[],
    options?: { priority?: number }
): Promise<string> {
    return addJob(QUEUE_FREE_SCAN, 'free-scan', {
        scanId,
        components
    }, options);
}

/**
 * Add an enterprise scan job
 */
export async function addEnterpriseScanJob(
    scanId: string,
    components: any[],
    options?: { priority?: number }
): Promise<string> {
    return addJob(QUEUE_ENTERPRISE_SCAN, 'enterprise-scan', {
        scanId,
        components
    }, options);
}

/**
 * Add a webhook delivery job
 */
export async function addWebhookDeliveryJob(
    deliveryId: string,
    scanId: string,
    payload: any,
    targetUrl: string,
    options?: { delay?: number }
): Promise<string> {
    return addJob(QUEUE_WEBHOOK_DELIVERY, 'webhook-delivery', {
        deliveryId,
        scanId,
        payload,
        targetUrl
    }, options);
}

/**
 * Add a report generation job
 */
export async function addReportGenerationJob(
    reportId: string,
    scanId: string,
    format: 'pdf' | 'json' | 'summary',
    options?: { priority?: number }
): Promise<string> {
    return addJob(QUEUE_REPORT_GENERATION, 'report-generation', {
        reportId,
        scanId,
        format
    }, options);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: string): Promise<{
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
}> {
    let queue: Queue;

    switch (queueName) {
        case QUEUE_FREE_SCAN:
            queue = await getFreeScanQueue();
            break;
        case QUEUE_ENTERPRISE_SCAN:
            queue = await getEnterpriseScanQueue();
            break;
        case QUEUE_WEBHOOK_DELIVERY:
            queue = await getWebhookDeliveryQueue();
            break;
        case QUEUE_REPORT_GENERATION:
            queue = await getReportGenerationQueue();
            break;
        default:
            throw new Error(`Unknown queue: ${queueName}`);
    }

    const stats = await queue.getJobCounts();
    return {
        active: stats.active,
        waiting: stats.waiting,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed
    };
}

/**
 * Close all queue connections
 */
export async function closeAllQueues(): Promise<void> {
    if (freeScanQueue) {
        await freeScanQueue.close();
        freeScanQueue = null;
    }
    if (enterpriseScanQueue) {
        await enterpriseScanQueue.close();
        enterpriseScanQueue = null;
    }
    if (webhookDeliveryQueue) {
        await webhookDeliveryQueue.close();
        webhookDeliveryQueue = null;
    }
    if (reportGenerationQueue) {
        await reportGenerationQueue.close();
        reportGenerationQueue = null;
    }
    if (freeScanQueueEvents) {
        await freeScanQueueEvents.close();
        freeScanQueueEvents = null;
    }
    if (enterpriseScanQueueEvents) {
        await enterpriseScanQueueEvents.close();
        enterpriseScanQueueEvents = null;
    }
    if (webhookDeliveryQueueEvents) {
        await webhookDeliveryQueueEvents.close();
        webhookDeliveryQueueEvents = null;
    }
    if (reportGenerationQueueEvents) {
        await reportGenerationQueueEvents.close();
        reportGenerationQueueEvents = null;
    }
}

export default {
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
};
