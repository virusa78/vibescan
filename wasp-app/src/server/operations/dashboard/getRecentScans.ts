import { HttpError } from 'wasp/server';
import type { Prisma } from '@prisma/client';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { mapRecentScans } from './recentScanMapper';

const scanStatusSchema = z.enum(['pending', 'scanning', 'done', 'error', 'cancelled']);
const sortFieldSchema = z.enum(['submitted', 'target', 'type', 'status', 'findings']);
const sortDirectionSchema = z.enum(['asc', 'desc']);

const defaultSort: SortDescriptor[] = [{ field: 'submitted', direction: 'desc' }];

export type ScanStatusValue = z.infer<typeof scanStatusSchema>;
export type ScanSortField = z.infer<typeof sortFieldSchema>;
export type ScanSortDirection = z.infer<typeof sortDirectionSchema>;

export interface SortDescriptor {
  field: ScanSortField;
  direction: ScanSortDirection;
}

const getRecentScansInputSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  status: z.array(scanStatusSchema).default([]),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z.array(z.object({
    field: sortFieldSchema,
    direction: sortDirectionSchema,
  })).min(1).max(4).default(defaultSort),
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
  status_counts: Record<ScanStatusValue, number>;
  total_count: number;
  filtered_count: number;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildOrderBy(sortDescriptors: SortDescriptor[]): Prisma.ScanOrderByWithRelationInput[] {
  const mapped: Prisma.ScanOrderByWithRelationInput[] = sortDescriptors.map((descriptor) => {
    switch (descriptor.field) {
      case 'submitted':
        return { createdAt: descriptor.direction };
      case 'target':
        return { inputRef: descriptor.direction };
      case 'type':
        return { inputType: descriptor.direction };
      case 'status':
        return { status: descriptor.direction };
      case 'findings':
        return { findings: { _count: descriptor.direction } };
      default:
        return { createdAt: 'desc' };
    }
  });

  const hasCreatedAtSort = mapped.some((orderClause) => Object.prototype.hasOwnProperty.call(orderClause, 'createdAt'));
  if (!hasCreatedAtSort) {
    mapped.push({ createdAt: 'desc' });
  }

  mapped.push({ id: 'desc' });
  return mapped;
}

export async function getRecentScans(rawArgs: any, context: any): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(getRecentScansInputSchema, rawArgs);
  const q = args.q?.trim();

  const queryFilter = q
    ? {
        OR: [
          { inputRef: { contains: q, mode: 'insensitive' } },
          { findings: { some: { cveId: { contains: q, mode: 'insensitive' } } } },
          ...(isUuid(q) ? [{ id: q }] : []),
        ],
      }
    : {};

  const baseWhere = {
    userId: context.user.id,
    ...queryFilter,
  };

  const filteredWhere = {
    ...baseWhere,
    ...(args.status.length > 0 ? { status: { in: args.status } } : {}),
  };

  const orderBy = buildOrderBy(args.sort);

  const [scans, totalCount, filteredCount, pendingCount, scanningCount, doneCount, errorCount, cancelledCount] = await Promise.all([
    context.entities.Scan.findMany({
      where: filteredWhere,
      orderBy,
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
    }),
    context.entities.Scan.count({
      where: { userId: context.user.id },
    }),
    context.entities.Scan.count({
      where: filteredWhere,
    }),
    context.entities.Scan.count({
      where: { ...baseWhere, status: 'pending' },
    }),
    context.entities.Scan.count({
      where: { ...baseWhere, status: 'scanning' },
    }),
    context.entities.Scan.count({
      where: { ...baseWhere, status: 'done' },
    }),
    context.entities.Scan.count({
      where: { ...baseWhere, status: 'error' },
    }),
    context.entities.Scan.count({
      where: { ...baseWhere, status: 'cancelled' },
    }),
  ]);

  return {
    scans: mapRecentScans(scans),
    status_counts: {
      pending: pendingCount,
      scanning: scanningCount,
      done: doneCount,
      error: errorCount,
      cancelled: cancelledCount,
    },
    total_count: totalCount,
    filtered_count: filteredCount,
  } as any;
}
