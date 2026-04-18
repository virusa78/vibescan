import { type User, type Scan, type Finding } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";

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
  vulnerabilities?: any[]; // Only if not locked
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

/**
 * Determine if user's plan should have a locked view (counts only)
 */
function isLockedView(planAtSubmission: string | null): boolean {
  if (!planAtSubmission) return true; // Default to locked for safety
  const plan = (planAtSubmission || '').toLowerCase();
  return plan === 'starter' || plan === 'free_trial';
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

  // Determine paywall enforcement based on the plan at submission
  // Use actual user.plan from DB for current tier verification
  const lockedView = isLockedView(scan.planAtSubmission);

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
  };

  // Only include vulnerability details if NOT locked
  if (!lockedView) {
    response.vulnerabilities = findings.map(f => ({
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
    }));
  }

  return response;
};
