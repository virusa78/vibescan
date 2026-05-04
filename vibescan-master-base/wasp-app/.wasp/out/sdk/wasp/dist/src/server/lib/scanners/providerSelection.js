const FREE_PLAN_EXECUTIONS = [
    {
        provider: 'grype',
        queueTarget: 'free',
        resultSource: 'grype',
        credentialSource: { mode: 'environment' },
    },
];
const ENTERPRISE_PLAN_EXECUTIONS = [
    ...FREE_PLAN_EXECUTIONS,
    {
        provider: 'codescoring-johnny',
        queueTarget: 'enterprise',
        resultSource: 'codescoring_johnny',
        credentialSource: { mode: 'environment' },
    },
];
function buildSnykExecution(credentialSource) {
    return {
        provider: 'snyk',
        queueTarget: 'enterprise',
        resultSource: 'snyk',
        credentialSource,
    };
}
export function resolvePlannedScannerExecutions(planAtSubmission, context) {
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
export function resolveQueueScannerTargets(planAtSubmission, context) {
    return resolvePlannedScannerExecutions(planAtSubmission, context).map((execution) => execution.queueTarget);
}
export function resolveExpectedScanSources(planAtSubmission, context) {
    return resolvePlannedScannerExecutions(planAtSubmission, context).map((execution) => execution.resultSource);
}
//# sourceMappingURL=providerSelection.js.map