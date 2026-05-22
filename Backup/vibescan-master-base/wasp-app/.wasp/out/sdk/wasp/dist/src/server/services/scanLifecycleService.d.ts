import { type PrismaClient, type ScanSource } from '@prisma/client';
type ScanPrismaClient = Pick<PrismaClient, 'scan' | 'githubInstallation' | 'scanResult' | 'scanDelta'>;
type FinalizeScanInput = {
    prisma: ScanPrismaClient;
    scanId: string;
    userId: string;
    findingsCount: number;
    loggerLabel: string;
};
type HandleScannerFailureInput = {
    prisma: ScanPrismaClient;
    scanId: string;
    userId: string;
    scannerId: ScanSource;
    errorMessage: string;
    loggerLabel: string;
};
export declare function finalizeScanIfReady({ prisma, scanId, userId, findingsCount, loggerLabel, }: FinalizeScanInput): Promise<void>;
export declare function handleScannerFailure({ prisma, scanId, userId, scannerId, errorMessage, loggerLabel, }: HandleScannerFailureInput): Promise<void>;
export {};
//# sourceMappingURL=scanLifecycleService.d.ts.map