import type { ScanSource } from '@prisma/client';
import type { ScannerCredentialSource, ScannerProviderKind } from './providerTypes.js';
import type { SnykScannerReadiness } from '../../services/scannerReadinessService.js';
export type QueueScannerTarget = 'free' | 'enterprise';
export type PlannedScannerExecution = {
    provider: ScannerProviderKind;
    queueTarget: QueueScannerTarget;
    resultSource: ScanSource;
    credentialSource: ScannerCredentialSource;
};
export type ScannerPlanningContext = {
    userId?: string;
    snykReadiness?: SnykScannerReadiness | null;
};
export declare function resolvePlannedScannerExecutions(planAtSubmission: string, context?: ScannerPlanningContext): PlannedScannerExecution[];
export declare function resolveQueueScannerTargets(planAtSubmission: string, context?: ScannerPlanningContext): QueueScannerTarget[];
export declare function resolveExpectedScanSources(planAtSubmission: string, context?: ScannerPlanningContext): ScanSource[];
//# sourceMappingURL=providerSelection.d.ts.map