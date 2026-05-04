import { HttpError, prisma } from 'wasp/server';
import { decryptSecret } from '../../utils/secretEncryption.js';
import { getScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';
import { getSnykScannerReadiness } from '../../services/scannerReadinessService.js';
function buildSecretPreview(secret) {
    if (secret.length <= 8) {
        return secret;
    }
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
function getScannerAccessPreview(encryptedKey) {
    if (!encryptedKey) {
        return null;
    }
    try {
        return buildSecretPreview(decryptSecret(encryptedKey));
    }
    catch {
        return null;
    }
}
export async function getScannerAccessSettings(_args, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    const user = await prisma.user.findUnique({
        where: { id: context.user.id },
        select: {
            id: true,
            snykApiKeyEncrypted: true,
        },
    });
    if (!user) {
        throw new HttpError(404, 'User not found');
    }
    const snykReadiness = await getSnykScannerReadiness(prisma, context.user.id);
    return {
        snyk_api_key_attached: !!user.snykApiKeyEncrypted,
        snyk_api_key_preview: getScannerAccessPreview(user.snykApiKeyEncrypted),
        snyk_enabled: snykReadiness.enabled,
        snyk_ready: snykReadiness.ready,
        snyk_ready_reason: snykReadiness.reason,
        snyk_credential_source: snykReadiness.credentialSource?.mode ?? null,
        scanner_health: getScannerHealthSnapshot(),
    };
}
//# sourceMappingURL=getScannerAccessSettings.js.map