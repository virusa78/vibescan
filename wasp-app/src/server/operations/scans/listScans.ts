import type { Scan } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

const listScansInputSchema = z.object({
  limit: z.number().min(1).max(100).default(25),
  offset: z.number().min(0).default(0),
  status: z.string().optional(),
  created_from: z.string().datetime().optional(),
  created_to: z.string().datetime().optional(),
});

export type ListScansInput = z.infer<typeof listScansInputSchema>;

export interface ScanListResponse {
  scans: Array<{
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    planAtSubmission: string;
    created_at: Date;
    completed_at: Date | null;
  }>;
  total: number;
  has_more: boolean;
}

export async function listScans(rawArgs: any, context: any): Promise<ScanListResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(listScansInputSchema, rawArgs);

  const where: any = {
    userId: context.user.id,
  };

  if (args.status) {
    where.status = args.status;
  }

  if (args.created_from || args.created_to) {
    where.createdAt = {};
    if (args.created_from) {
      const fromDate = new Date(args.created_from);
      if (isNaN(fromDate.getTime())) {
        throw new HttpError(400, 'Invalid date format for created_from');
      }
      where.createdAt.gte = fromDate;
    }
    if (args.created_to) {
      const toDate = new Date(args.created_to);
      if (isNaN(toDate.getTime())) {
        throw new HttpError(400, 'Invalid date format for created_to');
      }
      where.createdAt.lte = toDate;
    }
  }

  const total = await context.entities.Scan.count({ where });

  const scans = await context.entities.Scan.findMany({
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
  });

  return {
    scans: scans.map(s => ({
      id: s.id,
      status: s.status,
      inputType: s.inputType,
      inputRef: s.inputRef,
      planAtSubmission: s.planAtSubmission,
      created_at: s.createdAt,
      completed_at: s.completedAt,
    })),
    total,
    has_more: args.offset + args.limit < total,
  };
}
