/**
 * Scan Orchestrator - Coordinates dual-scanner pipeline
 * Enqueues both free (Grype) and enterprise (Codescoring) scanners
 * Handles quota deduction and scan state management
 */

import { PrismaClient } from '@prisma/client';
import { freeScanQueue, enterpriseScanQueue } from '../../queues/config';
import type { ScanJob } from '../../queues/jobContract';

const prisma = new PrismaClient();

export interface OrchestratorInput {
  scanId: string;
  userId: string;
  inputType: string; // 'source_zip', 'sbom_upload', 'github_app'
  inputRef: string;
  planAtSubmission: string;
}

export interface OrchestratorResult {
  scanId: string;
  freeJobId?: string;
  enterpriseJobId?: string;
  freeQueuePosition?: number;
  enterpriseQueuePosition?: number;
  status: string;
}

/**
 * Orchestrate scan submission - enqueue both scanners
 * @param input Scan input parameters
 * @returns Orchestration result with job IDs and queue positions
 */
export async function orchestrateScan(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { scanId, userId, inputType, inputRef, planAtSubmission } = input;

  try {
    console.log(`[Orchestrator] Starting orchestration for scan ${scanId}`);

    // Prepare job data
    const jobData: ScanJob = {
      scanId,
      userId,
      inputType,
      inputRef,
      s3Bucket: `scans/${scanId}`,
    };

    // Determine if user is enterprise
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const isEnterprise = planAtSubmission === 'enterprise' || user.plan === 'enterprise';
    let freeJobId: string | undefined;
    let enterpriseJobId: string | undefined;
    let freeQueuePosition: number | undefined;
    let enterpriseQueuePosition: number | undefined;

    // Always enqueue free scanner (Grype) for all plans
    try {
      const freeJob = await freeScanQueue.add(`scan-${scanId}`, jobData, {
        priority: 10, // Low priority queue
      });
      freeJobId = freeJob.id;
      freeQueuePosition = (await freeJob.getState()) === 'waiting' ? 1 : 0;
      console.log(`[Orchestrator] Enqueued free scanner job: ${freeJobId}`);
    } catch (error) {
      console.error(`[Orchestrator] Failed to enqueue free scanner:`, error);
      throw new Error(`Failed to enqueue free scanner: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Enqueue enterprise scanner only for enterprise plans
    if (isEnterprise) {
      try {
        const enterpriseJob = await enterpriseScanQueue.add(`scan-${scanId}`, jobData, {
          priority: 100, // High priority queue
        });
        enterpriseJobId = enterpriseJob.id;
        enterpriseQueuePosition = (await enterpriseJob.getState()) === 'waiting' ? 1 : 0;
        console.log(`[Orchestrator] Enqueued enterprise scanner job: ${enterpriseJobId}`);
      } catch (error) {
        console.error(`[Orchestrator] Failed to enqueue enterprise scanner:`, error);
        // Don't fail entirely - free scanner should still run
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

/**
 * Get queue status and position for a scan
 */
export async function getScanQueueStatus(scanId: string) {
  try {
    // Find free job
    const freeJobs = await freeScanQueue.getJobs(['waiting', 'active', 'delayed']);
    const freeJob = freeJobs.find((job: any) => job.data.scanId === scanId);

    // Find enterprise job
    const enterpriseJobs = await enterpriseScanQueue.getJobs(['waiting', 'active', 'delayed']);
    const enterpriseJob = enterpriseJobs.find((job: any) => job.data.scanId === scanId);

     return {
      scanId,
      freeScanner: freeJob
        ? {
            jobId: freeJob.id,
            state: await freeJob.getState(),
            progress: freeJob.progress,
          }
        : null,
      enterpriseScanner: enterpriseJob
        ? {
            jobId: enterpriseJob.id,
            state: await enterpriseJob.getState(),
            progress: enterpriseJob.progress,
          }
        : null,
    };
  } catch (error) {
    console.error(`[Orchestrator] Error getting queue status for scan ${scanId}:`, error);
    throw error;
  }
}

/**
 * Cancel a scan and remove from queues
 */
export async function cancelScan(scanId: string) {
  try {
    console.log(`[Orchestrator] Cancelling scan ${scanId}`);

    // Remove from free queue
    const freeJobs = await freeScanQueue.getJobs(['waiting', 'delayed']);
    for (const job of freeJobs) {
      if (job.data.scanId === scanId) {
        await job.remove();
        console.log(`[Orchestrator] Removed free scanner job ${job.id}`);
      }
    }

    // Remove from enterprise queue
    const enterpriseJobs = await enterpriseScanQueue.getJobs(['waiting', 'delayed']);
    for (const job of enterpriseJobs) {
      if (job.data.scanId === scanId) {
        await job.remove();
        console.log(`[Orchestrator] Removed enterprise scanner job ${job.id}`);
      }
    }

    // Update scan status
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    console.log(`[Orchestrator] Scan ${scanId} cancelled successfully`);

    return { scanId, status: 'cancelled' };
  } catch (error) {
    console.error(`[Orchestrator] Error cancelling scan ${scanId}:`, error);
    throw error;
  }
}
