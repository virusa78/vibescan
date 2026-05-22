import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
const annotationStateSchema = z.enum(['accepted', 'snoozed', 'rejected']);
const upsertAnnotationInputSchema = z.object({
    scanId: z.string().uuid(),
    findingId: z.string().uuid(),
    state: annotationStateSchema,
    reason: z.string().trim().max(500).optional(),
    expiresAt: z.string().datetime().optional(),
});
const listAnnotationsInputSchema = z.object({
    scanId: z.string().uuid(),
    state: z.enum(['accepted', 'snoozed', 'rejected', 'expired']).optional(),
});
async function assertOwnedScan(scanId, user) {
    const scan = await prisma.scan.findUnique({
        where: { id: scanId },
        select: { id: true, userId: true, workspaceId: true },
    });
    if (!scan || !(scan.workspaceId === user.workspaceId || (!scan.workspaceId && scan.userId === user.id))) {
        throw new HttpError(404, 'Scan not found');
    }
}
export function mapAcceptanceToAnnotationState(input) {
    const now = input.now ?? new Date();
    if (input.status === 'revoked') {
        return 'rejected';
    }
    if (input.expiresAt) {
        return input.expiresAt.getTime() <= now.getTime() ? 'expired' : 'snoozed';
    }
    return 'accepted';
}
export async function upsertFindingAnnotation(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(upsertAnnotationInputSchema, rawArgs);
    await assertOwnedScan(args.scanId, user);
    const finding = await prisma.finding.findFirst({
        where: {
            id: args.findingId,
            scanId: args.scanId,
        },
        select: { id: true },
    });
    if (!finding) {
        throw new HttpError(404, 'Finding not found');
    }
    let status = 'accepted';
    let expiresAt = null;
    if (args.state === 'rejected') {
        status = 'revoked';
    }
    else if (args.state === 'snoozed') {
        if (!args.expiresAt) {
            throw new HttpError(422, 'expiresAt is required for snoozed state', {
                error: 'validation_error',
                validation_errors: [{ field: 'expiresAt', message: 'required_for_snoozed' }],
            });
        }
        const parsedExpiresAt = new Date(args.expiresAt);
        if (parsedExpiresAt.getTime() <= Date.now()) {
            throw new HttpError(422, 'expiresAt must be in the future', {
                error: 'validation_error',
                validation_errors: [{ field: 'expiresAt', message: 'must_be_in_future' }],
            });
        }
        expiresAt = parsedExpiresAt;
    }
    const acceptance = await prisma.vulnAcceptance.upsert({
        where: {
            scanId_userId_vulnerabilityId: {
                scanId: args.scanId,
                userId: user.id,
                vulnerabilityId: args.findingId,
            },
        },
        create: {
            scanId: args.scanId,
            userId: user.id,
            vulnerabilityId: args.findingId,
            reason: args.reason ?? null,
            status,
            expiresAt,
        },
        update: {
            reason: args.reason ?? null,
            status,
            expiresAt,
        },
    });
    return {
        annotation: {
            finding_id: args.findingId,
            state: mapAcceptanceToAnnotationState({ status: acceptance.status, expiresAt: acceptance.expiresAt }),
            reason: acceptance.reason,
            expires_at: acceptance.expiresAt ? acceptance.expiresAt.toISOString() : null,
        },
    };
}
export async function listFindingAnnotations(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(listAnnotationsInputSchema, rawArgs);
    await assertOwnedScan(args.scanId, user);
    const acceptances = await prisma.vulnAcceptance.findMany({
        where: {
            scanId: args.scanId,
            userId: user.id,
        },
        orderBy: { updatedAt: 'desc' },
    });
    const mapped = acceptances.map((acceptance) => ({
        finding_id: acceptance.vulnerabilityId,
        state: mapAcceptanceToAnnotationState({ status: acceptance.status, expiresAt: acceptance.expiresAt }),
        reason: acceptance.reason,
        expires_at: acceptance.expiresAt ? acceptance.expiresAt.toISOString() : null,
    }));
    return {
        annotations: args.state ? mapped.filter((item) => item.state === args.state) : mapped,
    };
}
//# sourceMappingURL=annotations.js.map