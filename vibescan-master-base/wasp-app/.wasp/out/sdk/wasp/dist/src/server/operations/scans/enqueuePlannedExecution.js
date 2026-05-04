import { enterpriseScanQueue, freeScanQueue } from '../../queues/config.js';
function getQueueForTarget(queueTarget) {
    return queueTarget === 'enterprise' ? enterpriseScanQueue : freeScanQueue;
}
function getPriorityForTarget(queueTarget) {
    return queueTarget === 'enterprise' ? 100 : 10;
}
function buildScanJob(input, execution) {
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
async function getQueuePosition(job) {
    return (await job.getState()) === 'waiting' ? 1 : 0;
}
export async function enqueuePlannedExecution(input, execution) {
    const queue = getQueueForTarget(execution.queueTarget);
    const job = await queue.add(`scan-${input.scanId}-${execution.provider}`, buildScanJob(input, execution), {
        priority: getPriorityForTarget(execution.queueTarget),
    });
    return {
        provider: execution.provider,
        queueTarget: execution.queueTarget,
        resultSource: execution.resultSource,
        jobId: job.id,
        queuePosition: await getQueuePosition(job),
    };
}
//# sourceMappingURL=enqueuePlannedExecution.js.map