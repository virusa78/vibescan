import type { Job } from 'bullmq';
import { enterpriseScanQueue, freeScanQueue } from '../../queues/config.js';
import type { ScanJob, ScanJobInputType } from '../../queues/jobContract.js';
import type { PlannedScannerExecution, QueueScannerTarget } from './executionPlan.js';

type EnqueueExecutionJob = Job<ScanJob>;
type EnqueuePlannedExecutionInput = {
  scanId: string;
  userId: string;
  inputType: ScanJobInputType;
  inputRef: string;
};

export type EnqueuedPlannedExecution = {
  provider: PlannedScannerExecution['provider'];
  queueTarget: QueueScannerTarget;
  resultSource: PlannedScannerExecution['resultSource'];
  jobId: string;
  queuePosition: number;
};

function getQueueForTarget(queueTarget: QueueScannerTarget) {
  return queueTarget === 'enterprise' ? enterpriseScanQueue : freeScanQueue;
}

function getPriorityForTarget(queueTarget: QueueScannerTarget): number {
  return queueTarget === 'enterprise' ? 100 : 10;
}

function buildScanJob(
  input: EnqueuePlannedExecutionInput,
  execution: PlannedScannerExecution,
): ScanJob {
  return {
    scanId: input.scanId,
    userId: input.userId,
    inputType: input.inputType,
    inputRef: input.inputRef,
    s3Bucket: `scans/${input.scanId}`,
    provider: execution.provider,
    queueTarget: execution.queueTarget,
    resultSource: execution.resultSource,
    credentialSource: execution.credentialSource,
  };
}

async function getQueuePosition(job: EnqueueExecutionJob): Promise<any> {
  return (await job.getState()) === 'waiting' ? 1 : 0;
}

export async function enqueuePlannedExecution(
  input: EnqueuePlannedExecutionInput,
  execution: PlannedScannerExecution,
): Promise<any> {
  const queue = getQueueForTarget(execution.queueTarget);
  const job = await queue.add(`scan-${input.scanId}-${execution.provider}`, buildScanJob(input, execution), {
    priority: getPriorityForTarget(execution.queueTarget),
  });

  return {
    provider: execution.provider,
    queueTarget: execution.queueTarget,
    resultSource: execution.resultSource,
    jobId: job.id!,
    queuePosition: await getQueuePosition(job),
  };
}
