import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { mapAcceptanceToAnnotationState } from "./annotations";
import { resolveCycloneDxPipelineMode } from "../../services/cyclonedxIngestionService.js";
import { buildSeverityBreakdown, type ReportFindingRecord, type ReportUserContext, type SeverityBreakdown } from "./shared";
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';

const getReportInputSchema = z.object({
  scanId: z.string().nonempty(),
});

export type GetReportInput = z.infer<typeof getReportInputSchema>;

interface GetReportResponse {
  scanId: string;
  status: 'completed' | 'failed' | 'partial';
  lockedView: boolean;
  severity_breakdown: SeverityBreakdown;
  total_free: number;
  total_enterprise: number;
  totals_by_source: Record<string, number>;
  delta_count: number;
  vulnerabilities: Array<{
    id: string;
    cveId: string | null;
    packageName: string;
    installedVersion: string;
    severity: string;
    cvssScore: number | null;
    fixedVersion: string | null;
    description: string | null;
    source: string;
    filePath: string | null;
    status: string;
    annotation: {
      state: string;
      reason: string | null;
      expires_at: string | null;
    } | null;
  }>;
}

interface UnifiedStatsPayload {
  vulnerabilityCount: number;
  severityCounts: Partial<Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>>;
}

function buildTotalsBySource(
  scanResults: Array<{ source: string; vulnerabilities: unknown }>,
): Record<string, number> {
  return scanResults.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.source] = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
    return accumulator;
  }, {});
}

function getLegacyCompatibilityTotals(totalsBySource: Record<string, number>): {
  totalFree: number;
  totalEnterprise: number;
} {
  const totalFree = totalsBySource.grype ?? 0;
  const totalAllSources = Object.values(totalsBySource).reduce((sum, count) => sum + count, 0);

  return {
    totalFree,
    totalEnterprise: totalAllSources - totalFree,
  };
}

function extractUnifiedStats(scanResults: Array<{ rawOutput: unknown }>): UnifiedStatsPayload | null {
  for (const result of scanResults) {
    if (!result.rawOutput || typeof result.rawOutput !== 'object') continue;

    const ingestionMeta = (result.rawOutput as Record<string, unknown>).ingestionMeta as
      | {
          resultStatus?: string;
          unifiedStats?: {
            vulnerabilityCount?: number;
            severityCounts?: Partial<Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>>;
          };
        }
      | undefined;
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

export const getReport = async (
  rawArgs: unknown,
  context: any,
): Promise<any> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(
    getReportInputSchema,
    rawArgs
  );

  const user = await requireWorkspaceScopedUser(context.user);

  // Fetch user and scan in parallel for efficiency
  const [userRecord, scan] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        findings: true,
        scanDeltas: true,
        scanResults: {
          select: {
            source: true,
            vulnerabilities: true,
            rawOutput: true,
          },
        },
      },
    }),
  ]);

  if (!userRecord) {
    throw new HttpError(401, "User not found");
  }

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  const canAccessScan =
    scan.workspaceId === user.workspaceId ||
    (!scan.workspaceId && scan.userId === user.id);
  if (!canAccessScan) {
    throw new HttpError(404, "Scan not found");
  }

  const acceptanceRows = await prisma.vulnAcceptance.findMany({
    where: {
      scanId,
      userId: user.id,
      vulnerabilityId: {
        in: scan.findings.map((finding) => finding.id),
      },
    },
  });

  const annotationByFindingId = new Map<string, {
    state: string;
    reason: string | null;
    expires_at: string | null;
  }>(
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

  const findings = (scan.findings || []) as unknown as ReportFindingRecord[];
  const totalsBySource = buildTotalsBySource(scan.scanResults || []);
  const compatibilityTotals = getLegacyCompatibilityTotals(totalsBySource);

  // Calculate severity breakdown
  const severity_breakdown = buildSeverityBreakdown(findings);
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

  const response: GetReportResponse = {
    scanId,
    status: scan.status === 'done' ? 'completed' : scan.status === 'error' ? 'failed' : 'partial',
    lockedView,
    severity_breakdown: effectiveSeverityBreakdown,
    total_free: compatibilityTotals.totalFree,
    total_enterprise: compatibilityTotals.totalEnterprise,
    totals_by_source: totalsBySource,
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
