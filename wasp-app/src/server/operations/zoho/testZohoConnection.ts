import { testZohoConnectionForWorkspace } from '../../services/zohoIntegrationService.js';
import { requireZohoWorkspaceAdmin } from './shared';

export async function testZohoConnection(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const { workspaceId, userId } = await requireZohoWorkspaceAdmin(context.user);
  return testZohoConnectionForWorkspace({
    workspaceId,
    userId,
  });
}
