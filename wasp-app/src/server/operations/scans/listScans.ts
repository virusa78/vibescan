import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { mapScanSummary, type AuthenticatedScanUser, type ScanSummaryRecord } from './shared.js';
import {
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const listScansInputSchema = z.object({
  limit: z.number().min(1).max(100).default(25),
  offset: z.number().min(0).default(0),
  status: z.string().optional(),
  created_from: z.string().datetime().optional(),
  created_to: z.string().datetime().optional(),
});

export type ListScansInput = z.infer<typeof listScansInputSchema>;

export interface ScanListResponse {
  scans: ReturnType<typeof mapScanSummary>[];
  total: number;
  has_more: boolean;
}


export async function listScans(rawArgs: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(listScansInputSchema, rawArgs);

  const where: Record<string, unknown> = {
    ...buildWorkspaceOrLegacyOwnerWhere(user),
  };

  if (args.status) {
    where.status = args.status;
  }

  if (args.created_from || args.created_to) {
    const createdAtFilter: {
      gte?: Date;
      lte?: Date;
    } = {};
    if (args.created_from) {
      const fromDate = new Date(args.created_from);
      if (isNaN(fromDate.getTime())) {
        throw new HttpError(400, 'Invalid date format for created_from');
      }
      createdAtFilter.gte = fromDate;
    }
    if (args.created_to) {
      const toDate = new Date(args.created_to);
      if (isNaN(toDate.getTime())) {
        throw new HttpError(400, 'Invalid date format for created_to');
      }
      createdAtFilter.lte = toDate;
    }
    where.createdAt = createdAtFilter;
  }

  const total = await prisma.scan.count({ where });

  const scans = await prisma.scan.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: args.offset,
    take: args.limit,
    select: {
      id: true,
      status: true,
      inputType: true,
      inputRef: true,
      planAtSubmission: true,
      createdAt: true,
      completedAt: true,
    },
  }) as ScanSummaryRecord[];

  return {
    scans: scans.map(mapScanSummary),
    total,
    has_more: args.offset + args.limit < total,
  };
}
