import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function run() {
  await prisma.$connect();
  const userId = 'test-user-' + uuidv4();
  const scanId = 'test-scan-' + uuidv4();

  // mock user and scan
  await prisma.user.create({ data: { id: userId, email: userId + '@test.com', password: 'abc' } });
  await prisma.scan.create({ data: { id: scanId, userId, status: 'done', inputType: 'sbom', inputRef: 'abc' } });

  const normalizedFindings = Array.from({ length: 500 }).map((_, i) => ({
    cveId: `CVE-2024-${1000 + i}`,
    package: `pkg-${i}`,
    version: '1.0.0',
    severity: 'high',
    cvssScore: 7.5,
    fixedVersion: '1.0.1',
    description: 'test'
  }));

  const start = Date.now();

  for (const finding of normalizedFindings) {
      const fingerprint = `${finding.cveId}|${finding.package}|${finding.version}`;

      await prisma.finding.upsert({
        where: {
          scanId_fingerprint: {
            scanId,
            fingerprint,
          },
        },
        create: {
          scanId,
          userId,
          fingerprint,
          cveId: finding.cveId,
          packageName: finding.package,
          installedVersion: finding.version,
          severity: finding.severity.toUpperCase(),
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          source: 'free',
          detectedData: finding as any,
        },
        update: {
          severity: finding.severity.toUpperCase(),
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
        },
      });
  }

  const duration = Date.now() - start;
  console.log(`N+1 Sequential: ${duration}ms`);

  // Clean up
  await prisma.finding.deleteMany({ where: { scanId } });
  await prisma.scan.delete({ where: { id: scanId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
}

run().catch(console.error);
