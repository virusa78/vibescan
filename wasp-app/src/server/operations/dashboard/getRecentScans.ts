import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { mapRecentScans } from './recentScanMapper';

const getRecentScansInputSchema = z.object({
  limit: z.number().min(1).max(20).default(10),
});

export type GetRecentScansInput = z.infer<typeof getRecentScansInputSchema>;

export interface RecentScan {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  created_at: Date;
  completed_at: Date | null;
  vulnerability_count: number;
}

export interface RecentScansResponse {
  scans: RecentScan[];
}

export async function getRecentScans(rawArgs: any, context: any): Promise<RecentScansResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(getRecentScansInputSchema, rawArgs);

  // Get recent scans for user, ordered by most recent
  const scans = await context.entities.Scan.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: { createdAt: 'desc' },
    take: args.limit,
    select: {
      id: true,
      status: true,
      inputType: true,
      inputRef: true,
      planAtSubmission: true,
      createdAt: true,
      completedAt: true,
      _count: {
        select: {
          findings: true,
        },
      },
    },
  });

  const recentScans = mapRecentScans(scans);

  return {
    scans: recentScans,
  };
}
