import { prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { buildNestedScanWorkspaceWhere, buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
const getScanStatsInputSchema = z.object({
    time_range: z.string().default('30d'),
});
const trackedStatuses = {
    pending: 0,
    scanning: 0,
    done: 0,
    error: 0,
    cancelled: 0,
};
export async function getScanStats(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(getScanStatsInputSchema, rawArgs);
    const now = new Date();
    let fromDate = new Date(0);
    if (args.time_range === '7d') {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    else if (args.time_range === '30d') {
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    const where = {
        ...buildWorkspaceOrLegacyOwnerWhere(user),
        createdAt: { gte: fromDate },
    };
    const scans = await prisma.scan.findMany({
        where,
        select: {
            id: true,
            status: true,
            createdAt: true,
        },
    });
    const byStatus = { ...trackedStatuses };
    scans.forEach((scan) => {
        if (scan.status in byStatus) {
            byStatus[scan.status]++;
        }
    });
    const [findings, scanResults] = await Promise.all([
        prisma.finding.findMany({
            where: {
                scanId: { in: scans.map((scan) => scan.id) },
                status: 'active',
            },
            select: {
                severity: true,
            },
        }),
        prisma.scanResult.findMany({
            where: {
                scan: {
                    ...buildNestedScanWorkspaceWhere(user),
                    createdAt: { gte: fromDate },
                },
            },
            select: {
                source: true,
                vulnerabilities: true,
            },
        }),
    ]);
    const bySeverity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
    };
    const bySource = scanResults.reduce((accumulator, result) => {
        accumulator[result.source] = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
        return accumulator;
    }, {});
    findings.forEach((finding) => {
        const severity = finding.severity.toLowerCase();
        if (severity in bySeverity) {
            bySeverity[severity]++;
        }
    });
    const daysInRange = Math.max(1, (now.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    const scanRate = {
        per_day: parseFloat((scans.length / daysInRange).toFixed(2)),
        per_week: parseFloat(((scans.length / daysInRange) * 7).toFixed(2)),
    };
    return {
        total_scans: scans.length,
        by_status: byStatus,
        by_severity: bySeverity,
        scan_rate: scanRate,
        by_source: bySource,
        time_range: args.time_range,
    };
}
//# sourceMappingURL=getScanStats.js.map