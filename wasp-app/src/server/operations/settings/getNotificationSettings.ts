import { HttpError, prisma } from 'wasp/server';

export type NotificationSettingsResponse = {
  email_on_scan_complete: boolean;
  email_on_vulnerability: boolean;
  weekly_digest: boolean;
  sms_enabled: boolean;
};

export async function getNotificationSettings(
  _args: any,
  context: any
): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return {
    email_on_scan_complete: true,
    email_on_vulnerability: true,
    weekly_digest: false,
    sms_enabled: false,
  } as any;
}
