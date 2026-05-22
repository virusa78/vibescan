import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import type { Prisma } from '@prisma/client';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { calculateSlaState } from '../../services/projectFindingLifecycleService';

const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const statusSchema = z.enum(['active', 'accepted', 'snoozed', 'rejected', 'mitigated']);
const slaSchema = z.enum(['overdue', 'due_soon', 'on_track', 'none']);
const scannerSchema = z.enum(['grype', 'codescoring_johnny', 'snyk', 'trivy', 'owasp', 'dast']);
const sortFieldSchema = z.enum(['severity', 'firstSeen', 'lastSeen', 'project', 'package', 'scanCount', 'fixedVersion', 'sla']);
const sortDirectionSchema = z.enum(['asc', 'desc']);

const getFindingsOverviewSchema = z.object({
  q: z.string().trim().max(160).optional(),
  severity: z.array(severitySchema).default([]),
  status: z.array(statusSchema).default(['active']),
  projectId: z.string().uuid().optional(),
  scanner: z.array(scannerSchema).default([]),
  fixable: z.boolean().optional(),
  sla: z.array(slaSchema).default([]),
  age: z.array(z.enum(['new', '7d', '30d', '90d'])).default([]),
  sort: z.object({
    field: sortFieldSchema,
    direction: sortDirectionSchema,
  }).default({ field: 'severity', direction: 'desc' }),
  limit: z.number().min(1).max(500).default(250),
});

