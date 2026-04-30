import { type User, type Scan, type Finding } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { mapAcceptanceToAnnotationState } from "./annotations";
import { resolveCycloneDxPipelineMode } from "../../services/cyclonedxIngestionService.js";

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

interface UnifiedStatsPayload {
  vulnerabilityCount: number;
  severityCounts: Partial<Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>>;
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

function extractUnifiedStats(scanResults: Array<{ rawOutput: unknown }>): UnifiedStatsPayload | null {
  for (const result of scanResults) {
    if (!result.rawOutput || typeof result.rawOutput !== 'object') continue;

    const ingestionMeta = (result.rawOutput as Record<string, any>).ingestionMeta;
    if (!ingestionMeta || ingestionMeta.resultStatus !== 'ingested') continue;

    const unifiedStats = ingestionMeta.unifiedStats;
    if (!unifiedStats || typeof unifiedStats !== 'object') continue;
    if (typeof unifiedStats.vulnerabilityCount !== 'number') continue;

    return {
      vulnerabilityCount: unifiedStats.vulnerabilityCount,
      severityCounts: (unifiedStats.severityCounts || {}) as UnifiedStatsPayload['severityCounts'],
    };
  }

  return null;
}

export const getReport = async (rawArgs: any, context: any): Promise<any> => {
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
        scanResults: {
          select: {
            rawOutput: true,
          },
        },
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
  const pipelineMode = resolveCycloneDxPipelineMode();
  const useUnifiedReadPath = pipelineMode === 'cutover';
  const unifiedStats = useUnifiedReadPath ? extractUnifiedStats(scan.scanResults || []) : null;
  const effectiveSeverityBreakdown: SeverityBreakdown = unifiedStats
    ? {
        critical: unifiedStats.severityCounts.critical || 0,
        high: unifiedStats.severityCounts.high || 0,
        medium: unifiedStats.severityCounts.medium || 0,
        low: unifiedStats.severityCounts.low || 0,
        info: unifiedStats.severityCounts.info || 0,
      }
    : severity_breakdown;

  // Get delta info
  const scanDelta = scan.scanDeltas?.[0];
  const delta_count = scanDelta?.deltaCount || 0;
  const total_free = freeFindings.length;
  const total_enterprise = enterpriseFindings.length;

  const response = {
    scanId,
    status: scan.status === 'done' ? 'completed' : scan.status === 'error' ? 'failed' : 'partial',
    lockedView,
    severity_breakdown: effectiveSeverityBreakdown,
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

  return response as any;
};
