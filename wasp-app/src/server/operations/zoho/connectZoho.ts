import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { connectZohoIntegrationForWorkspace } from '../../services/zohoIntegrationService.js';
import { requireZohoWorkspaceAdmin } from './shared';

const connectZohoInputSchema = z.object({
  authorization_code: z.string().trim().min(1).optional(),
  refresh_token: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.authorization_code || value.refresh_token), {
  message: 'An authorization code or refresh token is required',
  path: ['authorization_code'],
});

export type ConnectZohoInput = z.infer<typeof connectZohoInputSchema>;

export async function connectZoho(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const { workspaceId, userId } = await requireZohoWorkspaceAdmin(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(connectZohoInputSchema, rawArgs ?? {});

  return connectZohoIntegrationForWorkspace({
    workspaceId,
    userId,
    authorizationCode: args.authorization_code ?? null,
    refreshToken: args.refresh_token ?? null,
  });
}
