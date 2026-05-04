import { HttpError } from 'wasp/server';
import * as z from 'zod';
import * as crypto from 'crypto';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { encryptWebhookSecret } from '../../utils/webhookEncryption.js';
import { validateWebhookTargetUrl } from '../../../shared/webhookTarget';
import { isProductionEnvironment } from '../../config/env.js';
import { assertWorkspaceOrLegacyOwnership, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
const updateWebhookInputSchema = z.object({
    webhookId: z.string().uuid('Invalid webhook ID'),
    url: z.string().url('Invalid webhook URL').optional(),
    events: z.array(z.enum(['scan_complete', 'report_ready', 'scan_failed'])).optional(),
    enabled: z.boolean().optional(),
    rotateSecret: z.boolean().optional().default(false),
});
/**
 * Update an existing webhook configuration
 * Enforces strict ownership boundary and consistent data model
 */
export async function updateWebhook(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(updateWebhookInputSchema, rawArgs);
    try {
        // Verify ownership - read webhook directly
        const webhook = await context.entities.Webhook.findUnique({
            where: { id: args.webhookId },
        });
        if (!webhook) {
            throw new HttpError(404, 'Webhook not found');
        }
        // Strict ownership boundary: user can only update their own webhooks
        assertWorkspaceOrLegacyOwnership(webhook, user, 'Webhook not found');
        // Validate new URL if provided
        let validatedUrl = null;
        if (args.url) {
            try {
                validatedUrl = await validateWebhookTargetUrl(args.url, {
                    allowLocalHttp: !isProductionEnvironment(),
                });
            }
            catch (err) {
                throw new HttpError(400, err instanceof Error ? err.message : 'Invalid webhook URL');
            }
        }
        const updateData = {};
        if (validatedUrl)
            updateData.url = validatedUrl.toString();
        if (args.events)
            updateData.events = args.events;
        if (args.enabled !== undefined)
            updateData.enabled = args.enabled;
        // Secret rotation: optional when URL changes or explicitly requested
        if (args.rotateSecret && (args.url || args.rotateSecret)) {
            const newSecret = crypto.randomBytes(32).toString('hex');
            const newSecretEncrypted = encryptWebhookSecret(newSecret);
            updateData.signingSecretEncrypted = newSecretEncrypted;
        }
        const updatedWebhook = await context.entities.Webhook.update({
            where: { id: args.webhookId },
            data: updateData,
        });
        return {
            id: updatedWebhook.id,
            url: updatedWebhook.url,
            events: updatedWebhook.events,
            enabled: updatedWebhook.enabled,
            updated_at: updatedWebhook.updatedAt || new Date(),
        };
    }
    catch (_err) {
        if (_err instanceof HttpError) {
            throw _err;
        }
        throw new HttpError(500, 'Failed to update webhook');
    }
}
//# sourceMappingURL=updateWebhook.js.map