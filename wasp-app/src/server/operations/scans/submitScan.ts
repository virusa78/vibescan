import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { submitScanSubmission } from '../../services/scanSubmissionService.js';

const submitScanInputSchema = z.object({
  inputRef: z.string(),
  inputType: z.enum(['github', 'sbom', 'source_zip']),
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
  const result = await submitScanSubmission({
    userId: user.id,
    inputType: args.inputType,
    inputRef: args.inputRef,
  });

  return {
    id: result.scan.id,
    status: result.scan.status,
    created_at: result.scan.createdAt,
    quota_remaining: result.quotaRemaining,
  };
}
