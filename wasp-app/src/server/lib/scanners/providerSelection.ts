import type { ScanSource } from '@prisma/client';
import type {
  ScannerCredentialSource,
  ScannerProviderKind,
} from './providerTypes.js';
import type { SnykScannerReadiness } from '../../services/scannerReadinessService.js';

export type QueueScannerTarget = 'free' | 'enterprise';

export type PlannedScannerExecution = {
  provider: ScannerProviderKind;
  queueTarget: QueueScannerTarget;
  resultSource: ScanSource;
  credentialSource: ScannerCredentialSource;
};

const FREE_PLAN_EXECUTIONS: PlannedScannerExecution[] = [
  {
    provider: 'grype',
    queueTarget: 'free',
    resultSource: 'grype',
    credentialSource: { mode: 'environment' },
  },
  {
    provider: 'syft',
    queueTarget: 'free',
    resultSource: 'syft',
    credentialSource: { mode: 'environment' },
  },
];

const ENTERPRISE_PLAN_EXECUTIONS: PlannedScannerExecution[] = [
  ...FREE_PLAN_EXECUTIONS,
  {
    provider: 'codescoring-johnny',
    queueTarget: 'enterprise',
    resultSource: 'codescoring_johnny',
    credentialSource: { mode: 'environment' },
  },
  {
    provider: 'owasp',
    queueTarget: 'enterprise',
    resultSource: 'owasp',
    credentialSource: { mode: 'environment' },
  },
];

export type ScannerPlanningContext = {
  userId?: string;
  snykReadiness?: SnykScannerReadiness | null;
};

function buildSnykExecution(credentialSource: ScannerCredentialSource): PlannedScannerExecution {
  return {
    provider: 'snyk',
    queueTarget: 'enterprise',
    resultSource: 'snyk',
    credentialSource,
  };
}

export function resolvePlannedScannerExecutions(
  planAtSubmission: string,
  context?: ScannerPlanningContext,
): PlannedScannerExecution[] {
  if (planAtSubmission === 'enterprise') {
    if (!context?.snykReadiness?.enabled) {
      return ENTERPRISE_PLAN_EXECUTIONS;
    }

    if (!context.snykReadiness.ready || !context.snykReadiness.credentialSource) {
      return FREE_PLAN_EXECUTIONS;
    }

    return [
      ...FREE_PLAN_EXECUTIONS,
      buildSnykExecution(context.snykReadiness.credentialSource),
    ];
  }

  return FREE_PLAN_EXECUTIONS;
}

export function resolveQueueScannerTargets(
  planAtSubmission: string,
  context?: ScannerPlanningContext,
): QueueScannerTarget[] {
  return resolvePlannedScannerExecutions(planAtSubmission, context).map((execution) => execution.queueTarget);
}

export function resolveExpectedScanSources(
  planAtSubmission: string,
  context?: ScannerPlanningContext,
): ScanSource[] {
  return resolvePlannedScannerExecutions(planAtSubmission, context).map((execution) => execution.resultSource);
}
