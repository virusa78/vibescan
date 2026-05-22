import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { countJsonArrayItems } from './shared.js';
import { buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
const getScanInputSchema = z.object({
    scan_id: z.string().uuid(),
});
function toSeverityDeltaMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const entries = Object.entries(value).filter(([, count]) => typeof count === 'number');
    return Object.fromEntries(entries);
}
function buildCountsBySource(results) {
    return results.reduce((accumulator, result) => {
        accumulator[result.source] = countJsonArrayItems(result.vulnerabilities);
        return accumulator;
    }, {});
}
function getLegacyCompatibilityCounts(countsBySource) {
    const freeCount = countsBySource.grype ?? 0;
    const totalCount = Object.values(countsBySource).reduce((sum, count) => sum + count, 0);
    const enterpriseCount = totalCount - freeCount;
    return {
        freeCount,
        enterpriseCount,
        totalCount,
    };
}
export async function getScan(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(getScanInputSchema, rawArgs);
    const scan = await prisma.scan.findFirst({
        where: {
            id: args.scan_id,
            ...buildWorkspaceOrLegacyOwnerWhere(user),
        },
    });
    if (!scan) {
        throw new HttpError(404, 'Scan not found or unauthorized');
    }
    const scanResults = await prisma.scanResult.findMany({
        where: { scanId: scan.id },
    });
    const countsBySource = buildCountsBySource(scanResults);
    const compatibilityCounts = getLegacyCompatibilityCounts(countsBySource);
    const scanDelta = await prisma.scanDelta.findUnique({
        where: { scanId: scan.id },
    });
    const deltaBySeverity = toSeverityDeltaMap(scanDelta?.deltaBySeverity);
    const deltaCount = scanDelta?.deltaCount || 0;
    return {
        scan: {
            id: scan.id,
            status: scan.status,
            inputType: scan.inputType,
            inputRef: scan.inputRef,
            planAtSubmission: scan.planAtSubmission,
            planned_sources: Array.isArray(scan.plannedSources) ? scan.plannedSources : [],
            created_at: scan.createdAt,
            completed_at: scan.completedAt,
            error_message: scan.errorMessage,
        },
        results_summary: {
            free_count: compatibilityCounts.freeCount,
            enterprise_count: compatibilityCounts.enterpriseCount,
            total_count: compatibilityCounts.totalCount,
            counts_by_source: countsBySource,
        },
        delta_summary: {
            delta_count: deltaCount,
            delta_by_severity: deltaBySeverity,
            is_locked: scanDelta?.isLocked ?? false,
        },
        status: scan.status,
    };
}
//# sourceMappingURL=getScan.js.map