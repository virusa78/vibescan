import { QUEUE_NAMES } from '../queues/jobContract.js';
import { scannerExecutionWorker } from './scannerExecutionWorker.js';
function createScannerLaneProcessor(queueTarget) {
    return (job) => scannerExecutionWorker(job, queueTarget);
}
export const scannerWorkerDefinitions = {
    free: {
        queueName: QUEUE_NAMES.FREE_SCAN,
        concurrency: 20,
        label: 'Free Scanner',
        processor: createScannerLaneProcessor('free'),
    },
    enterprise: {
        queueName: QUEUE_NAMES.ENTERPRISE_SCAN,
        concurrency: 3,
        label: 'Enterprise Scanner',
        processor: createScannerLaneProcessor('enterprise'),
    },
};
//# sourceMappingURL=scannerWorkerRouting.js.map