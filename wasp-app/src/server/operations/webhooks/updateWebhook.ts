import type { Webhook } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '@src/server/validation';

const updateWebhookInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
  url: z.string().url('Invalid webhook URL').optional(),
  events: z.array(z.enum(['scan_complete', 'report_ready', 'scan_failed'])).optional(),
  active: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookInputSchema>;

export interface WebhookResponse {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  updated_at: Date;
}

/**
 * Update an existing webhook configuration
 */
export async function updateWebhook(
  rawArgs: any,
  context: any
): Promise<WebhookResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(updateWebhookInputSchema, rawArgs);

  try {
    // Verify ownership
    const webhook = await context.entities.Webhook.findUnique({
      where: { id: args.webhookId },
    });

    if (!webhook) {
      throw new HttpError(404, 'Webhook not found');
    }

    if (webhook.userId !== context.user.id) {
      throw new HttpError(403, 'You do not have permission to update this webhook');
    }

    // Validate new URL if provided
    if (args.url) {
      try {
        const url = new URL(args.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch (err) {
        throw new HttpError(400, 'Invalid webhook URL: must be a valid HTTP(S) URL');
      }
    }

    const updateData: any = {};
    if (args.url) updateData.url = args.url;
    if (args.events) updateData.events = args.events;
    if (args.active !== undefined) updateData.enabled = args.active;

    const updatedWebhook = await context.entities.Webhook.update({
      where: { id: args.webhookId },
      data: updateData,
    });

    return {
      id: updatedWebhook.id,
      url: updatedWebhook.url,
      events: updatedWebhook.events,
      active: updatedWebhook.enabled,
      updated_at: updatedWebhook.updatedAt || new Date(),
    };
  } catch (_err) {
    if (_err instanceof HttpError) {
      throw _err;
    }
    throw new HttpError(500, 'Failed to update webhook');
  }
}
