/**
 * Seed Demo Scan Data
 * 
 * Creates 6 months of mock scan data for 3 demo users.
 * Each user has different scan volumes based on their plan.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Demo users and their scan volumes
const DEMO_USERS_DATA = [
  {
    email: 'arjun.mehta@finstack.io',
    plan: 'pro',
    scansPerMonth: { min: 50, max: 100 }
  },
  {
    email: 'priya.sharma@devcraft.in',
    plan: 'starter',
    scansPerMonth: { min: 10, max: 30 }
  },
  {
    email: 'rafael.torres@securecorp.com',
    plan: 'enterprise',
    scansPerMonth: { min: 30, max: 60 }
  }
];

// CVE database for generating mock findings
const CVE_DATABASE = [
  { cveId: 'CVE-2026-1001', package: 'lodash', severity: 'critical', cvss: 9.8 },
  { cveId: 'CVE-2026-1002', package: 'express', severity: 'high', cvss: 8.1 },
  { cveId: 'CVE-2026-1003', package: 'axios', severity: 'high', cvss: 7.5 },
  { cveId: 'CVE-2026-1004', package: 'moment', severity: 'medium', cvss: 6.5 },
  { cveId: 'CVE-2026-1005', package: 'underscore', severity: 'high', cvss: 8.0 },
  { cveId: 'CVE-2026-1006', package: 'minimist', severity: 'medium', cvss: 5.6 },
  { cveId: 'CVE-2026-1007', package: 'node-fetch', severity: 'high', cvss: 7.7 },
  { cveId: 'CVE-2026-1008', package: 'serialize-javascript', severity: 'critical', cvss: 9.1 },
  { cveId: 'CVE-2026-1009', package: 'marked', severity: 'medium', cvss: 6.1 },
  { cveId: 'CVE-2026-1010', package: 'ua-parser-js', severity: 'low', cvss: 3.7 },
  { cveId: 'CVE-2026-1011', package: 'json5', severity: 'medium', cvss: 5.9 },
  { cveId: 'CVE-2026-1012', package: 'yargs', severity: 'low', cvss: 4.2 },
  { cveId: 'CVE-2026-1013', package: 'tar', severity: 'high', cvss: 8.3 },
  { cveId: 'CVE-2026-1014', package: 'node-pre-gyp', severity: 'critical', cvss: 9.5 },
  { cveId: 'CVE-2026-1015', package: 'ini', severity: 'medium', cvss: 5.5 },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateFingerprint(cveId, packageName, version) {
  return crypto
    .createHash('sha256')
    .update(`${cveId}:${packageName}:${version}`)
    .digest('hex');
}

function getRandomFindings(count = 5) {
  const findings = [];
  const usedCves = new Set();
  
  while (findings.length < count && usedCves.size < CVE_DATABASE.length) {
    const cve = getRandomItem(CVE_DATABASE);
    if (!usedCves.has(cve.cveId)) {
      usedCves.add(cve.cveId);
      findings.push({
        cveId: cve.cveId,
        package: cve.package,
        severity: cve.severity,
        cvssScore: cve.cvss,
        description: `${cve.cveId}: Vulnerability in ${cve.package}`,
        source: 'grype'
      });
    }
  }
  return findings;
}

async function main() {
  console.log('🌱 Seeding demo scan data...\n');

  for (const userData of DEMO_USERS_DATA) {
    try {
      // Get user by email
      const user = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!user) {
        console.log(`⚠️  User ${userData.email} not found, skipping scans`);
        continue;
      }

      // Generate scans for past 6 months
      const months = 6;
      const now = new Date();
      let scanCount = 0;

      for (let month = 0; month < months; month++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - month, 1);
        const scansThisMonth = randomInt(userData.scansPerMonth.min, userData.scansPerMonth.max);

        for (let i = 0; i < scansThisMonth; i++) {
          // Random day in the month
          const day = randomInt(1, 28);
          const scanDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
          
          // Create scan
          const scan = await prisma.scan.create({
            data: {
              userId: user.id,
              status: 'done',
              inputType: 'source_zip',
              inputRef: `demo-scan-${scanCount}.zip`,
              planAtSubmission: userData.plan === 'pro' ? 'pro' : userData.plan === 'starter' ? 'starter' : 'enterprise',
              plannedSources: ['grype'],
              createdAt: scanDate,
              completedAt: scanDate
            }
          });

          // Create some findings for this scan
          const findingCount = randomInt(5, 15);
          const findings = getRandomFindings(findingCount);

          for (const finding of findings) {
            const fingerprint = generateFingerprint(finding.cveId, finding.package, '1.0.0');
            await prisma.finding.create({
              data: {
                scanId: scan.id,
                userId: user.id,
                fingerprint: fingerprint,
                cveId: finding.cveId,
                severity: finding.severity,
                packageName: finding.package,
                installedVersion: '1.0.0',
                cvssScore: finding.cvssScore,
                description: finding.description,
                source: finding.source
              }
            });
          }

          scanCount++;
        }
      }

      // Update monthly quota used
      await prisma.user.update({
        where: { id: user.id },
        data: { monthlyQuotaUsed: scanCount }
      });

      console.log(`✅ ${userData.email} (${userData.plan})`);
      console.log(`   Created ${scanCount} scans (${userData.scansPerMonth.min}-${userData.scansPerMonth.max}/month)`);

    } catch (e) {
      console.log(`❌ ${userData.email}: ${e.message}`);
    }
  }

  console.log('\n✅ Done!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
