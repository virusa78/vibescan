import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import type { NotificationSettingsResponse } from './getNotificationSettings';

const updateNotificationSettingsSchema = z.object({
  email_on_scan_complete: z.boolean().optional(),
  email_on_vulnerability: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
});

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;


export async function updateNotificationSettings(
  rawArgs: unknown,
  context: any
): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    updateNotificationSettingsSchema,
    rawArgs
  );

  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return {
    email_on_scan_complete: args.email_on_scan_complete ?? true,
    email_on_vulnerability: args.email_on_vulnerability ?? true,
    weekly_digest: args.weekly_digest ?? false,
    sms_enabled: false,
  };
}
