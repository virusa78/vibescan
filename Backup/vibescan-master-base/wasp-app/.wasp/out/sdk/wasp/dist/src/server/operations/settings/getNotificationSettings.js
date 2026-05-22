import { HttpError, prisma } from 'wasp/server';
export async function getNotificationSettings(_args, context) {
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
    };
}
//# sourceMappingURL=getNotificationSettings.js.map