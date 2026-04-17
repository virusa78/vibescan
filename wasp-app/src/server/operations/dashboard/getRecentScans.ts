import type { Scan, ScanResult } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

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
    include: {
      scanResults: {
        select: {
          vulnerabilities: true,
        },
      },
    },
  });

  // Map scans and count vulnerabilities
  const recentScans: RecentScan[] = scans.map((scan: any) => {
    let vulnerabilityCount = 0;
    
    // Count vulnerabilities from all scan results
    for (const result of scan.scanResults) {
      if (Array.isArray(result.vulnerabilities)) {
        vulnerabilityCount += result.vulnerabilities.length;
      }
    }

    return {
      id: scan.id,
      status: scan.status,
      inputType: scan.inputType,
      inputRef: scan.inputRef,
      planAtSubmission: scan.planAtSubmission,
      created_at: scan.createdAt,
      completed_at: scan.completedAt,
      vulnerability_count: vulnerabilityCount,
    };
  });

  return {
    scans: recentScans,
  };
}
