import { HttpError } from 'wasp/server';
import * as crypto from 'crypto';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { encryptWebhookSecret } from '../../utils/webhookEncryption.js';
import { validateWebhookTargetUrl } from '../../../shared/webhookTarget';
import { isProductionEnvironment } from '../../config/env.js';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';

const createWebhookInputSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.enum(['scan_complete', 'report_ready', 'scan_failed'])).min(1),
});

export type CreateWebhookInput = z.infer<typeof createWebhookInputSchema>;

export interface WebhookResponse {
  id: string;
  url: string;
  created_at: Date;
  events: string[];
  secret_preview: string;
}

type CreatedWebhookRecord = {
  id: string;
  url: string;
  createdAt: Date;
  events: string[];
};


function isPrismaUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Create a new webhook for the authenticated user
 * Generates HMAC-SHA256 signing secret for webhook verification
 * Encrypts the secret using AES-256-GCM before storing in database
 */
export async function createWebhook(
  rawArgs: unknown,
  context: any
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(createWebhookInputSchema, rawArgs);

  let url: URL;
  try {
    url = await validateWebhookTargetUrl(args.url, {
      allowLocalHttp: !isProductionEnvironment(),
    });
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid webhook URL');
  }

  // Generate signing secret (32 bytes = 256 bits for SHA256)
  const signingSecret = crypto.randomBytes(32).toString('hex');

  // Encrypt the signing secret using AES-256-GCM
  let signingSecretEncrypted: Buffer;
  try {
    signingSecretEncrypted = encryptWebhookSecret(signingSecret);
  } catch {
    throw new HttpError(500, 'Failed to encrypt webhook secret');
  }

  try {
    const webhook = await context.entities.Webhook.create({
      data: {
        userId: user.id,
        workspaceId: user.workspaceId,
        url: url.toString(),
        events: args.events,
        signingSecretEncrypted,
        enabled: true,
      },
    });

    // Return secret preview (first 8 chars + last 8 chars for display)
    const secretPreview = `${signingSecret.substring(0, 8)}...${signingSecret.substring(
      signingSecret.length - 8
    )}`;

    return {
      id: webhook.id,
      url: webhook.url,
      created_at: webhook.createdAt,
      events: webhook.events,
      secret_preview: secretPreview,
    };
  } catch (_err) {
    if (isPrismaUniqueConstraintError(_err)) {
      throw new HttpError(409, 'Webhook already exists for this URL');
    }
    throw new HttpError(500, 'Failed to create webhook');
  }
}
