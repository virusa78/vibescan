import { decryptSecret } from '../utils/secretEncryption.js';
import { getSnykOrgId } from '../config/runtime.js';
export async function resolveCredentialsForProvider(prisma, providerKind, credentialSource) {
    if (providerKind !== 'snyk') {
        return {
            source: 'none',
            values: {},
        };
    }
    const orgId = getSnykOrgId();
    if (!credentialSource || credentialSource.mode === 'environment') {
        return {
            source: 'environment',
            values: {
                token: process.env.SNYK_TOKEN?.trim() || undefined,
                orgId,
            },
        };
    }
    const user = await prisma.user.findUnique({
        where: { id: credentialSource.userId },
        select: { snykApiKeyEncrypted: true },
    });
    if (!user) {
        throw new Error(`Unable to resolve Snyk credentials: user ${credentialSource.userId} not found`);
    }
    const token = user.snykApiKeyEncrypted
        ? decryptSecret(user.snykApiKeyEncrypted)
        : undefined;
    return {
        source: 'user-secret',
        values: {
            token,
            orgId,
        },
        userId: credentialSource.userId,
    };
}
//# sourceMappingURL=scannerCredentialResolver.js.map