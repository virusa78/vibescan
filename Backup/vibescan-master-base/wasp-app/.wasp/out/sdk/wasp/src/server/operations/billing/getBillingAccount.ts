import { HttpError } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';

export async function getBillingAccount(_args: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

  const currentUser = await context.entities.User.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      activeWorkspaceId: true,
    },
  });

  if (!currentUser) {
    throw new HttpError(404, 'User not found');
  }

  return {
    user_id: currentUser.id,
    email: currentUser.email,
    workspace_id: currentUser.activeWorkspaceId ?? user.workspaceId,
    plan: currentUser.plan,
    stripe_customer_id: currentUser.stripeCustomerId,
    stripe_subscription_id: currentUser.stripeSubscriptionId,
    subscription_status: currentUser.subscriptionStatus,
  };
}
