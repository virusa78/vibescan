import type { PrismaClient } from '@prisma/client';
import type { ScannerCredentialSource, ScannerProviderKind, ScannerResolvedCredentials } from '../lib/scanners/providerTypes.js';
type CredentialResolverPrismaClient = Pick<PrismaClient, 'user'>;
export declare function resolveCredentialsForProvider(prisma: CredentialResolverPrismaClient, providerKind: ScannerProviderKind, credentialSource: ScannerCredentialSource | undefined): Promise<ScannerResolvedCredentials>;
export {};
//# sourceMappingURL=scannerCredentialResolver.d.ts.map