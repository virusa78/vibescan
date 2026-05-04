import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { encryptSecret, decryptSecret } from '../../utils/secretEncryption.js';
import { getScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';
import { getSnykScannerReadiness } from '../../services/scannerReadinessService.js';
const updateScannerAccessSettingsSchema = z.object({
    snyk_api_key: z.string().min(1).max(1024).optional().nullable(),
});
function buildSecretPreview(secret) {
    if (secret.length <= 8) {
        return secret;
    }
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
function previewEncryptedSecret(encryptedKey) {
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
export async function updateScannerAccessSettings(rawArgs, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    const args = ensureArgsSchemaOrThrowHttpError(updateScannerAccessSettingsSchema, rawArgs);
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
    let snykApiKeyEncrypted;
    if (args.snyk_api_key !== undefined) {
        const normalized = (args.snyk_api_key ?? '').trim();
        snykApiKeyEncrypted = normalized.length > 0 ? encryptSecret(normalized) : null;
    }
    if (snykApiKeyEncrypted !== undefined) {
        await prisma.user.update({
            where: { id: context.user.id },
            data: {
                snykApiKeyEncrypted,
            },
        });
    }
    const updatedEncryptedKey = snykApiKeyEncrypted !== undefined ? snykApiKeyEncrypted : user.snykApiKeyEncrypted;
    const snykReadiness = await getSnykScannerReadiness(prisma, context.user.id);
    return {
        snyk_api_key_attached: !!updatedEncryptedKey,
        snyk_api_key_preview: previewEncryptedSecret(updatedEncryptedKey),
        snyk_enabled: snykReadiness.enabled,
        snyk_ready: snykReadiness.ready,
        snyk_ready_reason: snykReadiness.reason,
        snyk_credential_source: snykReadiness.credentialSource?.mode ?? null,
        scanner_health: getScannerHealthSnapshot(),
    };
}
//# sourceMappingURL=updateScannerAccessSettings.js.map