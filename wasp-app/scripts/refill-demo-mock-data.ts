import { PrismaClient, PlanTier, ScanSource, ScanStatus } from '@prisma/client';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

type DemoUserSeed = {
  email: string;
  displayName: string;
  plan: PlanTier;
  region: string;
  scansPerMonth: { min: number; max: number };
};

type Vuln = {
  cve_id: string;
  severity: Severity;
  package_name: string;
  installed_version: string;
  fixed_version: string | null;
  description: string;
  purl: string;
  cvss_score: number;
};

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: 'arjun.mehta@finstack.io',
    displayName: 'Arjun Mehta',
    plan: 'pro',
    region: 'OTHER',
    scansPerMonth: { min: 50, max: 90 },
  },
  {
    email: 'priya.sharma@devcraft.in',
    displayName: 'Priya Sharma',
    plan: 'starter',
    region: 'IN',
    scansPerMonth: { min: 12, max: 30 },
  },
  {
    email: 'rafael.torres@securecorp.com',
    displayName: 'Rafael Torres',
    plan: 'enterprise',
    region: 'OTHER',
    scansPerMonth: { min: 35, max: 65 },
  },
];

const CVE_POOL = [
  ['CVE-2026-4001', 'lodash', 'Prototype pollution in lodash', 9.1],
  ['CVE-2026-4002', 'express', 'Path traversal in middleware chain', 8.2],
  ['CVE-2026-4003', 'axios', 'SSRF via redirect handling', 7.8],
  ['CVE-2026-4004', 'ws', 'Remote code execution via crafted frame', 9.6],
  ['CVE-2026-4005', 'tar', 'Arbitrary file write during extraction', 8.7],
  ['CVE-2026-4006', 'minimist', 'Prototype pollution in option parsing', 5.6],
  ['CVE-2026-4007', 'node-fetch', 'Sensitive data exposure in redirects', 7.2],
  ['CVE-2026-4008', 'serialize-javascript', 'XSS through unsafe serialization', 8.4],
  ['CVE-2026-4009', 'json5', 'Arbitrary code execution with malformed payload', 7.0],
  ['CVE-2026-4010', 'glob-parent', 'ReDoS in glob matching', 6.4],
  ['CVE-2026-4011', 'yargs', 'Command injection in parser edge case', 6.8],
  ['CVE-2026-4012', 'follow-redirects', 'Credential leak in redirect chain', 7.9],
] as const;

const INPUT_TYPES = ['source_zip', 'github_app', 'sbom_upload', 'ci_plugin'] as const;
const REPOS = [
  'finstack/payments-api',
  'devcraft/edge-gateway',
  'securecorp/platform-core',
  'vibescan/demo-repo',
  'acme/internal-service',
];
const BRANCHES = ['main', 'develop', 'release/2026.04', 'feature/zero-trust'];

function toSeverity(cvss: number): Severity {
  if (cvss >= 9) return 'CRITICAL';
  if (cvss >= 7) return 'HIGH';
  if (cvss >= 4) return 'MEDIUM';
  if (cvss >= 1) return 'LOW';
  return 'INFO';
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomVersion(): string {
  return `${randomInt(0, 4)}.${randomInt(0, 20)}.${randomInt(0, 40)}`;
}

function fingerprint(v: Vuln): string {
  return `${v.cve_id}:${v.package_name}:${v.installed_version}`;
}

function generateVulns(count: number): Vuln[] {
  const out: Vuln[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = pickOne([...CVE_POOL]);
    const cvss = row[3] + Math.random() * 0.5 - 0.25;
    out.push({
      cve_id: row[0],
      package_name: row[1],
      description: row[2],
      cvss_score: Number(Math.max(0, Math.min(10, cvss)).toFixed(1)),
      severity: toSeverity(cvss),
      installed_version: randomVersion(),
      fixed_version: Math.random() > 0.25 ? randomVersion() : null,
      purl: `pkg:npm/${row[1]}@${randomVersion()}`,
    });
  }
  return out;
}

function computeDeltaBySeverity(freeVulns: Vuln[], enterpriseVulns: Vuln[]) {
  const freeSet = new Set(freeVulns.map(fingerprint));
  const deltaVulns = enterpriseVulns.filter((v) => !freeSet.has(fingerprint(v)));
  const deltaBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const vuln of deltaVulns) {
    const key = vuln.severity.toLowerCase();
    deltaBySeverity[key] = (deltaBySeverity[key] ?? 0) + 1;
  }

  return { deltaVulns, deltaBySeverity };
}

function makeComponents() {
  const total = randomInt(20, 70);
  return Array.from({ length: total }, (_, i) => ({
    name: `component-${i + 1}`,
    version: randomVersion(),
    purl: `pkg:npm/component-${i + 1}@${randomVersion()}`,
    type: 'library',
  }));
}

function planQuota(plan: PlanTier): number {
  if (plan === 'enterprise') return 1000;
  if (plan === 'pro') return 100;
  if (plan === 'starter') return 30;
  return 10;
}

