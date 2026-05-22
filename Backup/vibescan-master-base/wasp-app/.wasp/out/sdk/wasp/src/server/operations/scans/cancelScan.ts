import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { cancelScan as cancelScanJobs } from './orchestrator.js';
import { quotaService } from '../../services/quotaService.js';
import {
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const cancelScanInputSchema = z.object({
  scan_id: z.string().uuid(),
});

export type CancelScanInput = z.infer<typeof cancelScanInputSchema>;

export interface ActionResponse {
  success: boolean;
  message: string;
  quota_refunded?: number;
}


export async function cancelScan(rawArgs: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(cancelScanInputSchema, rawArgs);

  const scan = await prisma.scan.findFirst({
    where: {
      id: args.scan_id,
      ...buildWorkspaceOrLegacyOwnerWhere(user),
    },
  });

  if (!scan) {
    throw new HttpError(404, 'Scan not found or unauthorized');
  }

  const cancellableStates = ['pending', 'scanning'];
  if (!cancellableStates.includes(scan.status)) {
    throw new HttpError(400, `Cannot cancel scan in '${scan.status}' state`, {
      error: 'invalid_scan_state',
      current_state: scan.status,
      allowed_states: cancellableStates,
    });
  }

  const cancelled = await cancelScanJobs(scan.id);
  if (!cancelled) {
    throw new HttpError(400, `Cannot cancel scan in '${scan.status}' state`, {
      error: 'invalid_scan_state',
      current_state: scan.status,
      allowed_states: cancellableStates,
    });
  }

  await quotaService.refundQuota(user.id, scan.id, 'manual_scan_cancelled');

  return {
    success: true,
    message: `Scan ${scan.id} cancelled successfully`,
    quota_refunded: 1,
  };
}
