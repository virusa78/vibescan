import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../wasp-app/node_modules/@prisma/client';
import { hashPassword } from '../wasp-app/node_modules/@wasp.sh/lib-auth/dist/node.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

const NUM_MONTHS = Number(process.env.DEMO_MONTHS || 6);
const RESET_DEMO_DATA = (process.env.RESET_DEMO_DATA || 'true') === 'true';
const CVE_PER_SCAN_MIN = 5;
const CVE_PER_SCAN_MAX = 20;

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const DEMO_USERS = [
  {
    email: 'arjun.mehta@finstack.io',
    password: 'vs_demo_pro_2026',
    name: 'Arjun Mehta',
    plan: 'pro',
    region: 'OTHER',
    quotaLimit: 100,
    scansPerMonth: { min: 50, max: 100 },
  },
  {
    email: 'priya.sharma@devcraft.in',
    password: 'vs_demo_starter_2026',
    name: 'Priya Sharma',
    plan: 'starter',
    region: 'IN',
    quotaLimit: 30,
    scansPerMonth: { min: 10, max: 30 },
  },
  {
    email: 'rafael.torres@securecorp.com',
    password: 'vs_demo_ent_2026',
    name: 'Rafael Torres',
    plan: 'enterprise',
    region: 'OTHER',
    quotaLimit: 200,
    scansPerMonth: { min: 30, max: 60 },
  },
];

