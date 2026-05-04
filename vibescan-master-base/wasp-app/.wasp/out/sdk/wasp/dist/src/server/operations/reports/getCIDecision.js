import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { countFindingsBySeverity } from "./shared";
import { requireWorkspaceScopedUser } from "../../services/workspaceAccess";
const schema = z.object({ scanId: z.string().nonempty() });
function buildCriticalIssuesBySource(scanResults) {
    return scanResults.reduce((accumulator, result) => {
        const vulnerabilities = Array.isArray(result.vulnerabilities) ? result.vulnerabilities : [];
        const criticalCount = vulnerabilities.filter((item) => typeof item === 'object'
            && item !== null
            && String(item.severity || '').toLowerCase() === 'critical').length;
        if (criticalCount > 0) {
            accumulator[result.source] = criticalCount;
        }
        return accumulator;
    }, {});
}
export const getCIDecision = async (rawArgs, context) => {
    const { scanId } = ensureArgsSchemaOrThrowHttpError(schema, rawArgs);
    const user = await requireWorkspaceScopedUser(context.user);
    const scan = await prisma.scan.findUnique({
        where: { id: scanId },
        include: {
            findings: true,
            scanResults: {
                select: {
                    source: true,
                    vulnerabilities: true,
                },
            },
        },
    });
    if (!scan)
        throw new HttpError(404, "Scan not found");
    if (!(scan.workspaceId === user.workspaceId || (!scan.workspaceId && scan.userId === user.id))) {
        throw new HttpError(404, "Scan not found");
    }
    const findings = scan.findings || [];
    const criticalIssues = countFindingsBySeverity(findings, "critical");
    return {
        scanId,
        decision: criticalIssues === 0 ? "pass" : "fail",
        reason: criticalIssues === 0 ? "No critical vulnerabilities" : `${criticalIssues} critical vulnerabilities`,
        criticalIssues,
        criticalIssuesBySource: buildCriticalIssuesBySource(scan.scanResults || []),
    };
};
//# sourceMappingURL=getCIDecision.js.map