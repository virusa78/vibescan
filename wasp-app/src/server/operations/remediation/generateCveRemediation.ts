import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { generateCveRemediation as generateCveRemediationService } from '../../services/remediationService.js';

const generateCveRemediationInputSchema = z.object({
  scanId: z.string().min(1),
  findingId: z.string().min(1),
  requestKey: z.string().min(8),
  promptType: z.string().optional(),
});

export type GenerateCveRemediationInput = z.infer<typeof generateCveRemediationInputSchema>;

export async function generateCveRemediation(rawArgs: any, context: any) {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(generateCveRemediationInputSchema, rawArgs);
  return generateCveRemediationService({
    userId: context.user.id,
    scanId: args.scanId,
    findingId: args.findingId,
    requestKey: args.requestKey,
    promptType: args.promptType,
  });
}
