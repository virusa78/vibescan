import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../config/runtime.js';
import { QUEUE_NAMES, type ZohoSyncJob } from './jobContract.js';

const redisConfig = getRedisConnectionConfig();

export const zohoSyncQueue = new Queue<ZohoSyncJob>(QUEUE_NAMES.ZOHO_SYNC, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2_000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const);
