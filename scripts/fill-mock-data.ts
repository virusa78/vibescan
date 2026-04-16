/**
 * Fill Database with Mock Data
 *
 * Generates 6 months of mock data for 3 demo users:
 * - arjun.mehta@finstack.io (Pro User) - 50-100 scans/month, enterprise plan
 * - priya.sharma@devcraft.in (Starter) - 10-30 scans/month, starter plan
 * - rafael.torres@securecorp.com (Enterprise) - 30-60 scans/month, enterprise plan
 *
 * Each scan contains 5-20 CVEs with varying severity levels
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { getPool } from '../src/database/client.js';
import config from '../src/config/index.js';
import { computeDelta } from '../src/services/diffEngine.js';

// Constants
const BCRYPT_ROUNDS = 10;
const NUM_MONTHS = Number(process.env.DEMO_MONTHS || 6);
const RESET_DEMO_DATA = (process.env.RESET_DEMO_DATA || 'true') === 'true';
const CVE_PER_SCAN_MIN = 5;
const CVE_PER_SCAN_MAX = 20;

// Demo users data
const DEMO_USERS = [
  {
    email: 'arjun.mehta@finstack.io',
    password: 'vs_demo_pro_2026',
    name: 'Arjun Mehta',
    plan: 'pro',
    region: 'OTHER',
    scansPerMonth: { min: 50, max: 100 }
  },
  {
    email: 'priya.sharma@devcraft.in',
    password: 'vs_demo_starter_2026',
    name: 'Priya Sharma',
    plan: 'starter',
    region: 'IN',
    scansPerMonth: { min: 10, max: 30 }
  },
  {
    email: 'rafael.torres@securecorp.com',
    password: 'vs_demo_ent_2026',
    name: 'Rafael Torres',
    plan: 'enterprise',
    region: 'OTHER',
    scansPerMonth: { min: 30, max: 60 }
  }
];

// CVE database for mock data
const CVE_DATABASE = [
  { cveId: 'CVE-2026-1001', package: 'lodash', severity: 'CRITICAL', cvss: 9.8, description: 'Prototype pollution in lodash' },
  { cveId: 'CVE-2026-1002', package: 'express', severity: 'HIGH', cvss: 8.1, description: 'Open redirect vulnerability in express' },
  { cveId: 'CVE-2026-1003', package: 'axios', severity: 'HIGH', cvss: 7.5, description: 'Server-side request forgery in axios' },
  { cveId: 'CVE-2026-1004', package: 'moment', severity: 'MEDIUM', cvss: 6.5, description: 'ReDoS vulnerability in moment' },
  { cveId: 'CVE-2026-1005', package: 'underscore', severity: 'HIGH', cvss: 8.0, description: 'Prototype pollution in underscore' },
  { cveId: 'CVE-2026-1006', package: 'minimist', severity: 'MEDIUM', cvss: 5.6, description: 'Prototype pollution in minimist' },
  { cveId: 'CVE-2026-1007', package: 'node-fetch', severity: 'HIGH', cvss: 7.7, description: 'Exposure of sensitive information' },
  { cveId: 'CVE-2026-1008', package: 'serialize-javascript', severity: 'CRITICAL', cvss: 9.1, description: 'Remote code execution' },
  { cveId: 'CVE-2026-1009', package: 'marked', severity: 'MEDIUM', cvss: 6.1, description: 'XSS vulnerability in marked' },
  { cveId: 'CVE-2026-1010', package: 'ua-parser-js', severity: 'LOW', cvss: 3.7, description: 'User agent spoofing' },
  { cveId: 'CVE-2026-1011', package: 'json5', severity: 'MEDIUM', cvss: 5.9, description: 'Arbitrary code execution' },
  { cveId: 'CVE-2026-1012', package: 'yargs', severity: 'LOW', cvss: 4.2, description: 'Command injection' },
  { cveId: 'CVE-2026-1013', package: 'tar', severity: 'HIGH', cvss: 8.3, description: 'Arbitrary file creation' },
  { cveId: 'CVE-2026-1014', package: 'node-pre-gyp', severity: 'CRITICAL', cvss: 9.5, description: 'Arbitrary file write' },
  { cveId: 'CVE-2026-1015', package: 'ini', severity: 'MEDIUM', cvss: 5.5, description: 'Prototype pollution' },
  { cveId: 'CVE-2026-1016', package: 'glob-parent', severity: 'HIGH', cvss: 7.5, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1017', package: 'hosted-git-info', severity: 'MEDIUM', cvss: 6.5, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1018', package: 'trim-newlines', severity: 'LOW', cvss: 3.3, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1019', package: 'y18n', severity: 'CRITICAL', cvss: 9.0, description: 'Prototype pollution' },
  { cveId: 'CVE-2026-1020', package: 'braces', severity: 'HIGH', cvss: 7.2, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1021', package: 'ws', severity: 'CRITICAL', cvss: 9.6, description: 'Remote code execution' },
  { cveId: 'CVE-2026-1022', package: 'nth-check', severity: 'MEDIUM', cvss: 5.8, description: 'ReDoS vulnerability' },
  { cveId: 'CVE-2026-1023', package: 'follow-redirects', severity: 'HIGH', cvss: 7.8, description: 'Exposure of sensitive information' },
  { cveId: 'CVE-2026-1024', package: 'set-value', severity: 'LOW', cvss: 4.5, description: 'Prototype pollution' },
  { cveId: 'CVE-2026-1025', package: 'dot-prop', severity: 'MEDIUM', cvss: 5.4, description: 'Prototype pollution' },
];

// Severity breakdown for realistic data
function getSeverityBreakdown(numVulns: number) {
  const breakdown = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let remaining = numVulns;

  // Distribute CVEs based on realistic patterns
  const critical = Math.floor(numVulns * 0.15);
  const high = Math.floor(numVulns * 0.35);
  const medium = Math.floor(numVulns * 0.35);
  const low = numVulns - critical - high - medium;

  breakdown.CRITICAL = critical;
  breakdown.HIGH = high;
  breakdown.MEDIUM = medium;
  breakdown.LOW = low;

  return breakdown;
}

function generateVulnerabilities(numVulns: number): any[] {
  const vulns: any[] = [];
  const selectedCves = [...CVE_DATABASE].sort(() => 0.5 - Math.random()).slice(0, Math.min(numVulns, CVE_DATABASE.length));
  const breakdown = getSeverityBreakdown(numVulns);

  selectedCves.forEach((cve, i) => {
    vulns.push({
      id: `vuln-${uuidv4().substring(0, 8)}`,
      cve_id: cve.cveId,
      ghsa_id: null,
      severity: cve.severity,
      cvss_score: cve.cvss,
      package_name: cve.package,
      package_ecosystem: 'npm' as const,
      installed_version: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
      fixed_version: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20) + 20}`,
      purl: `pkg:npm/${cve.package}@1.0.0`,
      epss_score: Math.random() * 0.5 + 0.1,
      is_exploitable: Math.random() > 0.7,
      description: cve.description,
      references: [`https://nvd.nist.gov/vuln/detail/${cve.cveId}`]
    });
  });

  // Add some additional CVEs to reach the target count
  while (vulns.length < numVulns) {
    const extraCve = CVE_DATABASE[Math.floor(Math.random() * CVE_DATABASE.length)];
    vulns.push({
      id: `vuln-${uuidv4().substring(0, 8)}`,
      cve_id: extraCve.cveId,
      ghsa_id: null,
      severity: extraCve.severity,
      cvss_score: extraCve.cvss,
      package_name: extraCve.package,
      package_ecosystem: 'npm' as const,
      installed_version: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
      fixed_version: null,
      purl: `pkg:npm/${extraCve.package}@1.0.0`,
      epss_score: Math.random() * 0.5,
      is_exploitable: Math.random() > 0.8,
      description: extraCve.description,
      references: [`https://nvd.nist.gov/vuln/detail/${extraCve.cveId}`]
    });
  }

  return vulns;
}

async function main() {
  console.log('Starting mock data generation...\n');

  const pool = getPool();

  // Create or update demo users
  for (const userData of DEMO_USERS) {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);

    try {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, plan, region, stripe_customer_id_encrypted)
         VALUES ($1, $2, $3, $4, $5, pgp_sym_encrypt($6, $7))
         ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         plan = EXCLUDED.plan,
         region = EXCLUDED.region
         RETURNING id`,
        [userId, userData.email, passwordHash, userData.plan, userData.region, `cus_${uuidv4().substring(0, 24)}`, config.ENCRYPTION_KEY]
      );
      console.log(`✓ Upserted user: ${userData.email} (${userData.plan})`);
    } catch (error) {
      console.error(`✗ Failed to create user ${userData.email}:`, error);
    }
  }

  // Get user IDs
  const usersResult = await pool.query('SELECT id, email, plan FROM users WHERE email IN ($1, $2, $3)',
    [DEMO_USERS[0].email, DEMO_USERS[1].email, DEMO_USERS[2].email]
  );
  const users = usersResult.rows;

  if (RESET_DEMO_DATA) {
    const userIds = users.map((u: { id: string }) => u.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM scans WHERE user_id = ANY($1::uuid[])', [userIds]);
      await pool.query('DELETE FROM quota_ledger WHERE user_id = ANY($1::uuid[])', [userIds]);
      console.log('✓ Existing demo scan/quota data deleted before reseed');
    }
  }

  // Generate mock data for each user
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - NUM_MONTHS * 30 * 24 * 60 * 60 * 1000);

  for (const user of users) {
    console.log(`\nGenerating data for ${user.email} (${user.plan})...`);

    const userProfile = DEMO_USERS.find((profile) => profile.email === user.email);
    const minScans = userProfile?.scansPerMonth.min ?? 10;
    const maxScans = userProfile?.scansPerMonth.max ?? 30;

    for (let month = 0; month < NUM_MONTHS; month++) {
      const monthDate = new Date(sixMonthsAgo);
      monthDate.setMonth(monthDate.getMonth() + month);

      // Random number of scans for this month
      const numScans = Math.floor(Math.random() * (maxScans - minScans + 1)) + minScans;

      console.log(`  Month ${month + 1}: ${numScans} scans`);

      for (let i = 0; i < numScans; i++) {
        const scanId = uuidv4();
        const scanDate = new Date(monthDate);
        scanDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

        // Random input type
        const inputTypes = ['source_zip', 'github_app', 'sbom_upload', 'ci_plugin'];
        const inputType = inputTypes[Math.floor(Math.random() * inputTypes.length)];

        // Generate input ref
        const repos = ['finstack/payments-api', 'finstack/auth-service', 'acme/corp-website', 'myorg/backend-service'];
        const branches = ['main', 'develop', 'feature/auth', 'hotfix/cve-2026-1234'];
        const inputRef = `${repos[Math.floor(Math.random() * repos.length)]}@${branches[Math.floor(Math.random() * branches.length)]}`;

        // Number of CVEs in this scan
        const numVulns = Math.floor(Math.random() * (CVE_PER_SCAN_MAX - CVE_PER_SCAN_MIN + 1)) + CVE_PER_SCAN_MIN;

        // Generate components
        const numComponents = Math.floor(Math.random() * 50) + 20;
        const components = Array.from({ length: numComponents }, (_, j) => ({
          name: `package-${j}`,
          version: `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 50)}`,
          purl: `pkg:npm/package-${j}@1.0.0`,
          type: 'library' as const
        }));

        // Insert scan
        await pool.query(
          `INSERT INTO scans (id, user_id, input_type, input_ref, sbom_raw, components, status, plan_at_submission, created_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            scanId,
            user.id,
            inputType,
            inputRef,
            null,
            JSON.stringify(components),
            'done',
            user.plan,
            scanDate.toISOString(),
            new Date(scanDate.getTime() + Math.floor(Math.random() * 300000) + 10000).toISOString() // 10-310 seconds later
          ]
        );

        // Generate vulnerabilities
        const vulns = generateVulnerabilities(numVulns);

        // Insert free scanner result
        await pool.query(
          `INSERT INTO scan_results (scan_id, source, raw_output, vulnerabilities, scanner_version, cve_db_timestamp, duration_ms)
           VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)`,
          [
            scanId,
            'free',
            JSON.stringify({ scanned_at: scanDate.toISOString() }),
            JSON.stringify(vulns),
            'grype-0.72.0',
            new Date().toISOString(),
            Math.floor(Math.random() * 30000) + 5000 // 5-35 seconds
          ]
        );

        // Insert enterprise scanner result (with more vulnerabilities)
        const enterpriseVulns = [...vulns];
        // Add some enterprise-only CVEs
        const numEnterpriseOnly = Math.floor(Math.random() * 10) + 5;
        for (let i = 0; i < numEnterpriseOnly; i++) {
          const cve = CVE_DATABASE[Math.floor(Math.random() * CVE_DATABASE.length)];
          enterpriseVulns.push({
            id: `enterprise-vuln-${uuidv4().substring(0, 8)}`,
            cve_id: cve.cveId,
            ghsa_id: null,
            severity: cve.severity,
            cvss_score: cve.cvss,
            package_name: cve.package,
            package_ecosystem: 'npm' as const,
            installed_version: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
            fixed_version: null,
            purl: `pkg:npm/${cve.package}@1.0.0`,
            epss_score: Math.random() * 0.5,
            is_exploitable: true,
            description: cve.description,
            references: [`https://nvd.nist.gov/vuln/detail/${cve.cveId}`]
          });
        }

        await pool.query(
          `INSERT INTO scan_results (scan_id, source, raw_output, vulnerabilities, scanner_version, cve_db_timestamp, duration_ms)
           VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)`,
          [
            scanId,
            'enterprise',
            JSON.stringify({ scanned_at: scanDate.toISOString() }),
            JSON.stringify(enterpriseVulns),
            'codescoring-2.1.0',
            new Date().toISOString(),
            Math.floor(Math.random() * 60000) + 20000 // 20-80 seconds
          ]
        );

        // Insert delta record using the shared diff engine
        const delta = computeDelta(vulns, enterpriseVulns);

        // Lock enterprise-only findings for starter plan
        const isLocked = user.plan === 'starter' || user.plan === 'free_trial';

        await pool.query(
          `INSERT INTO scan_deltas (scan_id, total_free_count, total_enterprise_count, delta_count, delta_by_severity, is_locked)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            scanId,
            delta.totalFreeCount,
            delta.totalEnterpriseCount,
            delta.deltaCount,
            JSON.stringify(delta.deltaBySeverity),
            isLocked
          ]
        );

        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`    Processed ${i + 1}/${numScans} scans...`);
        }
      }
    }

    // Update user's last_active_at
    await pool.query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [user.id]
    );
  }

  console.log('\n✓ Mock data generation complete!');
  console.log(`\nSummary:`);
  console.log(`  - ${NUM_MONTHS} months of data`);
  console.log(`  - ${DEMO_USERS.length} demo users`);
  console.log(`  - Total scans: ~${DEMO_USERS.reduce((acc, user) => {
    const min = user.scansPerMonth.min;
    const max = user.scansPerMonth.max;
    return acc + ((min + max) / 2) * NUM_MONTHS;
  }, 0).toFixed(0)}`);
}

main().catch(console.error);
