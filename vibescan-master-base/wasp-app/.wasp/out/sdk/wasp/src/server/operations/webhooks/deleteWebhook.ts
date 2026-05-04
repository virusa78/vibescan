import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import type { ActionResponse, AuthenticatedUser, WebhookOwnershipRecord } from './types.js';
import {
  assertWorkspaceOrLegacyOwnership,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const deleteWebhookInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
});

export type DeleteWebhookInput = z.infer<typeof deleteWebhookInputSchema>;


/**
 * Delete a webhook and mark its deliveries as cancelled
 */
export async function deleteWebhook(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(deleteWebhookInputSchema, rawArgs);

  try {
    // Verify ownership
    const webhook = await context.entities.Webhook.findUnique({
      where: { id: args.webhookId },
    });

    if (!webhook) {
      throw new HttpError(404, 'Webhook not found');
    }

    assertWorkspaceOrLegacyOwnership(webhook, user, 'Webhook not found');

    // Mark pending deliveries as exhausted
    await context.entities.WebhookDelivery.updateMany({
      where: {
        webhookId: args.webhookId,
        status: 'pending',
      },
      data: {
        status: 'exhausted',
      },
    });

    // Delete the webhook
    await context.entities.Webhook.delete({
      where: { id: args.webhookId },
    });

    return {
      success: true,
      message: 'Webhook deleted successfully',
    };
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    throw new HttpError(500, 'Failed to delete webhook');
  }
}
