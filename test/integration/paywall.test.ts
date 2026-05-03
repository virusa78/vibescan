/**
 * Integration tests for report visibility in getReport operation
 * Tests that every plan tier receives full vulnerability details
 */

import { prisma } from 'wasp/server';
import { getReport } from '../../../wasp-app/src/server/operations/reports/getReport';

// Mock context with user
const createMockContext = (userId: string) => ({
  user: { id: userId, workspaceId: `workspace-${userId}` },
  entities: { Scan: prisma.scan, Finding: prisma.finding, ScanDelta: prisma.scanDelta },
});

describe('Report Visibility in getReport', () => {
  let userId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `test-paywall-${Date.now()}@example.com`,
        username: `test-paywall-${Date.now()}`,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  describe('Starter Plan Visibility', () => {
    it('should return full details for starter plan', async () => {
      // Create a scan with starter plan
      const scan = await prisma.scan.create({
        data: {
          userId,
          status: 'done',
          inputType: 'sbom_upload',
          inputRef: 'package.json',
          planAtSubmission: 'starter',
        },
      });

      // Create findings
      await prisma.finding.createMany({
        data: [
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-001-pkg1-v1',
            cveId: 'CVE-2024-0001',
            packageName: 'vulnerable-lib',
            installedVersion: '1.0.0',
            severity: 'CRITICAL',
            source: 'free',
            cvssScore: 9.8,
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-002-pkg2-v1',
            cveId: 'CVE-2024-0002',
            packageName: 'another-lib',
            installedVersion: '2.0.0',
            severity: 'HIGH',
            source: 'enterprise',
            cvssScore: 8.5,
          },
        ],
      });

      const context = createMockContext(userId);
      const report = await getReport({ scanId: scan.id }, context);

      // Verify full visibility
      expect(report.lockedView).toBe(false);
      expect(report.vulnerabilities).toBeDefined();
      expect(report.vulnerabilities).toHaveLength(2);
      expect(report.severity_breakdown).toBeDefined();
      expect(report.severity_breakdown.critical).toBe(1);
      expect(report.severity_breakdown.high).toBe(1);
      expect(report.total_free).toBe(1);
      expect(report.total_enterprise).toBe(1);

      // Cleanup
      await prisma.scan.delete({ where: { id: scan.id } });
    });
  });

  describe('Pro Plan Full Access', () => {
    it('should return full details for pro plan', async () => {
      // Create a scan with pro plan
      const scan = await prisma.scan.create({
        data: {
          userId,
          status: 'done',
          inputType: 'sbom_upload',
          inputRef: 'requirements.txt',
          planAtSubmission: 'pro',
        },
      });

      // Create findings
      await prisma.finding.createMany({
        data: [
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-003-pkg3-v1',
            cveId: 'CVE-2024-0003',
            packageName: 'django',
            installedVersion: '3.2.0',
            severity: 'HIGH',
            source: 'free',
            cvssScore: 8.0,
            description: 'SQL injection vulnerability',
            fixedVersion: '3.2.20',
          },
        ],
      });

      const context = createMockContext(userId);
      const report = await getReport({ scanId: scan.id }, context);

      // Verify full access
      expect(report.lockedView).toBe(false);
      expect(report.vulnerabilities).toBeDefined();
      expect(report.vulnerabilities?.length).toBe(1);
      expect(report.vulnerabilities?.[0]).toMatchObject({
        cveId: 'CVE-2024-0003',
        packageName: 'django',
        severity: 'HIGH',
        description: 'SQL injection vulnerability',
      });

      // Cleanup
      await prisma.scan.delete({ where: { id: scan.id } });
    });
  });

  describe('Enterprise Plan Full Access', () => {
    it('should return full details for enterprise plan', async () => {
      // Create a scan with enterprise plan
      const scan = await prisma.scan.create({
        data: {
          userId,
          status: 'done',
          inputType: 'github_app',
          inputRef: 'repo-scan',
          planAtSubmission: 'enterprise',
        },
      });

      // Create findings from both scanners
      await prisma.finding.createMany({
        data: [
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-004-pkg4-v1',
            cveId: 'CVE-2024-0004',
            packageName: 'log4j',
            installedVersion: '2.14.0',
            severity: 'CRITICAL',
            source: 'free',
            cvssScore: 10.0,
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-005-pkg5-v1',
            cveId: 'CVE-2024-0005',
            packageName: 'custom-lib',
            installedVersion: '1.0.0',
            severity: 'MEDIUM',
            source: 'enterprise',
            cvssScore: 6.5,
          },
        ],
      });

      const context = createMockContext(userId);
      const report = await getReport({ scanId: scan.id }, context);

      // Verify full access with delta
      expect(report.lockedView).toBe(false);
      expect(report.vulnerabilities).toBeDefined();
      expect(report.vulnerabilities?.length).toBe(2);
      expect(report.total_free).toBe(1);
      expect(report.total_enterprise).toBe(1);

      // Cleanup
      await prisma.scan.delete({ where: { id: scan.id } });
    });
  });

  describe('Free Trial Plan Visibility', () => {
    it('should return full details for free_trial plan', async () => {
      // Create a scan with free_trial plan
      const scan = await prisma.scan.create({
        data: {
          userId,
          status: 'done',
          inputType: 'source_zip',
          inputRef: 'app.zip',
          planAtSubmission: 'free_trial',
        },
      });

      // Create findings
      await prisma.finding.create({
        data: {
          scanId: scan.id,
          userId,
          fingerprint: 'cve-006-pkg6-v1',
          cveId: 'CVE-2024-0006',
          packageName: 'express',
          installedVersion: '4.17.0',
          severity: 'MEDIUM',
          source: 'free',
          cvssScore: 5.5,
        },
      });

      const context = createMockContext(userId);
      const report = await getReport({ scanId: scan.id }, context);

      // Verify full visibility
      expect(report.lockedView).toBe(false);
      expect(report.vulnerabilities).toBeDefined();
      expect(report.vulnerabilities).toHaveLength(1);
      expect(report.severity_breakdown.medium).toBe(1);
      expect(report.total_free).toBe(1);

      // Cleanup
      await prisma.scan.delete({ where: { id: scan.id } });
    });
  });

  describe('Severity Breakdown Accuracy', () => {
    it('should correctly calculate severity breakdown', async () => {
      // Create a scan
      const scan = await prisma.scan.create({
        data: {
          userId,
          status: 'done',
          inputType: 'sbom_upload',
          inputRef: 'pom.xml',
          planAtSubmission: 'pro',
        },
      });

      // Create findings with various severity levels
      await prisma.finding.createMany({
        data: [
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-007-critical',
            cveId: 'CVE-2024-CRIT1',
            packageName: 'critical-lib',
            installedVersion: '1.0.0',
            severity: 'CRITICAL',
            source: 'free',
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-008-critical',
            cveId: 'CVE-2024-CRIT2',
            packageName: 'critical-lib2',
            installedVersion: '2.0.0',
            severity: 'CRITICAL',
            source: 'free',
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-009-high',
            cveId: 'CVE-2024-HIGH1',
            packageName: 'high-lib',
            installedVersion: '1.0.0',
            severity: 'HIGH',
            source: 'enterprise',
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-010-medium',
            cveId: 'CVE-2024-MED1',
            packageName: 'med-lib',
            installedVersion: '1.0.0',
            severity: 'MEDIUM',
            source: 'free',
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-011-low',
            cveId: 'CVE-2024-LOW1',
            packageName: 'low-lib',
            installedVersion: '1.0.0',
            severity: 'LOW',
            source: 'free',
          },
          {
            scanId: scan.id,
            userId,
            fingerprint: 'cve-012-info',
            cveId: 'CVE-2024-INFO1',
            packageName: 'info-lib',
            installedVersion: '1.0.0',
            severity: 'INFO',
            source: 'enterprise',
          },
        ],
      });

      const context = createMockContext(userId);
      const report = await getReport({ scanId: scan.id }, context);

      // Verify correct counts
      expect(report.severity_breakdown.critical).toBe(2);
      expect(report.severity_breakdown.high).toBe(1);
      expect(report.severity_breakdown.medium).toBe(1);
      expect(report.severity_breakdown.low).toBe(1);
      expect(report.severity_breakdown.info).toBe(1);

      // Cleanup
      await prisma.scan.delete({ where: { id: scan.id } });
    });
  });

  describe('Authorization Checks', () => {
    it('should reject unauthorized access', async () => {
      // Create a scan by one user
      const scan = await prisma.scan.create({
        data: {
          userId,
          status: 'done',
          inputType: 'sbom_upload',
          inputRef: 'package.json',
          planAtSubmission: 'pro',
        },
      });

      // Try to access as different user
      const otherUserId = 'different-user-id';
      const unauthorizedContext = createMockContext(otherUserId);

      // Should throw 403
      await expect(
        getReport({ scanId: scan.id }, unauthorizedContext)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Unauthorized',
      });

      // Cleanup
      await prisma.scan.delete({ where: { id: scan.id } });
    });

    it('should reject unauthenticated access', async () => {
      const context = {
        user: null, // Not authenticated
        entities: { Scan: prisma.scan },
      };

      await expect(
        getReport({ scanId: 'any-id' }, context)
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });
    });
  });
});
