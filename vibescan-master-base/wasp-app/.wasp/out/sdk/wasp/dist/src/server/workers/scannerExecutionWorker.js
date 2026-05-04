import { PrismaClient } from '@prisma/client';
import { getScannerProvider } from '../lib/scanners/scannerProviderRegistry.js';
import { executeScannerForScan } from '../services/scannerExecutionService.js';
const prisma = new PrismaClient();
function getLaneLabel(queueTarget) {
    return queueTarget === 'enterprise' ? 'Enterprise Scanner' : 'Free Scanner';
}
export async function scannerExecutionWorker(job, expectedQueueTarget) {
    const { scanId, userId, provider, resultSource, queueTarget, credentialSource } = job.data;
    if (expectedQueueTarget && queueTarget !== expectedQueueTarget) {
        throw new Error(`Scanner job lane mismatch for scan ${scanId}: expected ${expectedQueueTarget}, got ${queueTarget}`);
    }
    const providerDefinition = getScannerProvider(provider);
    const loggerLabel = `${getLaneLabel(queueTarget)} / ${providerDefinition.displayName}`;
    return executeScannerForScan({
        prisma: prisma,
        scanId,
        userId,
        source: resultSource,
        providerKind: provider,
        credentialSource,
        loggerLabel,
    });
}
//# sourceMappingURL=scannerExecutionWorker.js.map