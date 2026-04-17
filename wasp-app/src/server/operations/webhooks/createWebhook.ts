import { HttpError } from 'wasp/server';
import * as crypto from 'crypto';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '@src/server/validation';
import { encryptWebhookSecret } from '@src/server/utils/webhookEncryption';

/**
 * Check if a hostname is a private IP address or reserved endpoint
 */
function isPrivateIP(hostname: string): boolean {
  const privatePatterns = [
    /^localhost$/i,
    /^127\./, // 127.0.0.0/8
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // 169.254.0.0/16 (link-local)
    /^169\.254\.169\.254/, // AWS metadata
  ];
  return privatePatterns.some(pattern => pattern.test(hostname));
}

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

/**
 * Create a new webhook for the authenticated user
 * Generates HMAC-SHA256 signing secret for webhook verification
 * Encrypts the secret using AES-256-GCM before storing in database
 */
export async function createWebhook(
  rawArgs: any,
  context: any
): Promise<WebhookResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(createWebhookInputSchema, rawArgs);

  // Validate URL is accessible (basic check)
  let url: URL;
  try {
    url = new URL(args.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new HttpError(400, 'Invalid webhook URL: must be a valid HTTP(S) URL');
  }

  // Reject private IP addresses and internal networks
  if (isPrivateIP(url.hostname)) {
    throw new HttpError(400, 'Webhook URLs must not point to private networks');
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
        userId: context.user.id,
        url: args.url,
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
    if ((_err as any).code === 'P2002') {
      throw new HttpError(409, 'Webhook already exists for this URL');
    }
    throw new HttpError(500, 'Failed to create webhook');
  }
}
