import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { buildSeverityBreakdown } from "./shared";
import { requireWorkspaceScopedUser } from "../../services/workspaceAccess";
const schema = z.object({ scanId: z.string().nonempty() });
function buildTotalsBySource(scanResults) {
    return scanResults.reduce((accumulator, result) => {
        accumulator[result.source] = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
        return accumulator;
    }, {});
}
export const getReportSummary = async (rawArgs, context) => {
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
    const severityBreakdown = buildSeverityBreakdown(findings);
    return {
        scanId,
        totalFindings: findings.length,
        totalsBySource: buildTotalsBySource(scan.scanResults || []),
        severity: {
            critical: severityBreakdown.critical,
            high: severityBreakdown.high,
            medium: severityBreakdown.medium,
            low: severityBreakdown.low,
            info: severityBreakdown.info,
        },
    };
};
//# sourceMappingURL=getReportSummary.js.map