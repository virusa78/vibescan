/**
 * Scan Orchestrator - Coordinates dual-scanner pipeline
 * Enqueues both free (Grype) and enterprise (Codescoring) scanners
 * Handles quota deduction and scan state management
 */

import { PrismaClient } from '@prisma/client';
import type { Job, JobState } from 'bullmq';
import { freeScanQueue, enterpriseScanQueue, initializeWorkers } from '../../queues/config';
import type { ScanJob } from '../../queues/jobContract';
import { shouldUseEmbeddedWorkers } from '../../config/runtime.js';
import { resolvePlannedScannerExecutions } from './executionPlan.js';
import { enqueuePlannedExecution } from './enqueuePlannedExecution.js';
import type {
  OrchestratorInput,
  OrchestratorResult,
  QueueScanStatus,
  ScanQueueJob,
  ScanQueueStatusResponse,
} from './orchestratorTypes.js';

const prisma = new PrismaClient();

/**
 * Orchestrate scan submission - enqueue both scanners
 * @param input Scan input parameters
 * @returns Orchestration result with job IDs and queue positions
 */
export async function orchestrateScan(input: OrchestratorInput): Promise<any> {
  const { scanId, planAtSubmission } = input;

  try {
    console.log(`[Orchestrator] Starting orchestration for scan ${scanId}`);
    if (shouldUseEmbeddedWorkers()) {
      await initializeWorkers();
    }

    const plannedExecutions =
      input.plannedExecutions ?? resolvePlannedScannerExecutions(planAtSubmission);
    const enqueuedExecutions: OrchestratorResult['enqueuedExecutions'] = [];
    let freeJobId: string | undefined;
    let enterpriseJobId: string | undefined;
    let freeQueuePosition: number | undefined;
    let enterpriseQueuePosition: number | undefined;

    for (const execution of plannedExecutions) {
      try {
        const enqueued = await enqueuePlannedExecution(input, execution);
        enqueuedExecutions.push(enqueued);

        if (enqueued.queueTarget === 'free') {
          freeJobId = enqueued.jobId;
          freeQueuePosition = enqueued.queuePosition;
          console.log(`[Orchestrator] Enqueued free scanner job: ${freeJobId}`);
        }

        if (enqueued.queueTarget === 'enterprise') {
          enterpriseJobId = enqueued.jobId;
          enterpriseQueuePosition = enqueued.queuePosition;
          console.log(`[Orchestrator] Enqueued enterprise scanner job: ${enterpriseJobId}`);
        }
      } catch (error) {
        if (execution.queueTarget === 'free') {
          console.error(`[Orchestrator] Failed to enqueue free scanner:`, error);
          throw new Error(`Failed to enqueue free scanner: ${error instanceof Error ? error.message : String(error)}`);
        }

        console.error(`[Orchestrator] Failed to enqueue enterprise scanner:`, error);
        console.log(`[Orchestrator] Continuing without enterprise scanner`);
      }
    }

    // Update scan status to "queued" (map to pending/scanning workflow)
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'scanning', // Use 'scanning' to indicate jobs are queued/processing
        updatedAt: new Date(),
      },
    });

    console.log(`[Orchestrator] Scan ${scanId} orchestrated successfully`);

    return {
      scanId,
      freeJobId,
      enterpriseJobId,
      freeQueuePosition,
      enterpriseQueuePosition,
      plannedExecutions,
      enqueuedExecutions,
      status: 'enqueued',
    };
  } catch (error) {
    console.error(`[Orchestrator] Error orchestrating scan ${scanId}:`, error);

    // Mark scan as error
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'error',
        errorMessage: `Orchestration failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
}

function matchesScanId(job: Job<ScanJob>, scanId: string): boolean {
  return job.data.scanId === scanId;
}

function toQueueScanStatus(job: ScanQueueJob, state: JobState): QueueScanStatus {
  return {
    jobId: job.id,
    state,
    progress: typeof job.progress === 'number' || typeof job.progress === 'object' ? job.progress : 0,
  };
}

async function findScanJobById(
  jobs: ScanQueueJob[],
  scanId: string,
): Promise<QueueScanStatus | null> {
  const matchedJob = jobs.find((job) => matchesScanId(job, scanId));
  if (!matchedJob) {
    return null;
  }

  const state = await matchedJob.getState();
  if (state === 'unknown') {
    return toQueueScanStatus(matchedJob, 'waiting');
  }
  return toQueueScanStatus(matchedJob, state);
}

/**
 * Get queue status and position for a scan
 */
export async function getScanQueueStatus(scanId: string): Promise<any> {
  try {
    // Find free job
    const freeJobs = await freeScanQueue.getJobs(['waiting', 'active', 'delayed']);

    // Find enterprise job
    const enterpriseJobs = await enterpriseScanQueue.getJobs(['waiting', 'active', 'delayed']);

    return {
      scanId,
      freeScanner: await findScanJobById(freeJobs, scanId),
      enterpriseScanner: await findScanJobById(enterpriseJobs, scanId),
    };
  } catch (error) {
    console.error(`[Orchestrator] Error getting queue status for scan ${scanId}:`, error);
    throw error;
  }
}

/**
 * Cancel a scan and remove it from queues if it is still pending or scanning.
 */
export async function cancelScan(scanId: string, errorMessage?: string) {
  try {
    console.log(`[Orchestrator] Cancelling scan ${scanId}`);

    const cancelledAt = new Date();

    const updatedScan = await prisma.scan.updateMany({
      where: {
        id: scanId,
        status: {
          in: ['pending', 'scanning'],
        },
      },
      data: {
        status: 'cancelled',
        completedAt: cancelledAt,
        errorMessage: errorMessage ?? null,
      },
    });

    if (updatedScan.count === 0) {
      console.log(`[Orchestrator] Scan ${scanId} was not cancellable`);
      return null;
    }

    try {
      // Remove from free queue
      const freeJobs = await freeScanQueue.getJobs(['waiting', 'delayed']);
      for (const job of freeJobs) {
        if (matchesScanId(job, scanId)) {
          await job.remove();
          console.log(`[Orchestrator] Removed free scanner job ${job.id}`);
        }
      }
    } catch (error) {
      console.error(`[Orchestrator] Failed to remove free queue jobs for ${scanId}:`, error);
    }

    try {
      // Remove from enterprise queue
      const enterpriseJobs = await enterpriseScanQueue.getJobs(['waiting', 'delayed']);
      for (const job of enterpriseJobs) {
        if (matchesScanId(job, scanId)) {
          await job.remove();
          console.log(`[Orchestrator] Removed enterprise scanner job ${job.id}`);
        }
      }
    } catch (error) {
      console.error(`[Orchestrator] Failed to remove enterprise queue jobs for ${scanId}:`, error);
    }

    console.log(`[Orchestrator] Scan ${scanId} cancelled successfully`);

    return { scanId, status: 'cancelled' };
  } catch (error) {
    console.error(`[Orchestrator] Error cancelling scan ${scanId}:`, error);
    throw error;
  }
}
