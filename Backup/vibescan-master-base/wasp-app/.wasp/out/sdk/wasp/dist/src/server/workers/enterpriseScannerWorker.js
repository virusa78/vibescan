/**
 * Enterprise Scanner Worker - Calls Codescoring/BlackDuck API
 * Handles premium vulnerability scanning for enterprise plans
 */
import { PrismaClient } from '@prisma/client';
import { executeScannerForScan } from '../services/scannerExecutionService.js';
const prisma = new PrismaClient();
export async function enterpriseScannerWorker(job) {
    const { scanId, userId } = job.data;
    return executeScannerForScan({
        prisma,
        scanId,
        userId,
        source: 'codescoring_johnny',
        providerKind: 'codescoring-johnny',
        loggerLabel: 'Enterprise Scanner',
    });
}
//# sourceMappingURL=enterpriseScannerWorker.js.map