import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

const submitScanInputSchema = z.object({
  source_type: z.string(),
  source_input: z.unknown(),
  plan_tier: z.string(),
});

export type SubmitScanInput = z.infer<typeof submitScanInputSchema>;

export interface ScanResponse {
  id: string;
  status: string;
  created_at: Date;
  quota_remaining: number;
}

export async function submitScan(rawArgs: any, context: any): Promise<ScanResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);

  // Wrap entire quota check, scan creation, and quota increment in a transaction
  // to prevent race conditions where concurrent requests bypass quota limits
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: context.user.id },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    // Check if quota reset is needed
    const now = new Date();
    let currentUser = user;
    if (user.quotaResetDate && user.quotaResetDate <= now) {
      // Reset monthly quota if reset date has passed
      const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      currentUser = await tx.user.update({
        where: { id: context.user.id },
        data: {
          monthlyQuotaUsed: 0,
          quotaResetDate: nextResetDate,
        },
      });
    }

    const quotaAvailable = currentUser.monthlyQuotaLimit - currentUser.monthlyQuotaUsed;
    if (quotaAvailable <= 0) {
      throw new HttpError(429, 'Monthly scan quota exceeded', {
        error: 'quota_exceeded',
        quota_limit: currentUser.monthlyQuotaLimit,
        quota_used: currentUser.monthlyQuotaUsed,
      });
    }

    let inputRef = '';
    let inputType = '';

    if (args.source_type === 'github') {
      inputRef = ((args.source_input as any)?.repo as string) || 'unknown';
      inputType = 'github_app';
    } else if (args.source_type === 'source_zip') {
      inputRef = ((args.source_input as any)?.filename as string) || 'upload.zip';
      inputType = 'source_zip';
    } else if (args.source_type === 'sbom') {
      inputRef = ((args.source_input as any)?.sbom_url as string) || 'sbom_upload';
      inputType = 'sbom_upload';
    }

    const scan = await tx.scan.create({
      data: {
        userId: context.user.id,
        inputType,
        inputRef,
        status: 'pending',
        planAtSubmission: args.plan_tier,
        components: [],
      },
    });

    await tx.scanDelta.create({
      data: {
        scanId: scan.id,
        totalFreeCount: 0,
        totalEnterpriseCount: 0,
        deltaCount: 0,
        deltaBySeverity: {},
        isLocked: args.plan_tier === 'free_trial' || args.plan_tier === 'starter',
      },
    });

    // Increment quota within transaction
    await tx.user.update({
      where: { id: context.user.id },
      data: {
        monthlyQuotaUsed: currentUser.monthlyQuotaUsed + 1,
      },
    });

    return {
      id: scan.id,
      status: scan.status,
      created_at: scan.createdAt,
      quota_remaining: quotaAvailable - 1,
    };
  });

  return result;
}
