import type { PrismaClient } from '@prisma/client';
import type { ScannerCredentialSource } from '../lib/scanners/providerTypes.js';
type ScannerReadinessPrismaClient = Pick<PrismaClient, 'user'>;
export type SnykScannerReadiness = {
    enabled: boolean;
    ready: boolean;
    credentialMode: 'auto' | 'environment' | 'user-secret';
    credentialSource: ScannerCredentialSource | null;
    reason: string | null;
    hasEnvironmentToken: boolean;
    hasUserSecret: boolean;
};
export declare function getSnykScannerReadiness(prisma: ScannerReadinessPrismaClient, userId?: string): Promise<SnykScannerReadiness>;
export {};
//# sourceMappingURL=scannerReadinessService.d.ts.map