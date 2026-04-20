import type { Scan } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { cancelScan as cancelScanJobs } from './orchestrator.js';
import { quotaService } from '../../services/quotaService.js';

const cancelScanInputSchema = z.object({
  scan_id: z.string().uuid(),
});

export type CancelScanInput = z.infer<typeof cancelScanInputSchema>;

export interface ActionResponse {
  success: boolean;
  message: string;
  quota_refunded?: number;
}

export async function cancelScan(rawArgs: any, context: any): Promise<ActionResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(cancelScanInputSchema, rawArgs);

  const scan = await context.entities.Scan.findFirst({
    where: {
      id: args.scan_id,
      userId: context.user.id,
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

  await quotaService.refundQuota(context.user.id, scan.id, 'manual_scan_cancelled');

  return {
    success: true,
    message: `Scan ${scan.id} cancelled successfully`,
    quota_refunded: 1,
  };
}
