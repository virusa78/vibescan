import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { quotaService } from '../../services/quotaService.js';
import { orchestrateScan } from './orchestrator.js';
import { emitWebhookEvent, buildWebhookPayload } from '../../services/webhookEventEmitter.js';
import {
  validateAndExtractSBOM,
  validateGitHubUrl,
  normalizeComponents,
} from '../../services/inputAdapterService.js';

const submitScanInputSchema = z.object({
  inputRef: z.string(),
  inputType: z.enum(['github', 'sbom', 'source_zip']),
  sbomContent: z.string().optional(), // For SBOM upload, pass raw JSON content
});

export type SubmitScanInput = z.infer<typeof submitScanInputSchema>;

export interface ScanResponse {
  id: string;
  status: string;
  created_at: Date;
  quota_remaining: number;
}

export async function submitScan(rawArgs: any, context: any): Promise<ScanResponse> {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);

  // Process input and extract components based on input type
  let components: any[] = [];
  let sbomRaw: any = null;

  if (args.inputType === 'sbom' && args.sbomContent) {
    // Validate and extract SBOM
    const sbomResult = validateAndExtractSBOM(args.sbomContent);
    components = sbomResult.components;
    sbomRaw = JSON.parse(args.sbomContent);
  } else if (args.inputType === 'github') {
    // Validate GitHub URL format (actual scanning happens in worker)
    validateGitHubUrl(args.inputRef);
  } else if (args.inputType === 'source_zip') {
    // ZIP extraction and scanning happens in worker
    // For now, we just validate that inputRef is provided
    if (!args.inputRef) {
      throw new HttpError(422, 'Invalid source_zip', { detail: 'File reference required' });
    }
  }

  // Normalize components
  if (components.length > 0) {
    components = await normalizeComponents(components);
  }

  // Wrap entire quota check, scan creation, and quota consumption in a transaction
  // to prevent race conditions where concurrent requests bypass quota limits
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: context.user.id },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    // Map UI input type to internal scan type
    let internalInputType = '';
    if (args.inputType === 'github') {
      internalInputType = 'github_app';
    } else if (args.inputType === 'source_zip') {
      internalInputType = 'source_zip';
    } else if (args.inputType === 'sbom') {
      internalInputType = 'sbom_upload';
    }

    // Create scan first (before consuming quota)
    const scan = await tx.scan.create({
      data: {
        userId: context.user.id,
        inputType: internalInputType,
        inputRef: args.inputRef,
        status: 'pending',
        planAtSubmission: user.plan,
        components: components,
        sbomRaw: sbomRaw,
      },
    });

    await tx.scanDelta.create({
      data: {
        scanId: scan.id,
        totalFreeCount: 0,
        totalEnterpriseCount: 0,
        deltaCount: 0,
        deltaBySeverity: {},
        isLocked: user.plan === 'free_trial' || user.plan === 'starter',
      },
    });

    // Consume quota within transaction using the service
    // This will throw HttpError(429) if quota exceeded
    const quotaInfo = await quotaService.consumeQuota(context.user.id, scan.id, tx);

    return {
      id: scan.id,
      status: scan.status,
      created_at: scan.createdAt,
      quota_remaining: quotaInfo.remaining,
    };
  });

  // After transaction completes, orchestrate the scan (enqueue workers)
  // Do this outside the transaction to avoid holding transaction lock
  try {
    await orchestrateScan({
      scanId: result.id,
      userId: user.id,
      inputType: args.inputType,
      inputRef: args.inputRef,
      planAtSubmission: user.plan,
    });
  } catch (error) {
    console.error(`[submitScan] Post-orchestration failed for scan ${result.id}:`, error);
    // Don't fail the entire request - quota was already consumed
    // Scan will remain in pending state for retry
  }

  return result;
}
