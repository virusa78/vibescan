import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';

const deleteWebhookInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
});

export type DeleteWebhookInput = z.infer<typeof deleteWebhookInputSchema>;

export interface ActionResponse {
  success: boolean;
  message: string;
}

/**
 * Delete a webhook and mark its deliveries as cancelled
 */
export async function deleteWebhook(
  rawArgs: any,
  context: any
): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(deleteWebhookInputSchema, rawArgs);

  try {
    // Verify ownership
    const webhook = await context.entities.Webhook.findUnique({
      where: { id: args.webhookId },
    });

    if (!webhook) {
      throw new HttpError(404, 'Webhook not found');
    }

    if (webhook.userId !== context.user.id) {
      throw new HttpError(404, 'Webhook not found');
    }

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
    } as any;
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    throw new HttpError(500, 'Failed to delete webhook');
  }
}
