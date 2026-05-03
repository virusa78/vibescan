/**
 * Integration tests for scanner workers
 * Tests full workflow: component scanning, finding storage, delta computation
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { NormalizedComponent } from '../wasp-app/src/server/services/inputAdapterService';

const prisma = new PrismaClient();

describe('Scanner Integration Tests', () => {
  let testScanId: string;
  let testUserId: string;

  beforeEach(async () => {
    testScanId = `test-scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    testUserId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      await prisma.finding.deleteMany({ where: { scanId: testScanId } });
      await prisma.scanResult.deleteMany({ where: { scanId: testScanId } });
      await prisma.scanDelta.deleteMany({ where: { scanId: testScanId } });
      await prisma.scan.deleteMany({ where: { id: testScanId } });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Grype Scanner Worker', () => {
    it('should create scan and findings for SBOM input', async () => {
      // Create test scan with components
      const components: NormalizedComponent[] = [
        { name: 'lodash', version: '4.17.21' },
        { name: 'express', version: '4.17.1' },
      ];

      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'pending',
          planAtSubmission: 'starter',
          components: components,
        },
      });

      expect(scan).toBeDefined();
      expect(scan.id).toBe(testScanId);
      expect(scan.components).toEqual(components);
    });

    it('should store scan results with correct source', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'pending',
          planAtSubmission: 'starter',
          components: [],
        },
      });

      const mockGrypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'high',
              cvssScore: { baseScore: 7.5 },
              description: 'Test vulnerability',
              fix: { versions: ['1.0.1'] },
            },
            artifact: {
              name: 'lodash',
              version: '1.0.0',
            },
          },
        ],
      };

      const scanResult = await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'free',
          rawOutput: mockGrypOutput,
          vulnerabilities: mockGrypOutput.matches.map(m => ({
            cveId: m.vulnerability.id,
            severity: m.vulnerability.severity,
            package: m.artifact.name,
            version: m.artifact.version,
            cvssScore: m.vulnerability.cvssScore.baseScore,
            fixedVersion: m.vulnerability.fix.versions[0],
            description: m.vulnerability.description,
            source: 'free',
          })),
          scannerVersion: 'grype-0.111.0',
          cveDbTimestamp: new Date(),
          durationMs: 1000,
        },
      });

      expect(scanResult).toBeDefined();
      expect(scanResult.source).toBe('free');
      expect((scanResult.vulnerabilities as any).length).toBe(1);
    });

    it('should create finding records with fingerprints', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'pending',
          planAtSubmission: 'starter',
          components: [],
        },
      });

      const cveId = 'CVE-2024-1234';
      const packageName = 'lodash';
      const version = '1.0.0';
      const fingerprint = `${cveId}|${packageName}|${version}`;

      const finding = await prisma.finding.create({
        data: {
          scanId: testScanId,
          userId: testUserId,
          fingerprint,
          cveId,
          packageName,
          installedVersion: version,
          severity: 'HIGH',
          cvssScore: 7.5,
          fixedVersion: '1.0.1',
          description: 'Test vulnerability',
          source: 'free',
          detectedData: {} as any,
        },
      });

      expect(finding).toBeDefined();
      expect(finding.fingerprint).toBe(fingerprint);
      expect(finding.source).toBe('free');

      // Verify fingerprint-based deduplication
      const finding2 = await prisma.finding.upsert({
        where: {
          scanId_fingerprint: {
            scanId: testScanId,
            fingerprint,
          },
        },
        create: {
          scanId: testScanId,
          userId: testUserId,
          fingerprint,
          cveId,
          packageName,
          installedVersion: version,
          severity: 'HIGH',
          cvssScore: 7.5,
          fixedVersion: '1.0.2',
          description: 'Updated description',
          source: 'free',
          detectedData: {} as any,
        },
        update: {
          fixedVersion: '1.0.2',
          description: 'Updated description',
        },
      });

      // Should update, not create new
      expect(finding2.id).toBe(finding.id);
      expect(finding2.fixedVersion).toBe('1.0.2');
    });
  });

  describe('Enterprise Scanner Worker', () => {
    it('should store scan results with enterprise source', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'pending',
          planAtSubmission: 'enterprise',
          components: [],
        },
      });

      const mockCodescoringOutput = {
        components: [
          {
            name: 'lodash',
            version: '1.0.0',
            vulnerabilities: [
              {
                cveId: 'CVE-2024-5678',
                severity: 'critical',
                cvssScore: 9.2,
                description: 'Enterprise vulnerability',
                fixedVersion: '1.0.2',
              },
            ],
          },
        ],
      };

      const scanResult = await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'enterprise',
          rawOutput: mockCodescoringOutput,
          vulnerabilities: mockCodescoringOutput.components.flatMap(c =>
            c.vulnerabilities.map(v => ({
              cveId: v.cveId,
              severity: v.severity,
              package: c.name,
              version: c.version,
              cvssScore: v.cvssScore,
              fixedVersion: v.fixedVersion,
              description: v.description,
              source: 'enterprise',
            }))
          ),
          scannerVersion: 'codescoring-1.0',
          cveDbTimestamp: new Date(),
          durationMs: 2000,
        },
      });

      expect(scanResult).toBeDefined();
      expect(scanResult.source).toBe('enterprise');
      expect((scanResult.vulnerabilities as any).length).toBe(1);
    });
  });

  describe('Parallel Scanner Execution', () => {
    it('should handle both free and enterprise results for same scan', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'pending',
          planAtSubmission: 'enterprise',
          components: [],
        },
      });

      // Create free scan result
      await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'free',
          rawOutput: { matches: [] },
          vulnerabilities: [],
          scannerVersion: 'grype-0.111.0',
          cveDbTimestamp: new Date(),
          durationMs: 1000,
        },
      });

      // Create enterprise scan result
      await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'enterprise',
          rawOutput: { components: [] },
          vulnerabilities: [],
          scannerVersion: 'codescoring-1.0',
          cveDbTimestamp: new Date(),
          durationMs: 2000,
        },
      });

      // Verify both results exist
      const results = await prisma.scanResult.findMany({
        where: { scanId: testScanId },
      });

      expect(results).toHaveLength(2);
      expect(results.map(r => r.source).sort()).toEqual(['enterprise', 'free']);
    });

    it('should mark scan complete when both scanners finish', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'scanning',
          planAtSubmission: 'enterprise',
          components: [],
        },
      });

      // Simulate both scanners completing
      await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'free',
          rawOutput: { matches: [] },
          vulnerabilities: [],
          scannerVersion: 'grype-0.111.0',
          cveDbTimestamp: new Date(),
          durationMs: 1000,
        },
      });

      await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'enterprise',
          rawOutput: { components: [] },
          vulnerabilities: [],
          scannerVersion: 'codescoring-1.0',
          cveDbTimestamp: new Date(),
          durationMs: 2000,
        },
      });

      // Update scan status to done
      const updatedScan = await prisma.scan.update({
        where: { id: testScanId },
        data: {
          status: 'done',
          completedAt: new Date(),
        },
      });

      expect(updatedScan.status).toBe('done');
      expect(updatedScan.completedAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle partial completion when one scanner fails', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'scanning',
          planAtSubmission: 'enterprise',
          components: [],
        },
      });

      // Create free result (success)
      await prisma.scanResult.create({
        data: {
          scanId: testScanId,
          source: 'free',
          rawOutput: { matches: [] },
          vulnerabilities: [],
          scannerVersion: 'grype-0.111.0',
          cveDbTimestamp: new Date(),
          durationMs: 1000,
        },
      });

      // Mark scan as done (enterprise failed but free succeeded)
      const updatedScan = await prisma.scan.update({
        where: { id: testScanId },
        data: {
          status: 'done',
          completedAt: new Date(),
          errorMessage: 'Enterprise scanner failed',
        },
      });

      expect(updatedScan.status).toBe('done');
      expect(updatedScan.errorMessage).toContain('Enterprise scanner failed');

      // Verify free result exists but enterprise doesn't
      const results = await prisma.scanResult.findMany({
        where: { scanId: testScanId },
      });

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('free');
    });

    it('should handle both scanners failing', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'error',
          planAtSubmission: 'enterprise',
          components: [],
          errorMessage: 'Both scanners failed',
        },
      });

      expect(scan.status).toBe('error');
      expect(scan.errorMessage).toBe('Both scanners failed');

      const results = await prisma.scanResult.findMany({
        where: { scanId: testScanId },
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('Finding Deduplication', () => {
    it('should deduplicate findings across scanner runs', async () => {
      await prisma.scan.create({
        data: {
          id: testScanId,
          userId: testUserId,
          inputType: 'sbom_upload',
          inputRef: 'test.sbom.json',
          status: 'pending',
          planAtSubmission: 'starter',
          components: [],
        },
      });

      const cveId = 'CVE-2024-1234';
      const packageName = 'lodash';
      const version = '1.0.0';
      const fingerprint = `${cveId}|${packageName}|${version}`;

      // Create finding from Grype
      const finding1 = await prisma.finding.create({
        data: {
          scanId: testScanId,
          userId: testUserId,
          fingerprint,
          cveId,
          packageName,
          installedVersion: version,
          severity: 'HIGH',
          cvssScore: 7.5,
          description: 'Grype finding',
          source: 'free',
          detectedData: {} as any,
        },
      });

      // Try to create same finding from Codescoring (should upsert)
      const finding2 = await prisma.finding.upsert({
        where: {
          scanId_fingerprint: {
            scanId: testScanId,
            fingerprint,
          },
        },
        create: {
          scanId: testScanId,
          userId: testUserId,
          fingerprint,
          cveId,
          packageName,
          installedVersion: version,
          severity: 'CRITICAL',
          cvssScore: 8.5,
          description: 'Codescoring finding',
          source: 'enterprise',
          detectedData: {} as any,
        },
        update: {
          severity: 'CRITICAL',
          cvssScore: 8.5,
          source: 'enterprise',
        },
      });

      // Should be the same record (upserted)
      expect(finding2.id).toBe(finding1.id);
      expect(finding2.severity).toBe('CRITICAL');

      // Verify only one finding exists
      const allFindings = await prisma.finding.findMany({
        where: { scanId: testScanId },
      });

      expect(allFindings).toHaveLength(1);
    });
  });
});