const CVE_DATABASE: Array<{
  cveId: string;
  pkg: string;
  severity: Severity;
  cvss: number;
  description: string;
}> = [
  { cveId: 'CVE-2026-1001', pkg: 'lodash', severity: 'CRITICAL', cvss: 9.8, description: 'Prototype pollution in lodash' },
  { cveId: 'CVE-2026-1002', pkg: 'express', severity: 'HIGH', cvss: 8.1, description: 'Open redirect vulnerability in express' },
  { cveId: 'CVE-2026-1003', pkg: 'axios', severity: 'HIGH', cvss: 7.5, description: 'Server-side request forgery in axios' },
  { cveId: 'CVE-2026-1004', pkg: 'moment', severity: 'MEDIUM', cvss: 6.5, description: 'ReDoS vulnerability in moment' },
  { cveId: 'CVE-2026-1005', pkg: 'underscore', severity: 'HIGH', cvss: 8.0, description: 'Prototype pollution in underscore' },
  { cveId: 'CVE-2026-1006', pkg: 'minimist', severity: 'MEDIUM', cvss: 5.6, description: 'Prototype pollution in minimist' },
  { cveId: 'CVE-2026-1007', pkg: 'node-fetch', severity: 'HIGH', cvss: 7.7, description: 'Exposure of sensitive information' },
  { cveId: 'CVE-2026-1008', pkg: 'serialize-javascript', severity: 'CRITICAL', cvss: 9.1, description: 'Remote code execution' },
  { cveId: 'CVE-2026-1009', pkg: 'marked', severity: 'MEDIUM', cvss: 6.1, description: 'XSS vulnerability in marked' },
  { cveId: 'CVE-2026-1010', pkg: 'ua-parser-js', severity: 'LOW', cvss: 3.7, description: 'User agent spoofing' },
  { cveId: 'CVE-2026-1011', pkg: 'json5', severity: 'MEDIUM', cvss: 5.9, description: 'Arbitrary code execution' },
  { cveId: 'CVE-2026-1012', pkg: 'yargs', severity: 'LOW', cvss: 4.2, description: 'Command injection' },
  { cveId: 'CVE-2026-1013', pkg: 'tar', severity: 'HIGH', cvss: 8.3, description: 'Arbitrary file creation' },
  { cveId: 'CVE-2026-1014', pkg: 'node-pre-gyp', severity: 'CRITICAL', cvss: 9.5, description: 'Arbitrary file write' },
  { cveId: 'CVE-2026-1015', pkg: 'ini', severity: 'MEDIUM', cvss: 5.5, description: 'Prototype pollution' },
  { cveId: 'CVE-2026-1016', pkg: 'glob-parent', severity: 'HIGH', cvss: 7.5, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1017', pkg: 'hosted-git-info', severity: 'MEDIUM', cvss: 6.5, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1018', pkg: 'trim-newlines', severity: 'LOW', cvss: 3.3, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1019', pkg: 'y18n', severity: 'CRITICAL', cvss: 9.0, description: 'Prototype pollution' },
  { cveId: 'CVE-2026-1020', pkg: 'braces', severity: 'HIGH', cvss: 7.2, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1021', pkg: 'ws', severity: 'CRITICAL', cvss: 9.6, description: 'Remote code execution' },
  { cveId: 'CVE-2026-1022', pkg: 'nth-check', severity: 'MEDIUM', cvss: 5.8, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1023', pkg: 'follow-redirects', severity: 'HIGH', cvss: 7.8, description: 'Exposure of sensitive information' },
  { cveId: 'CVE-2026-1024', pkg: 'set-value', severity: 'LOW', cvss: 4.5, description: 'Prototype pollution' },
  { cveId: 'CVE-2026-1025', pkg: 'dot-prop', severity: 'MEDIUM', cvss: 5.4, description: 'Prototype pollution' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeVulnJson(cve: (typeof CVE_DATABASE)[number], installed: string, fixed: string | null) {
  return {
    id: `vuln-${uuidv4().substring(0, 8)}`,
    cve_id: cve.cveId,
    ghsa_id: null as string | null,
    severity: cve.severity,
    cvss_score: cve.cvss,
    package_name: cve.pkg,
    package_ecosystem: 'npm',
    installed_version: installed,
    fixed_version: fixed,
    purl: `pkg:npm/${cve.pkg}@${installed}`,
    epss_score: Math.random() * 0.5 + 0.1,
    is_exploitable: Math.random() > 0.7,
    description: cve.description,
    references: [`https://nvd.nist.gov/vuln/detail/${cve.cveId}`],
  };
}

function generateVulns(n: number) {
  const shuffled = [...CVE_DATABASE].sort(() => 0.5 - Math.random());
  const vulns = shuffled.slice(0, Math.min(n, shuffled.length)).map((cve) =>
    makeVulnJson(cve, `1.${randInt(0, 9)}.${randInt(0, 19)}`, `1.${randInt(0, 9)}.${randInt(20, 39)}`)
  );
  while (vulns.length < n) {
    const cve = pick(CVE_DATABASE);
    vulns.push(makeVulnJson(cve, `1.${randInt(0, 9)}.${randInt(0, 19)}`, null));
  }
  return vulns;
}

function computeDelta(freeVulns: ReturnType<typeof generateVulns>, entVulns: ReturnType<typeof generateVulns>) {
  const freeIds = new Set(freeVulns.map((v) => v.cve_id));
  const entIds = new Set(entVulns.map((v) => v.cve_id));
  const enterpriseOnly = entVulns.filter((v) => !freeIds.has(v.cve_id));
  const deltaBySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const v of enterpriseOnly) {
    const s = v.severity as string;
    deltaBySeverity[s] = (deltaBySeverity[s] || 0) + 1;
  }
  return {
    totalFreeCount: freeVulns.length,
    totalEnterpriseCount: entVulns.length,
    deltaCount: enterpriseOnly.length,
    deltaBySeverity,
  };
}

async function main() {
  console.log('Starting mock data generation (Prisma)...\n');

  for (const ud of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: ud.email } });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { plan: ud.plan, region: ud.region, displayName: ud.name, monthlyQuotaLimit: ud.quotaLimit },
      });
      console.log(`Upserted user: ${ud.email} (${ud.plan})`);
      continue;
    }

    const hashedPassword = await hashPassword(ud.password);
    const providerData = JSON.stringify({
      hashedPassword,
      isEmailVerified: true,
      emailVerificationSentAt: null,
      passwordResetSentAt: null,
    });

    await prisma.user.create({
      data: {
        email: ud.email,
        displayName: ud.name,
        username: ud.email.split('@')[0],
        plan: ud.plan,
        region: ud.region,
        monthlyQuotaLimit: ud.quotaLimit,
        subscriptionStatus: 'active',
        auth: {
          create: {
            identities: {
              create: {
                providerName: 'email',
                providerUserId: ud.email,
                providerData,
              },
            },
          },
        },
      },
    });
    console.log(`Created user: ${ud.email} (${ud.plan})`);
  }

  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_USERS.map((u) => u.email) } },
  });

  for (const user of users) {
    const profile = DEMO_USERS.find((p) => p.email === user.email)!;

    let org = await prisma.organization.findFirst({ where: { ownerUserId: user.id } });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: `${profile.name}'s Org`,
          slug: `${user.username ?? user.email.split('@')[0]}-org`,
          ownerUserId: user.id,
          isPersonal: true,
        },
      });
    }

    let team = await prisma.team.findFirst({ where: { organizationId: org.id } });
    if (!team) {
      team = await prisma.team.create({
        data: {
          organizationId: org.id,
          name: 'Default',
          slug: 'default',
          isDefault: true,
        },
      });
    }

    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: {},
      create: { organizationId: org.id, userId: user.id, role: 'owner' },
    });

    await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: {},
      create: { teamId: team.id, userId: user.id, role: 'maintainer' },
    });

    let workspace = await prisma.workspace.findFirst({ where: { organizationId: org.id } });
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          organizationId: org.id,
          teamId: team.id,
          name: `${profile.name}'s Workspace`,
          slug: `${user.username ?? user.email.split('@')[0]}-ws`,
          isPersonal: true,
          createdByUserId: user.id,
        },
      });
    }

    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: {},
      create: { workspaceId: workspace.id, userId: user.id, role: 'admin' },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { activeWorkspaceId: workspace.id },
    });

    console.log(`Org/Team/Workspace ready for ${user.email}`);

    if (RESET_DEMO_DATA) {
      const scanCount = await prisma.scan.deleteMany({ where: { userId: user.id } });
      await prisma.quotaLedger.deleteMany({ where: { userId: user.id } });
      console.log(`  Deleted ${scanCount.count} existing scans for reseed`);
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - NUM_MONTHS * 30 * 24 * 60 * 60 * 1000);
    const inputTypes = ['source_zip', 'github_app', 'sbom_upload', 'ci_plugin'];
    const repos = ['finstack/payments-api', 'finstack/auth-service', 'acme/corp-website', 'myorg/backend-service'];
    const branches = ['main', 'develop', 'feature/auth', 'hotfix/cve-2026-1234'];
    let totalScans = 0;

    for (let month = 0; month < NUM_MONTHS; month++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(monthDate.getMonth() + month);
      const numScans = randInt(profile.scansPerMonth.min, profile.scansPerMonth.max);
      console.log(`  Month ${month + 1}: ${numScans} scans`);

      for (let i = 0; i < numScans; i++) {
        const scanDate = new Date(monthDate);
        scanDate.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59));
        const completedAt = new Date(scanDate.getTime() + randInt(10000, 310000));
        const inputType = pick(inputTypes);
        const inputRef = `${pick(repos)}@${pick(branches)}`;
        const numVulns = randInt(CVE_PER_SCAN_MIN, CVE_PER_SCAN_MAX);
        const numComponents = randInt(20, 70);
        const components = Array.from({ length: numComponents }, (_, j) => ({
          name: `package-${j}`,
          version: `${randInt(0, 4)}.${randInt(0, 19)}.${randInt(0, 49)}`,
          purl: `pkg:npm/package-${j}@1.0.0`,
          type: 'library',
        }));

        const plannedSources: ScanSource[] =
          profile.plan === 'enterprise'
            ? ['grype', 'codescoring_johnny']
            : ['grype'];

        const scan = await prisma.scan.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            inputType,
            inputRef,
            components,
            status: 'done',
            planAtSubmission: profile.plan,
            plannedSources,
            createdAt: scanDate,
            completedAt,
          },
        });

        const freeVulns = generateVulns(numVulns);

        await prisma.scanResult.create({
          data: {
            scanId: scan.id,
            source: 'grype',
            rawOutput: { scanned_at: scanDate.toISOString() },
            vulnerabilities: freeVulns,
            scannerVersion: 'grype-0.72.0',
            cveDbTimestamp: new Date(),
            durationMs: randInt(5000, 35000),
          },
        });

        const entVulns = [...freeVulns];
        for (let e = 0; e < randInt(5, 15); e++) {
          const cve = pick(CVE_DATABASE);
          entVulns.push(makeVulnJson(cve, `1.${randInt(0, 9)}.${randInt(0, 19)}`, null));
        }

        if (profile.plan === 'enterprise') {
          await prisma.scanResult.create({
            data: {
              scanId: scan.id,
              source: 'codescoring_johnny',
              rawOutput: { scanned_at: scanDate.toISOString() },
              vulnerabilities: entVulns,
              scannerVersion: 'codescoring-2.1.0',
              cveDbTimestamp: new Date(),
              durationMs: randInt(20000, 80000),
            },
          });
        }

        const allVulns = profile.plan === 'enterprise' ? entVulns : freeVulns;
        const seenFingerprints = new Set<string>();
        for (const v of allVulns) {
          const fingerprint = crypto
            .createHash('sha256')
            .update(`${v.cve_id}:${v.package_name}:${v.installed_version}:`)
            .digest('hex');
          if (seenFingerprints.has(fingerprint)) continue;
          seenFingerprints.add(fingerprint);

          await prisma.finding.create({
            data: {
              scanId: scan.id,
              userId: user.id,
              fingerprint,
              cveId: v.cve_id,
              packageName: v.package_name,
              installedVersion: v.installed_version,
              severity: v.severity,
              cvssScore: v.cvss_score,
              fixedVersion: v.fixed_version,
              source: profile.plan === 'enterprise' && entVulns.includes(v)
                ? 'codescoring_johnny'
                : 'grype',
              description: v.description,
              detectedData: {
                purl: v.purl,
                epss_score: v.epss_score,
                is_exploitable: v.is_exploitable,
              },
            },
          });
        }

        const delta = computeDelta(freeVulns, entVulns);
        await prisma.scanDelta.create({
          data: {
            scanId: scan.id,
            totalFreeCount: delta.totalFreeCount,
            totalEnterpriseCount: delta.totalEnterpriseCount,
            deltaCount: delta.deltaCount,
            deltaBySeverity: delta.deltaBySeverity,
            isLocked: false,
          },
        });

        totalScans++;
        if (totalScans % 10 === 0) {
          console.log(`    Processed ${totalScans} scans...`);
        }
      }
    }

    await prisma.quotaLedger.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        action: 'monthly_reset',
        amount: profile.quotaLimit,
        reason: 'Demo seed',
        balanceBefore: 0,
        balanceAfter: profile.quotaLimit,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { monthlyQuotaUsed: 0, monthlyQuotaLimit: profile.quotaLimit, quotaResetDate: new Date() },
    });

    console.log(`Done for ${user.email}: ${totalScans} scans\n`);
  }

  console.log('Mock data generation complete!');
  console.log(`  ${NUM_MONTHS} months, ${DEMO_USERS.length} users, ~${DEMO_USERS.reduce((a, u) => a + ((u.scansPerMonth.min + u.scansPerMonth.max) / 2) * NUM_MONTHS, 0).toFixed(0)} total scans`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
