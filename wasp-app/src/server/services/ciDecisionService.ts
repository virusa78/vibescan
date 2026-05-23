import type { PrismaClient } from '@prisma/client';
import { getFrontendBaseUrl } from '../config/runtime';
import { validateGitHubUrl } from './inputAdapterService';

export type SeverityThreshold = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CiDecisionPolicySource = 'github_installation' | 'default';

export type CiDecisionResult = {
  scanId: string;
  decision: 'pass' | 'fail';
  reason: string;
  blockingIssues: number;
  blockingIssuesBySource: Record<string, number>;
  effectiveThreshold: SeverityThreshold;
  scanUrl: string;
  reportUrl: string;
  policySource: CiDecisionPolicySource;
  criticalIssues: number;
  criticalIssuesBySource: Record<string, number>;
};

type CiDecisionFinding = {
  severity: string | null | undefined;
  source: string;
};

type CiDecisionScanRecord = {
  id: string;
  workspaceId: string | null;
  inputType: string;
  inputRef: string;
  githubContext: unknown;
  findings: CiDecisionFinding[];
};

type CiDecisionPrisma = Pick<PrismaClient, 'scan' | 'githubInstallation'>;

const SEVERITY_RANK: Record<SeverityThreshold, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const DEFAULT_THRESHOLD: SeverityThreshold = 'CRITICAL';

function normalizeThreshold(value: unknown): SeverityThreshold {
  const threshold = String(value ?? '').trim().toUpperCase();
  if (threshold === 'LOW' || threshold === 'MEDIUM' || threshold === 'HIGH' || threshold === 'CRITICAL') {
    return threshold;
  }

  return DEFAULT_THRESHOLD;
}

function normalizeSeverity(value: string | null | undefined): SeverityThreshold | null {
  const severity = String(value ?? '').trim().toUpperCase();
  if (severity === 'LOW' || severity === 'MEDIUM' || severity === 'HIGH' || severity === 'CRITICAL') {
    return severity;
  }

  return null;
}

function isBlockingSeverity(severity: string | null | undefined, threshold: SeverityThreshold): boolean {
  const normalizedSeverity = normalizeSeverity(severity);
  if (!normalizedSeverity) {
    return false;
  }

  return SEVERITY_RANK[normalizedSeverity] >= SEVERITY_RANK[threshold];
}

export function buildBlockingIssuesBySource(
  findings: CiDecisionFinding[],
  threshold: SeverityThreshold,
): Record<string, number> {
  return findings.reduce<Record<string, number>>((accumulator, finding) => {
    if (!isBlockingSeverity(finding.severity, threshold)) {
      return accumulator;
    }

    accumulator[finding.source] = (accumulator[finding.source] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function buildCiDecisionReason(
  blockingIssues: number,
  threshold: SeverityThreshold,
  blockingIssuesBySource: Record<string, number>,
): string {
  if (blockingIssues === 0) {
    return `No findings at or above ${threshold}`;
  }

  const bySource = Object.entries(blockingIssuesBySource)
    .map(([source, count]) => `${source}: ${count}`)
    .join(', ');
  const findingLabel = blockingIssues === 1 ? 'finding' : 'findings';

  return `${blockingIssues} ${findingLabel} at or above ${threshold}${bySource ? ` (${bySource})` : ''}`;
}

function buildCiDecisionUrls(scanId: string): { scanUrl: string; reportUrl: string } {
  return {
    scanUrl: `${getFrontendBaseUrl()}/scans/${scanId}`,
    reportUrl: `${getFrontendBaseUrl()}/reports/${scanId}`,
  };
}

async function resolveThresholdFromInstallation(
  prisma: CiDecisionPrisma,
  scan: CiDecisionScanRecord,
): Promise<{ effectiveThreshold: SeverityThreshold; policySource: CiDecisionPolicySource }> {
  const githubContext = scan.githubContext && typeof scan.githubContext === 'object' && !Array.isArray(scan.githubContext)
    ? scan.githubContext as { installationId?: string | number | bigint | null }
    : null;

  if (githubContext?.installationId) {
    try {
      const installation = await prisma.githubInstallation.findUnique({
        where: {
          githubInstallationId: BigInt(githubContext.installationId),
        },
        select: {
          failPrOnSeverity: true,
        },
      });

      if (installation?.failPrOnSeverity) {
        return {
          effectiveThreshold: normalizeThreshold(installation.failPrOnSeverity),
          policySource: 'github_installation',
        };
      }
    } catch {
      // Invalid installation IDs fall back to the default policy.
    }
  }

  if (scan.inputType === 'github_app' || scan.inputType === 'github') {
    try {
      const { owner, repo } = validateGitHubUrl(scan.inputRef);
      const repositoryFullName = `${owner}/${repo}`;

      const installation = await prisma.githubInstallation.findFirst({
        where: {
          workspaceId: scan.workspaceId,
          OR: [
            { reposScope: { has: repositoryFullName } },
            {
              repositorySelection: 'all',
              reposScope: { isEmpty: true },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          failPrOnSeverity: true,
        },
      });

      if (installation?.failPrOnSeverity) {
        return {
          effectiveThreshold: normalizeThreshold(installation.failPrOnSeverity),
          policySource: 'github_installation',
        };
      }
    } catch {
      // Fall back to the default threshold if the inputRef is not a GitHub URL.
    }
  }

  return {
    effectiveThreshold: DEFAULT_THRESHOLD,
    policySource: 'default',
  };
}

export async function buildCiDecisionForScan(
  prisma: CiDecisionPrisma,
  scanId: string,
): Promise<CiDecisionResult> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      workspaceId: true,
      inputType: true,
      inputRef: true,
      githubContext: true,
      findings: {
        select: {
          severity: true,
          source: true,
        },
      },
    },
  }) as CiDecisionScanRecord | null;

  if (!scan) {
    throw new Error('Scan not found');
  }

  const { effectiveThreshold, policySource } = await resolveThresholdFromInstallation(prisma, scan);
  const blockingIssuesBySource = buildBlockingIssuesBySource(scan.findings ?? [], effectiveThreshold);
  const blockingIssues = Object.values(blockingIssuesBySource).reduce((sum, count) => sum + count, 0);
  const decision = blockingIssues === 0 ? 'pass' : 'fail';
  const { scanUrl, reportUrl } = buildCiDecisionUrls(scan.id);
  const reason = buildCiDecisionReason(blockingIssues, effectiveThreshold, blockingIssuesBySource);

  return {
    scanId: scan.id,
    decision,
    reason,
    blockingIssues,
    blockingIssuesBySource,
    effectiveThreshold,
    scanUrl,
    reportUrl,
    policySource,
    criticalIssues: blockingIssues,
    criticalIssuesBySource: blockingIssuesBySource,
  };
}
