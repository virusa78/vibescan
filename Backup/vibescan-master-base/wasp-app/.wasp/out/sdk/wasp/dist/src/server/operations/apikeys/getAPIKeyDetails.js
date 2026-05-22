import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { assertWorkspaceOrLegacyOwnership, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
const getAPIKeyDetailsSchema = z.object({
    keyId: z.string().uuid(),
});
export async function getAPIKeyDetails(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(getAPIKeyDetailsSchema, rawArgs);
    const apiKey = await prisma.apiKey.findUnique({
        where: { id: args.keyId },
    });
    if (!apiKey) {
        throw new HttpError(404, 'API key not found');
    }
    // Verify ownership
    assertWorkspaceOrLegacyOwnership(apiKey, user, 'API key not found');
    const usageEventModel = prisma;
    const [usageCount, usageEvents] = await Promise.all([
        usageEventModel.apiKeyUsageEvent.count({
            where: { apiKeyId: apiKey.id },
        }),
        usageEventModel.apiKeyUsageEvent.findMany({
            where: { apiKeyId: apiKey.id },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 90,
        }),
    ]);
    const usageByDay = new Map();
    for (const event of usageEvents) {
        const date = event.createdAt.toISOString().slice(0, 10);
        usageByDay.set(date, (usageByDay.get(date) ?? 0) + 1);
    }
    // Determine status
    let status = 'active';
    if (!apiKey.enabled) {
        status = 'revoked';
    }
    else if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        status = 'expired';
    }
    return {
        id: apiKey.id,
        name: apiKey.name,
        created_at: apiKey.createdAt.toISOString(),
        expires_at: apiKey.expiresAt?.toISOString() || null,
        last_used_at: apiKey.lastUsedAt?.toISOString() || null,
        request_count: usageCount,
        usage_by_day: Array.from(usageByDay.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count })),
        status: status,
    };
}
//# sourceMappingURL=getAPIKeyDetails.js.map