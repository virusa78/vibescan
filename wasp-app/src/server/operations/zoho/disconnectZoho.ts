import { disconnectZohoIntegrationForWorkspace } from '../../services/zohoIntegrationService.js';
import { requireZohoWorkspaceAdmin } from './shared';

export async function disconnectZoho(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const { workspaceId, userId } = await requireZohoWorkspaceAdmin(context.user);
  return disconnectZohoIntegrationForWorkspace({
    workspaceId,
    userId,
  });
}
