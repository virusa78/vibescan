import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs';
import type { Prisma, PrismaClient, ScanSource } from '@prisma/client';
import type { ScannerFindingForPersistence } from './scannerExecutionTypes.js';
import type { PersistedFindingSource } from './findingPersistenceService.js';

type ProjectLifecyclePrismaClient = Pick<
  PrismaClient,
  'project' | 'projectFinding' | 'scan' | 'finding'
>;

type ScanInputType = 'github' | 'github_app' | 'sbom' | 'sbom_upload' | 'source_zip' | 'dast' | string;

const severitySlaDays: Record<string, number | null> = {
  CRITICAL: 7,
  HIGH: 30,
  MEDIUM: 60,
  LOW: 90,
  INFO: null,
};

export function buildProjectFindingFingerprint(finding: Pick<ScannerFindingForPersistence, 'cveId' | 'package' | 'version' | 'filePath'>): string {
  const normalizedPath = finding.filePath ? finding.filePath.replace(/^\.\//, '') : '';
  const fingerprintKey = `${finding.cveId}|${finding.package}|${finding.version}|${normalizedPath}`;
  return createHash('sha256').update(fingerprintKey).digest('hex');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
}

const DEFAULT_UPLOAD_PREFIX_PATTERN = /^upload-\d+-/;

export function getUploadPrefixPattern(): RegExp {
  const customPattern = process.env.VIBESCAN_UPLOAD_PREFIX_PATTERN;
  if (customPattern) {
    try {
      return new RegExp(customPattern);
    } catch {
      // fallback if regex is invalid
    }
  }
  return DEFAULT_UPLOAD_PREFIX_PATTERN;
}

export function getSbomFingerprint(inputRef: string): string | null {
  try {
    const runtimeTempRoot = process.env.VIBESCAN_RUNTIME_TMP_DIR
      ?? path.join(process.cwd(), 'test-results', 'runtime-temp');
    const defaultTrustedScanInputRoot = path.join(runtimeTempRoot, 'scan-inputs');
    const rootDir = process.env.VIBESCAN_SCAN_INPUT_DIR ?? defaultTrustedScanInputRoot;

    const candidate = path.isAbsolute(inputRef) ? path.resolve(inputRef) : path.resolve(rootDir, inputRef);
    if (!fs.existsSync(candidate)) {
      return null;
    }

    const rawText = fs.readFileSync(candidate, 'utf8').trim();
    const parsed = JSON.parse(rawText);

    let components: any[] = [];
    if (parsed && Array.isArray(parsed.components)) {
      components = parsed.components;
    }

    if (components.length === 0) {
      return null;
    }

    const names = Array.from(new Set(
      components
        .map((c: any) => c?.name)
        .filter((name: any): name is string => typeof name === 'string' && name.trim().length > 0)
        .map((name: string) => name.trim().toLowerCase())
    )).sort();

    if (names.length === 0) {
      return null;
    }

    const fingerprintKey = names.join(',');
    return createHash('sha256').update(fingerprintKey).digest('hex');
  } catch {
    return null;
  }
}

export function normalizeProjectTarget(inputType: ScanInputType, inputRef: string): {
  name: string;
  slug: string;
  targetType: 'github' | 'sbom' | 'source_zip' | 'dast' | 'other';
  targetRef: string;
  normalizedTargetRef: string;
  metadata: Record<string, unknown>;
} {
  const trimmed = inputRef.trim();
  const normalizedType = inputType === 'github_app' ? 'github' : inputType === 'sbom_upload' ? 'sbom' : inputType;

  if (normalizedType === 'github') {
    try {
      const url = new URL(trimmed);
      const [owner, repo] = url.pathname.replace(/^\/+/, '').replace(/\.git$/, '').split('/');
      if (owner && repo) {
        const normalizedTargetRef = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
        return {
          name: `${owner}/${repo}`,
          slug: slugify(`${owner}-${repo}`),
          targetType: 'github',
          targetRef: trimmed,
          normalizedTargetRef,
          metadata: { host: url.host },
        };
      }
    } catch {
      const match = trimmed.replace(/^git@[^:]+:/, '').replace(/\.git$/, '').match(/^([^/]+)\/([^/]+)$/);
      if (match) {
        const normalizedTargetRef = `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
        return {
          name: `${match[1]}/${match[2]}`,
          slug: slugify(`${match[1]}-${match[2]}`),
          targetType: 'github',
          targetRef: trimmed,
          normalizedTargetRef,
          metadata: {},
        };
      }
    }
  }

  const base = path.basename(trimmed);
  const uploadPattern = getUploadPrefixPattern();
  const cleanBase = base.replace(uploadPattern, '');
  const isUpload = cleanBase !== base;
  const basename = cleanBase.replace(/\.(json|xml|zip|tar|gz|tgz)$/i, '') || cleanBase;
  const targetType = normalizedType === 'dast' || normalizedType === 'source_zip' || normalizedType === 'sbom'
    ? normalizedType
    : 'other';

  let targetRef = isUpload ? cleanBase : trimmed;
  let normalizedTargetRef = `${targetType}:${targetRef.toLowerCase()}`;
  let nameSuffix = '';

  if (targetType === 'sbom') {
    const sbomHash = getSbomFingerprint(trimmed);
    if (sbomHash) {
      targetRef = sbomHash;
      normalizedTargetRef = `sbom:${sbomHash}`;
      nameSuffix = ` (${sbomHash.slice(-8)})`;
    }
  }

  const name = basename + nameSuffix;

  return {
    name,
    slug: slugify(name),
    targetType,
    targetRef,
    normalizedTargetRef,
    metadata: { inputType },
  };
}

export async function resolveProjectForScanInput(
  prisma: ProjectLifecyclePrismaClient,
  input: {
    workspaceId: string;
    inputType: ScanInputType;
    inputRef: string;
  },
): Promise<{ id: string }> {
  const target = normalizeProjectTarget(input.inputType, input.inputRef);

  return prisma.project.upsert({
    where: {
      workspaceId_normalizedTargetRef: {
        workspaceId: input.workspaceId,
        normalizedTargetRef: target.normalizedTargetRef,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      name: target.name,
      slug: target.slug,
      targetType: target.targetType,
      targetRef: target.targetRef,
      normalizedTargetRef: target.normalizedTargetRef,
      metadata: target.metadata as Prisma.InputJsonValue,
    },
    update: {
      name: target.name,
      targetRef: target.targetRef,
      metadata: target.metadata as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

export function calculateSlaDueAt(severity: string, firstSeenAt: Date): Date | null {
  const days = severitySlaDays[severity.toUpperCase()] ?? null;
  if (!days) return null;
  const dueAt = new Date(firstSeenAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + days);
  return dueAt;
}

export function calculateSlaState(slaDueAt: Date | null, now = new Date()): 'none' | 'on_track' | 'due_soon' | 'overdue' {
  if (!slaDueAt) return 'none';
  if (slaDueAt.getTime() < now.getTime()) return 'overdue';
  const dueSoonAt = new Date(now);
  dueSoonAt.setUTCDate(dueSoonAt.getUTCDate() + 7);
  return slaDueAt.getTime() <= dueSoonAt.getTime() ? 'due_soon' : 'on_track';
}

export async function persistProjectFindingsForScan(input: {
  prisma: ProjectLifecyclePrismaClient;
  scanId: string;
  source: PersistedFindingSource;
  findings: ScannerFindingForPersistence[];
}): Promise<void> {
  const scan = await input.prisma.scan.findUnique({
    where: { id: input.scanId },
    select: {
      id: true,
      projectId: true,
      workspaceId: true,
      completedAt: true,
      createdAt: true,
    },
  });

  if (!scan?.projectId || !scan.workspaceId) {
    return;
  }

  const detectedAt = scan.completedAt ?? new Date();
  const source = input.source as ScanSource;

  for (const finding of input.findings) {
    const fingerprint = buildProjectFindingFingerprint(finding);
    const severity = finding.severity.toUpperCase();
    const existing = await input.prisma.projectFinding.findUnique({
      where: {
        projectId_fingerprint: {
          projectId: scan.projectId,
          fingerprint,
        },
      },
      select: {
        id: true,
        status: true,
        firstSeenAt: true,
        lastScanId: true,
        scanCount: true,
        reportedBy: true,
      },
    });

    if (!existing) {
      const slaDueAt = calculateSlaDueAt(severity, detectedAt);
      await input.prisma.projectFinding.create({
        data: {
          workspaceId: scan.workspaceId,
          projectId: scan.projectId,
          fingerprint,
          cveId: finding.cveId,
          packageName: finding.package,
          installedVersion: finding.version,
          filePath: finding.filePath ? finding.filePath.replace(/^\.\//, '') : null,
          severity,
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          status: 'active',
          firstSeenAt: detectedAt,
          lastSeenAt: detectedAt,
          lastDetectedAt: detectedAt,
          lastScanId: scan.id,
          scanCount: 1,
          reportedBy: [source],
          firstDetectedBy: source,
          lastDetectedBy: source,
          slaDueAt,
          slaState: calculateSlaState(slaDueAt, detectedAt),
        },
      });
      continue;
    }

    const firstSeenAt = existing.firstSeenAt;
    const slaDueAt = calculateSlaDueAt(severity, firstSeenAt);
    const reportedBy = Array.from(new Set([...(existing.reportedBy as ScanSource[]), source])).sort() as ScanSource[];

    await input.prisma.projectFinding.update({
      where: { id: existing.id },
      data: {
        cveId: finding.cveId,
        packageName: finding.package,
        installedVersion: finding.version,
        filePath: finding.filePath ? finding.filePath.replace(/^\.\//, '') : null,
        severity,
        cvssScore: finding.cvssScore,
        fixedVersion: finding.fixedVersion,
        description: finding.description,
        status: existing.status === 'mitigated' ? 'active' : existing.status,
        lastSeenAt: detectedAt,
        lastDetectedAt: detectedAt,
        lastScanId: scan.id,
        reopenedAt: existing.status === 'mitigated' ? detectedAt : undefined,
        scanCount: existing.lastScanId === scan.id ? existing.scanCount : { increment: 1 },
        reportedBy,
        lastDetectedBy: source,
        slaDueAt,
        slaState: calculateSlaState(slaDueAt, detectedAt),
      },
    });
  }
}

export async function markProjectFindingsMitigatedForCompletedScan(input: {
  prisma: ProjectLifecyclePrismaClient;
  scanId: string;
  completedAt: Date;
}): Promise<void> {
  const scan = await input.prisma.scan.findUnique({
    where: { id: input.scanId },
    select: { id: true, projectId: true, workspaceId: true },
  });

  if (!scan?.projectId || !scan.workspaceId) {
    return;
  }

  const detectedFindings = await input.prisma.finding.findMany({
    where: { scanId: input.scanId },
    select: { fingerprint: true },
  });
  const detectedFingerprints = detectedFindings.map((finding) => finding.fingerprint);

  await input.prisma.projectFinding.updateMany({
    where: {
      workspaceId: scan.workspaceId,
      projectId: scan.projectId,
      status: { not: 'mitigated' },
      ...(detectedFingerprints.length > 0
        ? { fingerprint: { notIn: detectedFingerprints } }
        : {}),
    },
    data: {
      status: 'mitigated',
      lastMitigatedAt: input.completedAt,
      slaState: 'none',
    },
  });
}
