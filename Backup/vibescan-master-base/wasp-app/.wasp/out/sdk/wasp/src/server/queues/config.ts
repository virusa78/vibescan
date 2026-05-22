/**
 * BullMQ Queue Configuration
 * Defines free and enterprise scan queues with priority levels
 */

import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnectionConfig } from '../config/runtime.js';
import { eventDeliveryWorker } from '../workers/eventDeliveryWorker.js';
import { webhookDeliveryWorker } from '../workers/webhookDeliveryWorker.js';
import { scannerWorkerDefinitions } from '../workers/scannerWorkerRouting.js';
import {
  QUEUE_NAMES,
  type EventDeliveryJob,
  type QueueWorkerStatus,
  type ScanJob,
  type WebhookDeliveryJob,
} from './jobContract.js';

const redisConfig = getRedisConnectionConfig();

// Create queue instances
export const freeScanQueue = new Queue<ScanJob>(QUEUE_NAMES.FREE_SCAN, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const);

export const enterpriseScanQueue = new Queue<ScanJob>(QUEUE_NAMES.ENTERPRISE_SCAN, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const);

export const webhookDeliveryQueue = new Queue<WebhookDeliveryJob>(QUEUE_NAMES.WEBHOOK_DELIVERY, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const);

export const eventDeliveryQueue = new Queue<EventDeliveryJob>(QUEUE_NAMES.EVENT_DELIVERY, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const);

// Worker registration with concurrency limits
let freeWorker: Worker<ScanJob> | null = null;
let enterpriseWorker: Worker<ScanJob> | null = null;
let webhookWorker: Worker<WebhookDeliveryJob> | null = null;
let eventWorker: Worker<EventDeliveryJob> | null = null;
let workersInitialized = false;

function logCompletedJob(label: string, job: Job | undefined): void {
  console.log(`[${label}] Job ${job?.id ?? 'unknown'} completed`);
}

function logFailedJob(label: string, job: Job | undefined, error: Error): void {
  console.error(`[${label}] Job ${job?.id ?? 'unknown'} failed:`, error.message);
}

export async function initializeWorkers() {
  if (workersInitialized) {
    return;
  }

  try {
    // Free scanner worker: 20 concurrent jobs (lower priority)
    freeWorker = new Worker(
      scannerWorkerDefinitions.free.queueName,
      scannerWorkerDefinitions.free.processor,
      {
      connection: redisConfig,
      concurrency: scannerWorkerDefinitions.free.concurrency,
      },
    );

    freeWorker.on('completed', (job) => {
      logCompletedJob(scannerWorkerDefinitions.free.label, job);
    });

    freeWorker.on('failed', (job, error) => {
      logFailedJob(scannerWorkerDefinitions.free.label, job, error);
    });

    // Enterprise scanner worker: 3 concurrent jobs (higher priority)
    enterpriseWorker = new Worker(
      scannerWorkerDefinitions.enterprise.queueName,
      scannerWorkerDefinitions.enterprise.processor,
      {
      connection: redisConfig,
      concurrency: scannerWorkerDefinitions.enterprise.concurrency,
      },
    );

    enterpriseWorker.on('completed', (job) => {
      logCompletedJob(scannerWorkerDefinitions.enterprise.label, job);
    });

    enterpriseWorker.on('failed', (job, error) => {
      logFailedJob(scannerWorkerDefinitions.enterprise.label, job, error);
    });

    // Webhook delivery worker: 10 concurrent jobs
    webhookWorker = new Worker(QUEUE_NAMES.WEBHOOK_DELIVERY, webhookDeliveryWorker, {
      connection: redisConfig,
      concurrency: 10,
    });

    webhookWorker.on('completed', (job) => {
      logCompletedJob('Webhook Delivery', job);
    });

    webhookWorker.on('failed', (job, error) => {
      logFailedJob('Webhook Delivery', job, error);
    });

    eventWorker = new Worker(QUEUE_NAMES.EVENT_DELIVERY, eventDeliveryWorker, {
      connection: redisConfig,
      concurrency: 10,
    });

    eventWorker.on('completed', (job) => {
      logCompletedJob('Event Delivery', job);
    });

    eventWorker.on('failed', (job, error) => {
      logFailedJob('Event Delivery', job, error);
    });

    console.log('✅ Workers initialized: free_scan (20 concurrent), enterprise_scan (3 concurrent), webhook_delivery (10 concurrent), event_delivery (10 concurrent)');
    workersInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize workers:', error);
    throw error;
  }
}

export async function closeWorkers() {
  if (freeWorker) {
    await freeWorker.close();
  }
  if (enterpriseWorker) {
    await enterpriseWorker.close();
  }
  if (webhookWorker) {
    await webhookWorker.close();
  }
  if (eventWorker) {
    await eventWorker.close();
  }

  workersInitialized = false;
}

export function getWorkerStatus(): QueueWorkerStatus {
  return {
    free: {
      isRunning: freeWorker?.isRunning() || false,
      isPaused: freeWorker?.isPaused() || false,
    },
    enterprise: {
      isRunning: enterpriseWorker?.isRunning() || false,
      isPaused: enterpriseWorker?.isPaused() || false,
    },
    webhook: {
      isRunning: webhookWorker?.isRunning() || false,
      isPaused: webhookWorker?.isPaused() || false,
    },
    event: {
      isRunning: eventWorker?.isRunning() || false,
      isPaused: eventWorker?.isPaused() || false,
    },
  };
}
