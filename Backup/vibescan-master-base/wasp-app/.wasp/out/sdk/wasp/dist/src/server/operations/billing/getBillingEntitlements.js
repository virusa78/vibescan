import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getUserEntitlements } from '../../services/entitlementService';
export async function getBillingEntitlements(_args, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const snapshot = await getUserEntitlements(user.id);
    return {
        features: snapshot.features,
        limits: snapshot.limits,
    };
}
//# sourceMappingURL=getBillingEntitlements.js.map