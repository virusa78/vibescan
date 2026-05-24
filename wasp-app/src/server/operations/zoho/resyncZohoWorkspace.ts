import { resyncZohoWorkspace as requestZohoResync } from '../../services/zohoIntegrationService.js';
import { requireZohoWorkspaceAdmin } from './shared';

export async function resyncZohoWorkspace(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const { workspaceId, userId } = await requireZohoWorkspaceAdmin(context.user);
  return requestZohoResync({
    workspaceId,
    userId,
  });
}
