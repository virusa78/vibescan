import type {
  ScannerCredentialSource,
  ScannerProviderKind,
} from './providerTypes.js';
import type { SnykScannerReadiness } from '../../services/scannerReadinessService.js';

export type QueueScannerTarget = 'free' | 'enterprise';
export type ScannerResultSource = 'grype' | 'trivy' | 'codescoring_johnny' | 'owasp' | 'snyk';

export type PlannedScannerExecution = {
  provider: ScannerProviderKind;
  queueTarget: QueueScannerTarget;
  resultSource: ScannerResultSource;
  credentialSource: ScannerCredentialSource;
};

const BASE_PLAN_EXECUTIONS: PlannedScannerExecution[] = [
  {
    provider: 'grype',
    queueTarget: 'free',
    resultSource: 'grype',
    credentialSource: { mode: 'environment' },
  },
  {
    provider: 'trivy',
    queueTarget: 'free',
    resultSource: 'trivy',
    credentialSource: { mode: 'environment' },
  },
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
  _planAtSubmission: string,
  context?: ScannerPlanningContext,
  selectedSources?: ScannerResultSource[],
): PlannedScannerExecution[] {
  const selectedSet = selectedSources === undefined ? null : new Set(selectedSources);
  const executions = BASE_PLAN_EXECUTIONS.filter((execution) => !selectedSet || selectedSet.has(execution.resultSource));

  if (context?.snykReadiness?.enabled && context.snykReadiness.ready && context.snykReadiness.credentialSource) {
    const snykExecution = buildSnykExecution(context.snykReadiness.credentialSource);
    if (!selectedSet || selectedSet.has(snykExecution.resultSource)) {
      executions.push(snykExecution);
    }
  }

  return executions;
}

export function resolveQueueScannerTargets(
  planAtSubmission: string,
  context?: ScannerPlanningContext,
  selectedSources?: ScannerResultSource[],
): QueueScannerTarget[] {
  return resolvePlannedScannerExecutions(planAtSubmission, context, selectedSources).map((execution) => execution.queueTarget);
}

export function resolveExpectedScanSources(
  planAtSubmission: string,
  context?: ScannerPlanningContext,
  selectedSources?: ScannerResultSource[],
): ScannerResultSource[] {
  return resolvePlannedScannerExecutions(planAtSubmission, context, selectedSources).map((execution) => execution.resultSource);
}
