import type { Job } from 'bullmq';
import type { ZohoSyncJob } from '../queues/jobContract.js';
import { processZohoWorkspaceSyncJob } from '../services/zohoIntegrationService.js';

export async function zohoIntegrationWorker(job: Job<ZohoSyncJob>): Promise<void> {
  await processZohoWorkspaceSyncJob(job.data, {
    jobId: job.id ? String(job.id) : undefined,
    attemptsMade: job.attemptsMade,
  });
}
