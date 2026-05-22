import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { generateCveRemediation as generateCveRemediationService } from '../../services/remediationService.js';
import { createCanonicalEventInput } from '../../services/eventPublisher.js';
import { publishAndRouteCanonicalEventSafely } from '../../services/eventPublicationSafety.js';
const generateCveRemediationInputSchema = z.object({
    scanId: z.string().min(1),
    findingId: z.string().min(1),
    requestKey: z.string().min(8),
    promptType: z.string().optional(),
});
export async function generateCveRemediation(rawArgs, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    const args = ensureArgsSchemaOrThrowHttpError(generateCveRemediationInputSchema, rawArgs);
    const baseEventExtras = {
        userId: context.user.id,
        entityType: 'remediation_request',
        entityId: args.requestKey,
        correlationId: args.requestKey,
    };
    await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('remediation.requested', 'remediation.operation', {
        scanId: args.scanId,
        findingId: args.findingId,
        requestKey: args.requestKey,
        promptType: args.promptType ?? null,
    }, baseEventExtras), 'remediation.requested');
    try {
        const result = await generateCveRemediationService({
            userId: context.user.id,
            scanId: args.scanId,
            findingId: args.findingId,
            requestKey: args.requestKey,
            promptType: args.promptType,
        });
        await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('remediation.generated', 'remediation.operation', {
            scanId: args.scanId,
            findingId: args.findingId,
            requestKey: args.requestKey,
            promptType: args.promptType ?? null,
            provider: result.provider ?? null,
            modelName: result.modelName ?? null,
            aiFixPromptId: result.aiFixPromptId ?? null,
            usageId: result.usageId ?? null,
        }, baseEventExtras), 'remediation.generated');
        return result;
    }
    catch (error) {
        if (error instanceof HttpError &&
            error?.data?.error === 'quota_exceeded') {
            await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('remediation.quota_exceeded', 'remediation.operation', {
                scanId: args.scanId,
                findingId: args.findingId,
                requestKey: args.requestKey,
                promptType: args.promptType ?? null,
            }, baseEventExtras), 'remediation.quota_exceeded');
        }
        else {
            await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('remediation.failed', 'remediation.operation', {
                scanId: args.scanId,
                findingId: args.findingId,
                requestKey: args.requestKey,
                promptType: args.promptType ?? null,
                error: error instanceof Error ? error.message : String(error),
            }, baseEventExtras), 'remediation.failed');
        }
        throw error;
    }
}
//# sourceMappingURL=generateCveRemediation.js.map