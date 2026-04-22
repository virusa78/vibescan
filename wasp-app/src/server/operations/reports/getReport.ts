import { type User, type Scan, type Finding } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { mapAcceptanceToAnnotationState } from "./annotations";

const getReportInputSchema = z.object({
  scanId: z.string().nonempty(),
});

export type GetReportInput = z.infer<typeof getReportInputSchema>;

interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface GetReportResponse {
  scanId: string;
  status: 'completed' | 'failed' | 'partial';
  lockedView: boolean;
  severity_breakdown: SeverityBreakdown;
  total_free: number;
  total_enterprise: number;
  delta_count: number;
  vulnerabilities: any[];
}

/**
 * Calculate severity breakdown from findings
 */
function calculateSeverityBreakdown(findings: Finding[]): SeverityBreakdown {
  const breakdown: SeverityBreakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const finding of findings) {
    const severity = (finding.severity || 'info').toLowerCase();
    if (severity in breakdown) {
      breakdown[severity as keyof SeverityBreakdown]++;
    }
  }

  return breakdown;
}

export const getReport = async (rawArgs: any, context: any): Promise<GetReportResponse> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(
    getReportInputSchema,
    rawArgs
  );

  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  // Fetch user and scan in parallel for efficiency
  const [user, scan] = await Promise.all([
    prisma.user.findUnique({ where: { id: context.user.id } }),
    prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        findings: true,
        scanDeltas: true,
      },
    }),
  ]);

  if (!user) {
    throw new HttpError(401, "User not found");
  }

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  if (scan.userId !== context.user.id) {
    throw new HttpError(403, "Unauthorized");
  }

  const acceptanceRows = await prisma.vulnAcceptance.findMany({
    where: {
      scanId,
      userId: context.user.id,
      vulnerabilityId: {
        in: scan.findings.map((finding) => finding.id),
      },
    },
  });

  const annotationByFindingId = new Map(
    acceptanceRows.map((acceptance) => [
      acceptance.vulnerabilityId,
      {
        state: mapAcceptanceToAnnotationState({
          status: acceptance.status,
          expiresAt: acceptance.expiresAt,
        }),
        reason: acceptance.reason,
        expires_at: acceptance.expiresAt ? acceptance.expiresAt.toISOString() : null,
      },
    ]),
  );

  const lockedView = false;

  // Get findings and categorize by source
  const findings = scan.findings || [];
  const freeFindings = findings.filter(f => f.source === 'free');
  const enterpriseFindings = findings.filter(f => f.source === 'enterprise');

  // Calculate severity breakdown
  const severity_breakdown = calculateSeverityBreakdown(findings);

  // Get delta info
  const scanDelta = scan.scanDeltas?.[0];
  const delta_count = scanDelta?.deltaCount || 0;
  const total_free = freeFindings.length;
  const total_enterprise = enterpriseFindings.length;

  const response: GetReportResponse = {
    scanId,
    status: scan.status === 'done' ? 'completed' : scan.status === 'error' ? 'failed' : 'partial',
    lockedView,
    severity_breakdown,
    total_free,
    total_enterprise,
    delta_count,
    vulnerabilities: findings.map(f => ({
      id: f.id,
      cveId: f.cveId,
      packageName: f.packageName,
      installedVersion: f.installedVersion,
      severity: f.severity,
      cvssScore: f.cvssScore,
      fixedVersion: f.fixedVersion,
      description: f.description,
      source: f.source,
      filePath: f.filePath,
      status: f.status,
      annotation: annotationByFindingId.get(f.id) ?? null,
    })),
  };

  return response;
};
