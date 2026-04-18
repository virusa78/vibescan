/**
 * BullMQ Queue Configuration
 * Defines free and enterprise scan queues with priority levels
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { freeScannerWorker } from '../workers/freeScannerWorker';
import { enterpriseScannerWorker } from '../workers/enterpriseScannerWorker';

// Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Queue names
export const QUEUE_NAMES = {
  FREE_SCAN: 'free_scan_queue',
  ENTERPRISE_SCAN: 'enterprise_scan_queue',
};

// Create queue instances
export const freeScanQueue = new Queue(QUEUE_NAMES.FREE_SCAN, {
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
});

export const enterpriseScanQueue = new Queue(QUEUE_NAMES.ENTERPRISE_SCAN, {
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
});

// Worker registration with concurrency limits
let freeWorker: Worker | null = null;
let enterpriseWorker: Worker | null = null;

export async function initializeWorkers() {
  try {
    // Free scanner worker: 20 concurrent jobs (lower priority)
    freeWorker = new Worker(QUEUE_NAMES.FREE_SCAN, freeScannerWorker, {
      connection: redisConfig,
      concurrency: 20,
    });

    freeWorker.on('completed', (job: any) => {
      console.log(`[Free Scanner] Job ${job.id} completed`);
    });

    freeWorker.on('failed', (job: any, err: any) => {
      console.error(`[Free Scanner] Job ${job?.id} failed:`, err.message);
    });

    // Enterprise scanner worker: 3 concurrent jobs (higher priority)
    enterpriseWorker = new Worker(QUEUE_NAMES.ENTERPRISE_SCAN, enterpriseScannerWorker, {
      connection: redisConfig,
      concurrency: 3,
    });

    enterpriseWorker.on('completed', (job: any) => {
      console.log(`[Enterprise Scanner] Job ${job.id} completed`);
    });

    enterpriseWorker.on('failed', (job: any, err: any) => {
      console.error(`[Enterprise Scanner] Job ${job?.id} failed:`, err.message);
    });

    console.log('✅ Workers initialized: free_scan (20 concurrent), enterprise_scan (3 concurrent)');
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
}

export function getWorkerStatus() {
  return {
    free: {
      isRunning: freeWorker?.isRunning() || false,
      isPaused: freeWorker?.isPaused() || false,
    },
    enterprise: {
      isRunning: enterpriseWorker?.isRunning() || false,
      isPaused: enterpriseWorker?.isPaused() || false,
    },
  };
}