const annotationSchema = z.object({
  projectFindingId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

const severityRank: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function normalizeAnnotation(annotation: any, now: Date) {
  if (!annotation) return null;
  if (annotation.state === 'snoozed' && annotation.expiresAt && annotation.expiresAt.getTime() <= now.getTime()) {
    return { ...annotation, state: 'expired' };
  }
  return annotation;
}

function matchesAgeBucket(finding: { firstSeenAt: Date }, buckets: string[], now: Date): boolean {
  if (buckets.length === 0) return true;
  const age = daysBetween(finding.firstSeenAt, now);
  return buckets.some((bucket) => {
    if (bucket === 'new') return age < 7;
    if (bucket === '7d') return age >= 7;
    if (bucket === '30d') return age >= 30;
    if (bucket === '90d') return age >= 90;
    return true;
  });
}

function buildOrderBy(args: z.infer<typeof getFindingsOverviewSchema>): Prisma.ProjectFindingOrderByWithRelationInput[] {
  const direction = args.sort.direction;
  switch (args.sort.field) {
    case 'firstSeen':
      return [{ firstSeenAt: direction }, { id: 'desc' }];
    case 'lastSeen':
      return [{ lastSeenAt: direction }, { id: 'desc' }];
    case 'project':
      return [{ project: { name: direction } }, { lastSeenAt: 'desc' }];
    case 'package':
      return [{ packageName: direction }, { lastSeenAt: 'desc' }];
    case 'scanCount':
      return [{ scanCount: direction }, { lastSeenAt: 'desc' }];
    case 'fixedVersion':
      return [{ fixedVersion: direction }, { lastSeenAt: 'desc' }];
    case 'sla':
      return [{ slaDueAt: direction }, { lastSeenAt: 'desc' }];
    default:
      return [{ slaState: 'desc' }, { lastSeenAt: 'desc' }];
  }
}

export async function getFindingsOverview(rawArgs: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(getFindingsOverviewSchema, rawArgs ?? {});
  const now = new Date();
  const q = args.q?.trim();

  const where: Prisma.ProjectFindingWhereInput = {
    workspaceId: user.workspaceId,
    ...(args.projectId ? { projectId: args.projectId } : {}),
    ...(args.severity.length > 0 ? { severity: { in: args.severity.map((value) => value.toUpperCase()) } } : {}),
    ...(args.status.length > 0 ? { status: { in: args.status } } : {}),
    ...(args.scanner.length > 0 ? { reportedBy: { hasSome: args.scanner as any } } : {}),
    ...(args.fixable === true ? { fixedVersion: { not: null } } : {}),
    ...(args.fixable === false ? { fixedVersion: null } : {}),
    ...(args.sla.length > 0 ? { slaState: { in: args.sla as any } } : {}),
    ...(q
      ? {
          OR: [
            { cveId: { contains: q, mode: 'insensitive' } },
            { packageName: { contains: q, mode: 'insensitive' } },
            { filePath: { contains: q, mode: 'insensitive' } },
            { project: { name: { contains: q, mode: 'insensitive' } } },
            { project: { targetRef: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [rawFindings, projects] = await Promise.all([
    prisma.projectFinding.findMany({
      where,
      orderBy: buildOrderBy(args),
      take: args.limit,
      include: {
        project: { select: { id: true, name: true, targetType: true, targetRef: true } },
        lastScan: { select: { id: true, inputRef: true, completedAt: true } },
        annotations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            state: true,
            reason: true,
            expiresAt: true,
            createdAt: true,
            userId: true,
          },
        },
      },
    }),
    prisma.project.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const findings = rawFindings
    .filter((finding) => matchesAgeBucket(finding, args.age, now))
    .map((finding) => {
      const annotation = normalizeAnnotation(finding.annotations[0] ?? null, now);
      const effectiveStatus = annotation?.state === 'expired' && finding.status === 'snoozed' ? 'active' : finding.status;
      const slaState = calculateSlaState(finding.slaDueAt, now);
      return {
        id: finding.id,
        project: finding.project,
        cveId: finding.cveId,
        packageName: finding.packageName,
        installedVersion: finding.installedVersion,
        filePath: finding.filePath,
        severity: finding.severity.toLowerCase(),
        cvssScore: finding.cvssScore ? Number(finding.cvssScore) : null,
        fixedVersion: finding.fixedVersion,
        description: finding.description,
        status: effectiveStatus,
        firstSeenAt: finding.firstSeenAt.toISOString(),
        lastSeenAt: finding.lastSeenAt.toISOString(),
        lastDetectedAt: finding.lastDetectedAt.toISOString(),
        lastMitigatedAt: finding.lastMitigatedAt?.toISOString() ?? null,
        reopenedAt: finding.reopenedAt?.toISOString() ?? null,
        scanCount: finding.scanCount,
        reportedBy: finding.reportedBy,
        firstDetectedBy: finding.firstDetectedBy,
        lastDetectedBy: finding.lastDetectedBy,
        slaDueAt: finding.slaDueAt?.toISOString() ?? null,
        slaState,
        ageDays: daysBetween(finding.firstSeenAt, now),
        activeDays: daysBetween(finding.lastMitigatedAt ?? finding.firstSeenAt, now),
        latestScan: finding.lastScan
          ? {
              id: finding.lastScan.id,
              inputRef: finding.lastScan.inputRef,
              completedAt: finding.lastScan.completedAt?.toISOString() ?? null,
            }
          : null,
        annotation,
        links: {
          nvd: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(finding.cveId)}`,
          githubAdvisory: `https://github.com/advisories?query=${encodeURIComponent(finding.cveId)}`,
        },
      };
    });

  if (args.sort.field === 'severity') {
    findings.sort((a, b) => {
      const severityDelta = severityRank[b.severity.toUpperCase()] - severityRank[a.severity.toUpperCase()];
      if (severityDelta !== 0) return args.sort.direction === 'desc' ? severityDelta : -severityDelta;
      const slaDelta = (b.slaState === 'overdue' ? 1 : 0) - (a.slaState === 'overdue' ? 1 : 0);
      if (slaDelta !== 0) return slaDelta;
      return b.ageDays - a.ageDays;
    });
  }

  const groupedProjects = projects.map((project) => {
    const projectFindings = findings.filter((finding) => finding.project.id === project.id);
    return {
      id: project.id,
      name: project.name,
      count: projectFindings.length,
      activeCount: projectFindings.filter((finding) => finding.status === 'active').length,
      criticalHighCount: projectFindings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').length,
    };
  }).filter((project) => project.count > 0);

  return {
    summary: {
      active: findings.filter((finding) => finding.status === 'active').length,
      criticalHigh: findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').length,
      overdueSla: findings.filter((finding) => finding.slaState === 'overdue').length,
      newlySeen: findings.filter((finding) => finding.ageDays < 7).length,
      mitigated: findings.filter((finding) => finding.status === 'mitigated').length,
    },
    projects: groupedProjects,
    projectOptions: projects,
    findings,
    total: findings.length,
  };
}

async function setProjectFindingAnnotation(rawArgs: unknown, context: any, state: 'accepted' | 'snoozed' | 'rejected' | 'active'): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(annotationSchema, rawArgs);
  const projectFinding = await prisma.projectFinding.findFirst({
    where: {
      id: args.projectFindingId,
      workspaceId: user.workspaceId,
    },
    select: { id: true },
  });

  if (!projectFinding) {
    throw new HttpError(404, 'Project finding not found');
  }

  if (state === 'active') {
    await prisma.projectFinding.update({
      where: { id: args.projectFindingId },
      data: { status: 'active' },
    });
    return { status: 'active' };
  }

  const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;
  const annotationState = state === 'snoozed' ? 'snoozed' : state;
  const annotation = await prisma.projectFindingAnnotation.create({
    data: {
      projectFindingId: args.projectFindingId,
      workspaceId: user.workspaceId,
      userId: user.id,
      state: annotationState,
      reason: args.reason,
      expiresAt,
    },
  });

  await prisma.projectFinding.update({
    where: { id: args.projectFindingId },
    data: { status: state },
  });

  return {
    status: state,
    annotation: {
      ...annotation,
      createdAt: annotation.createdAt.toISOString(),
      updatedAt: annotation.updatedAt.toISOString(),
      expiresAt: annotation.expiresAt?.toISOString() ?? null,
    },
  };
}

export function acceptProjectFinding(rawArgs: unknown, context: any): Promise<any> {
  return setProjectFindingAnnotation(rawArgs, context, 'accepted');
}

export function snoozeProjectFinding(rawArgs: unknown, context: any): Promise<any> {
  return setProjectFindingAnnotation(rawArgs, context, 'snoozed');
}

export function rejectProjectFinding(rawArgs: unknown, context: any): Promise<any> {
  return setProjectFindingAnnotation(rawArgs, context, 'rejected');
}

export function reopenProjectFinding(rawArgs: unknown, context: any): Promise<any> {
  return setProjectFindingAnnotation(rawArgs, context, 'active');
}
