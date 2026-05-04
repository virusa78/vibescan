import type { Job, JobState } from 'bullmq';
import type { ScanJob, ScanJobInputType } from '../../queues/jobContract.js';
import type { PlannedScannerExecution, QueueScannerTarget } from './executionPlan.js';
import type { EnqueuedPlannedExecution } from './enqueuePlannedExecution.js';

export type ScanQueueJob = Job<ScanJob>;

export type QueueScanStatus = {
  jobId: string | undefined;
  state: JobState;
  progress: number | object;
};

export type ScanQueueStatusResponse = {
  scanId: string;
  freeScanner: QueueScanStatus | null;
  enterpriseScanner: QueueScanStatus | null;
};

export type OrchestratorInput = {
  scanId: string;
  userId: string;
  inputType: ScanJobInputType;
  inputRef: string;
  planAtSubmission: string;
  plannedExecutions?: PlannedScannerExecution[];
};

export type OrchestratorResult = {
  scanId: string;
  freeJobId?: string;
  enterpriseJobId?: string;
  freeQueuePosition?: number;
  enterpriseQueuePosition?: number;
  plannedExecutions: PlannedScannerExecution[];
  enqueuedExecutions: EnqueuedPlannedExecution[];
  status: 'enqueued';
};

export type QueueTargetStatusMap = Record<QueueScannerTarget, QueueScanStatus | null>;
