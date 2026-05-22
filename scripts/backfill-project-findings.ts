import { PrismaClient } from '../wasp-app/node_modules/@prisma/client';
import {
  calculateSlaDueAt,
  calculateSlaState,
  resolveProjectForScanInput,
} from '../wasp-app/src/server/services/projectFindingLifecycleService';

const prisma = new PrismaClient();

async function main() {
  const scans = await prisma.scan.findMany({
    where: {
      workspaceId: { not: null },
    },
    orderBy: [
      { completedAt: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      findings: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  for (const scan of scans) {
    if (!scan.workspaceId) continue;
    const project = scan.projectId
      ? { id: scan.projectId }
      : await resolveProjectForScanInput(prisma as any, {
          workspaceId: scan.workspaceId,
          inputType: scan.inputType,
          inputRef: scan.inputRef,
        });

    if (!scan.projectId) {
      await prisma.scan.update({
        where: { id: scan.id },
        data: { projectId: project.id },
      });
    }

    const detectedAt = scan.completedAt ?? scan.createdAt;
    const seenFingerprints = new Set<string>();

    for (const finding of scan.findings) {
      seenFingerprints.add(finding.fingerprint);
      const existing = await prisma.projectFinding.findUnique({
        where: {
          projectId_fingerprint: {
            projectId: project.id,
            fingerprint: finding.fingerprint,
          },
        },
      });

      if (!existing) {
        const slaDueAt = calculateSlaDueAt(finding.severity, detectedAt);
        await prisma.projectFinding.create({
          data: {
            workspaceId: scan.workspaceId,
            projectId: project.id,
            fingerprint: finding.fingerprint,
            cveId: finding.cveId,
            packageName: finding.packageName,
            installedVersion: finding.installedVersion,
            filePath: finding.filePath,
            severity: finding.severity,
            cvssScore: finding.cvssScore,
            fixedVersion: finding.fixedVersion,
            description: finding.description,
            status: finding.status === 'mitigated' ? 'mitigated' : 'active',
            firstSeenAt: detectedAt,
            lastSeenAt: detectedAt,
            lastDetectedAt: detectedAt,
            lastScanId: scan.id,
            lastMitigatedAt: finding.mitigatedAt,
            scanCount: 1,
            reportedBy: [finding.source],
            firstDetectedBy: finding.source,
            lastDetectedBy: finding.source,
            slaDueAt,
            slaState: calculateSlaState(slaDueAt, detectedAt),
          },
        });
        continue;
      }

      const reportedBy = Array.from(new Set([...existing.reportedBy, finding.source])).sort();
      const slaDueAt = calculateSlaDueAt(finding.severity, existing.firstSeenAt);
      await prisma.projectFinding.update({
        where: { id: existing.id },
        data: {
          cveId: finding.cveId,
          packageName: finding.packageName,
          installedVersion: finding.installedVersion,
          filePath: finding.filePath,
          severity: finding.severity,
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          status: existing.status === 'mitigated' ? 'active' : existing.status,
          lastSeenAt: detectedAt,
          lastDetectedAt: detectedAt,
          lastScanId: scan.id,
          reopenedAt: existing.status === 'mitigated' ? detectedAt : existing.reopenedAt,
          scanCount: existing.lastScanId === scan.id ? existing.scanCount : existing.scanCount + 1,
          reportedBy,
          lastDetectedBy: finding.source,
          slaDueAt,
          slaState: calculateSlaState(slaDueAt, detectedAt),
        },
      });
    }

    await prisma.projectFinding.updateMany({
      where: {
        workspaceId: scan.workspaceId,
        projectId: project.id,
        status: { not: 'mitigated' },
        ...(seenFingerprints.size > 0 ? { fingerprint: { notIn: Array.from(seenFingerprints) } } : {}),
      },
      data: {
        status: 'mitigated',
        lastMitigatedAt: detectedAt,
        slaState: 'none',
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