async function ensureDemoUsers(prisma: PrismaClient) {
  const existing = await prisma.user.findMany({
    where: { email: { in: DEMO_USERS.map((u) => u.email) } },
    select: { id: true, email: true },
  });
  const existingByEmail = new Map(existing.map((u) => [u.email, u.id]));

  for (const demo of DEMO_USERS) {
    if (!existingByEmail.has(demo.email)) {
      const created = await prisma.user.create({
        data: {
          email: demo.email,
          username: demo.email,
          displayName: demo.displayName,
          plan: demo.plan,
          region: demo.region,
          language: 'en',
          monthlyQuotaLimit: planQuota(demo.plan),
          monthlyQuotaUsed: 0,
        },
        select: { id: true },
      });
      existingByEmail.set(demo.email, created.id);
      console.log(`+ created missing demo user ${demo.email}`);
    }
  }

  return existingByEmail;
}

async function cleanupUserData(prisma: PrismaClient, userIds: string[]) {
  await prisma.apiKey.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.projectNotificationSetting.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.webhook.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.quotaLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.remediationPromptUsage.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.aiFixPrompt.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.vulnAcceptance.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.finding.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.scan.deleteMany({ where: { userId: { in: userIds } } });
}

async function seedScans(prisma: PrismaClient, userId: string, profile: DemoUserSeed, months: number) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));

  let inserted = 0;

  for (let m = 0; m < months; m += 1) {
    const monthStart = new Date(start);
    monthStart.setUTCMonth(start.getUTCMonth() + m);

    const scansCount = randomInt(profile.scansPerMonth.min, profile.scansPerMonth.max);

    for (let i = 0; i < scansCount; i += 1) {
      const scanStartedAt = new Date(monthStart);
      scanStartedAt.setUTCDate(randomInt(1, 28));
      scanStartedAt.setUTCHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59), 0);
      const completedAt = new Date(scanStartedAt.getTime() + randomInt(30, 240) * 1000);

      const freeVulns = generateVulns(randomInt(5, 16));
      const enterpriseOnly = generateVulns(randomInt(2, 10));
      const enterpriseVulns = [...freeVulns, ...enterpriseOnly];
      const { deltaVulns, deltaBySeverity } = computeDeltaBySeverity(freeVulns, enterpriseVulns);

      const scan = await prisma.scan.create({
        data: {
          userId,
          inputType: pickOne([...INPUT_TYPES]),
          inputRef: `${pickOne([...REPOS])}@${pickOne([...BRANCHES])}`,
          sbomRaw: null,
          components: makeComponents(),
          status: ScanStatus.done,
          planAtSubmission: profile.plan,
          createdAt: scanStartedAt,
          completedAt,
        },
        select: { id: true },
      });

      await prisma.scanResult.createMany({
        data: [
          {
            scanId: scan.id,
            source: ScanSource.free,
            rawOutput: { scanned_at: scanStartedAt.toISOString(), source: 'grype' },
            vulnerabilities: freeVulns,
            scannerVersion: 'grype-0.79.1',
            cveDbTimestamp: completedAt,
            durationMs: randomInt(4000, 25000),
            createdAt: completedAt,
          },
          {
            scanId: scan.id,
            source: ScanSource.enterprise,
            rawOutput: { scanned_at: scanStartedAt.toISOString(), source: 'codescoring' },
            vulnerabilities: enterpriseVulns,
            scannerVersion: 'codescoring-2.2.0',
            cveDbTimestamp: completedAt,
            durationMs: randomInt(15000, 70000),
            createdAt: completedAt,
          },
        ],
      });

      await prisma.scanDelta.create({
        data: {
          scanId: scan.id,
          totalFreeCount: freeVulns.length,
          totalEnterpriseCount: enterpriseVulns.length,
          deltaCount: deltaVulns.length,
          deltaBySeverity,
          deltaVulnerabilities: deltaVulns,
          isLocked: false,
          reimportSummary: {
            new_count: freeVulns.length,
            mitigated_count: 0,
            updated_count: 0,
            unchanged_count: 0,
          },
          createdAt: completedAt,
        },
      });

      inserted += 1;
    }
  }

  return inserted;
}

async function main() {
  const prisma = new PrismaClient();
  const months = Number(process.env.DEMO_MONTHS ?? '6');

  console.log(`Refilling demo data for ${DEMO_USERS.length} users, months=${months}`);

  const userByEmail = await ensureDemoUsers(prisma);
  const userIds = DEMO_USERS.map((u) => userByEmail.get(u.email)).filter(Boolean) as string[];

  await cleanupUserData(prisma, userIds);
  console.log(`- cleaned existing data for ${userIds.length} demo users (users kept)`);

  let totalScans = 0;
  for (const profile of DEMO_USERS) {
    const userId = userByEmail.get(profile.email);
    if (!userId) continue;
    const seeded = await seedScans(prisma, userId, profile, months);
    totalScans += seeded;

    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: profile.displayName,
        plan: profile.plan,
        region: profile.region,
        monthlyQuotaLimit: planQuota(profile.plan),
        monthlyQuotaUsed: 0,
        quotaResetDate: new Date(),
      },
    });

    console.log(`+ ${profile.email}: ${seeded} scans`);
  }

  const counts = await prisma.scan.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds } },
    _count: { _all: true },
  });
  const countByUser = new Map(counts.map((c) => [c.userId, c._count._all]));

  console.log('\nSummary');
  for (const profile of DEMO_USERS) {
    const userId = userByEmail.get(profile.email);
    const scans = userId ? (countByUser.get(userId) ?? 0) : 0;
    console.log(`  ${profile.email}: ${scans} scans`);
  }
  console.log(`  total: ${totalScans} scans`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
