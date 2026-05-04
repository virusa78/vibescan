import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { buildSeverityBreakdown, type ReportUserContext } from "./shared";
import { requireWorkspaceScopedUser } from "../../services/workspaceAccess";
import { serializeDecimalFields } from "../../utils/serialization";

const schema = z.object({ scanId: z.string().nonempty() });

type ReportSummaryResponse = {
  scanId: string;
  totalFindings: number;
  totalsBySource: Record<string, number>;
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

function buildTotalsBySource(scanResults: Array<{ source: string; vulnerabilities: unknown }>): Record<string, number> {
  return scanResults.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.source] = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
    return accumulator;
  }, {});
}

export const getReportSummary = async (
  rawArgs: unknown,
  context: any,
): Promise<any> => {
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

  if (!scan) throw new HttpError(404, "Scan not found");
  if (!(scan.workspaceId === user.workspaceId || (!scan.workspaceId && scan.userId === user.id))) {
    throw new HttpError(404, "Scan not found");
  }

  const findings = scan.findings || [];
  const severityBreakdown = buildSeverityBreakdown(findings);
  return serializeDecimalFields({
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
  });
};
