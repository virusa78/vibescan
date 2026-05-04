import { prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { mapRecentScans } from './recentScanMapper';
import { buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
const scanStatusSchema = z.enum(['pending', 'scanning', 'done', 'error', 'cancelled']);
const sortFieldSchema = z.enum(['submitted', 'target', 'type', 'status', 'findings']);
const sortDirectionSchema = z.enum(['asc', 'desc']);
const defaultSort = [{ field: 'submitted', direction: 'desc' }];
const getRecentScansInputSchema = z.object({
    limit: z.number().min(1).max(50).default(10),
    status: z.array(scanStatusSchema).default([]),
    q: z.string().trim().min(1).max(120).optional(),
    sort: z.array(z.object({
        field: sortFieldSchema,
        direction: sortDirectionSchema,
    })).min(1).max(4).default(defaultSort),
});
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function buildOrderBy(sortDescriptors) {
    const mapped = sortDescriptors.map((descriptor) => {
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
export async function getRecentScans(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(getRecentScansInputSchema, rawArgs);
    const q = args.q?.trim();
    const workspaceScopeWhere = buildWorkspaceOrLegacyOwnerWhere(user);
    const queryFilter = q
        ? {
            OR: [
                { inputRef: { contains: q, mode: 'insensitive' } },
                { findings: { some: { cveId: { contains: q, mode: 'insensitive' } } } },
                ...(isUuid(q) ? [{ id: q }] : []),
            ],
        }
        : {};
    const baseWhere = q
        ? {
            AND: [workspaceScopeWhere, queryFilter],
        }
        : workspaceScopeWhere;
    const filteredWhere = {
        ...baseWhere,
        ...(args.status.length > 0 ? { status: { in: args.status } } : {}),
    };
    const orderBy = buildOrderBy(args.sort);
    const [scans, totalCount, filteredCount, pendingCount, scanningCount, doneCount, errorCount, cancelledCount] = await Promise.all([
        prisma.scan.findMany({
            where: filteredWhere,
            orderBy,
            take: args.limit,
            select: {
                id: true,
                status: true,
                inputType: true,
                inputRef: true,
                planAtSubmission: true,
                plannedSources: true,
                createdAt: true,
                completedAt: true,
                scanResults: {
                    select: {
                        source: true,
                        vulnerabilities: true,
                    },
                },
                _count: {
                    select: {
                        findings: true,
                    },
                },
            },
        }),
        prisma.scan.count({
            where: buildWorkspaceOrLegacyOwnerWhere(user),
        }),
        prisma.scan.count({
            where: filteredWhere,
        }),
        prisma.scan.count({
            where: { ...baseWhere, status: 'pending' },
        }),
        prisma.scan.count({
            where: { ...baseWhere, status: 'scanning' },
        }),
        prisma.scan.count({
            where: { ...baseWhere, status: 'done' },
        }),
        prisma.scan.count({
            where: { ...baseWhere, status: 'error' },
        }),
        prisma.scan.count({
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
    };
}
//# sourceMappingURL=getRecentScans.js.map