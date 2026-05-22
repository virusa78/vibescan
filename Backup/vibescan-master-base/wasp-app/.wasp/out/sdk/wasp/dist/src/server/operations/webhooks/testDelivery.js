import { HttpError, prisma } from 'wasp/server';
import * as crypto from 'crypto';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { webhookDeliveryQueue } from '../../queues/config.js';
import { assertWorkspaceOrLegacyOwnership, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
const testDeliveryInputSchema = z.object({
    webhookId: z.string().uuid('Invalid webhook ID'),
});
async function getOrCreateSyntheticScanId(user) {
    const latestScan = await prisma.scan.findFirst({
        where: {
            OR: [
                { workspaceId: user.workspaceId },
                { workspaceId: null, userId: user.id },
            ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
    });
    if (latestScan) {
        return latestScan.id;
    }
    const syntheticScan = await prisma.scan.create({
        data: {
            userId: user.id,
            workspaceId: user.workspaceId,
            inputType: 'github_app',
            inputRef: 'webhook:test',
            status: 'done',
            planAtSubmission: 'free_trial',
        },
        select: { id: true },
    });
    await prisma.scanDelta.create({
        data: {
            scanId: syntheticScan.id,
            totalFreeCount: 0,
            totalEnterpriseCount: 0,
            deltaCount: 0,
            deltaBySeverity: {},
            isLocked: false,
        },
    });
    return syntheticScan.id;
}
export async function testWebhookDelivery(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(testDeliveryInputSchema, rawArgs);
    const webhook = await prisma.webhook.findUnique({ where: { id: args.webhookId } });
    if (!webhook) {
        throw new HttpError(404, 'Webhook not found');
    }
    assertWorkspaceOrLegacyOwnership(webhook, user, 'Webhook not found');
    const scanId = await getOrCreateSyntheticScanId(user);
    const payloadBody = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
            scanId,
            userId: user.id,
            message: 'Manual test delivery from VibeScan',
        },
    };
    const payload = JSON.stringify(payloadBody);
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
    const delivery = await prisma.webhookDelivery.create({
        data: {
            webhookId: webhook.id,
            scanId,
            eventType: 'webhook.test',
            payload: payloadBody,
            targetUrl: webhook.url,
            payloadHash,
            attemptNumber: 1,
            status: 'pending',
        },
    });
    await webhookDeliveryQueue.add(`delivery-${delivery.id}`, {
        deliveryId: delivery.id,
        webhookId: webhook.id,
        scanId,
        eventType: 'webhook.test',
        payload,
        payloadHash,
        targetUrl: webhook.url,
        signingSecretEncrypted: webhook.signingSecretEncrypted,
        attemptNumber: 1,
    }, {
        priority: 5,
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    });
    return {
        queued: true,
        delivery_id: delivery.id,
    };
}
//# sourceMappingURL=testDelivery.js.map