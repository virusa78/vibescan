import { getZohoIntegrationStatusForWorkspace } from '../../services/zohoIntegrationService.js';
import { requireZohoWorkspaceAdmin } from './shared';

export async function getZohoIntegrationStatus(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const { workspaceId } = await requireZohoWorkspaceAdmin(context.user);
  return getZohoIntegrationStatusForWorkspace(workspaceId);
}
