/**
 * Phase 5 End-to-End Tests for submitScan with Fingerprint Deduplication
 * Tests the complete flow: first scan, re-import, delta tracking, and audit history
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { computeFingerprint, computeReimportDelta, type NormalizedFinding } from "../src/scans/reimportLogic";

const prisma = new PrismaClient();

describe("Phase 5: submitScan with Fingerprint Deduplication", () => {
  let userId: string;
  let testUser: any;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `test-phase5-${Date.now()}@vibescan.test`,
        passwordHash: "hashed_password",
        plan: "free_trial",
        region: "OTHER",
        monthlyQuotaLimit: 100,
        monthlyQuotaUsed: 0,
        quotaResetDate: new Date(),
      },
    });
    userId = testUser.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.findingHistory.deleteMany({ where: { finding: { userId } } });
    await prisma.finding.deleteMany({ where: { userId } });
    await prisma.scanDelta.deleteMany({ where: { scan: { userId } } });
    await prisma.scan.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { email: testUser.email } });
    await prisma.$disconnect();
  });

  describe("First Scan (No Previous)", () => {
    it("should create scan with all findings marked as new", async () => {
      // Create first scan
      const scan = await prisma.scan.create({
        data: {
          userId,
          inputType: "source_zip",
          inputRef: "test-repo-first.zip",
          status: "pending",
          components: [],
          planAtSubmission: "starter",
        },
      });

      // Create ScanDelta
      const delta = await prisma.scanDelta.create({
        data: {
          scanId: scan.id,
          totalFreeCount: 0,
          totalEnterpriseCount: 0,
          deltaCount: 0,
          deltaBySeverity: {},
          isLocked: false,
        },
      });

      // Create mock findings
      const findings = [
        {
          cveId: "CVE-2024-1001",
          packageName: "lodash",
          installedVersion: "4.17.20",
          filePath: "node_modules/lodash/index.js",
          severity: "high",
          cvssScore: 7.5,
          fixedVersion: "4.17.21",
          description: "Prototype pollution",
          source: "free" as const,
          detectedData: {},
        },
        {
          cveId: "CVE-2024-1002",
          packageName: "express",
          installedVersion: "4.18.0",
          filePath: "node_modules/express/index.js",
          severity: "medium",
          cvssScore: 5.3,
          fixedVersion: "4.18.1",
          description: "DoS vulnerability",
          source: "free" as const,
          detectedData: {},
        },
      ];

      // Create findings in DB
      for (const finding of findings) {
        const fingerprint = computeFingerprint(finding);
        await prisma.finding.create({
          data: {
            scanId: scan.id,
            userId,
            fingerprint,
            cveId: finding.cveId,
            packageName: finding.packageName,
            installedVersion: finding.installedVersion,
            filePath: finding.filePath,
            severity: finding.severity,
            cvssScore: finding.cvssScore,
            fixedVersion: finding.fixedVersion,
            description: finding.description,
            source: finding.source,
            detectedData: finding.detectedData,
            status: "active",
          },
        });
      }

      // Update delta
      await prisma.scanDelta.update({
        where: { id: delta.id },
        data: {
          totalFreeCount: findings.length,
          totalEnterpriseCount: 0,
          deltaCount: findings.length,
          reimportSummary: {
            new_count: findings.length,
            mitigated_count: 0,
            updated_count: 0,
            unchanged_count: 0,
          },
        },
      });

      // Verify
      const scanWithFindings = await prisma.scan.findUnique({
        where: { id: scan.id },
        include: { findings: true, scanDeltas: true },
      });

      expect(scanWithFindings?.findings).toHaveLength(2);
      expect(scanWithFindings?.findings[0].status).toBe("active");
      expect(scanWithFindings?.scanDeltas[0].totalFreeCount).toBe(2);
    });
  });

  describe("Re-Import Scan (Fingerprint Matching)", () => {
    it("should deduplicate findings by fingerprint across scans", async () => {
      // Create first scan
      const scan1 = await prisma.scan.create({
        data: {
          userId,
          inputType: "source_zip",
          inputRef: "test-repo-reimport.zip",
          status: "done",
          components: [],
          planAtSubmission: "starter",
        },
      });

      // Create delta for scan1
      const delta1 = await prisma.scanDelta.create({
        data: {
          scanId: scan1.id,
          totalFreeCount: 2,
          totalEnterpriseCount: 0,
          deltaCount: 2,
          deltaBySeverity: {},
          isLocked: false,
        },
      });

      // Create initial findings in scan1
      const oldFindings: NormalizedFinding[] = [
        {
          cveId: "CVE-2024-2001",
          packageName: "lodash",
          installedVersion: "4.17.20",
          filePath: "node_modules/lodash/index.js",
          severity: "high",
          cvssScore: 7.5,
          fixedVersion: "4.17.20", // Not fixed yet
          description: "Prototype pollution",
          source: "free",
          detectedData: {},
        },
        {
          cveId: "CVE-2024-2002",
          packageName: "express",
          installedVersion: "4.18.0",
          filePath: "node_modules/express/index.js",
          severity: "medium",
          cvssScore: 5.3,
          fixedVersion: "4.18.0",
          description: "DoS",
          source: "free",
          detectedData: {},
        },
      ];

      for (const finding of oldFindings) {
        const fingerprint = computeFingerprint(finding);
        await prisma.finding.create({
          data: {
            scanId: scan1.id,
            userId,
            fingerprint,
            cveId: finding.cveId,
            packageName: finding.packageName,
            installedVersion: finding.installedVersion,
            filePath: finding.filePath,
            severity: finding.severity,
            cvssScore: finding.cvssScore,
            fixedVersion: finding.fixedVersion,
            description: finding.description,
            source: finding.source,
            detectedData: finding.detectedData,
            status: "active",
          },
        });
      }

      // Now create scan2 (re-import with same repo)
      const scan2 = await prisma.scan.create({
        data: {
          userId,
          inputType: "source_zip",
          inputRef: "test-repo-reimport.zip",
          status: "pending",
          components: [],
          planAtSubmission: "starter",
        },
      });

      const delta2 = await prisma.scanDelta.create({
        data: {
          scanId: scan2.id,
          totalFreeCount: 0,
          totalEnterpriseCount: 0,
          deltaCount: 0,
          deltaBySeverity: {},
          isLocked: false,
        },
      });

      // New scan results: lodash fixed, express unchanged, new vuln added
      const newFindings: NormalizedFinding[] = [
        {
          cveId: "CVE-2024-2001",
          packageName: "lodash",
          installedVersion: "4.17.20",
          filePath: "node_modules/lodash/index.js",
          severity: "high", // Same severity
          cvssScore: 7.5,
          fixedVersion: "4.17.21", // Updated fix version from CVE DB
          description: "Prototype pollution",
          source: "free",
          detectedData: {},
        },
        {
          cveId: "CVE-2024-2002",
          packageName: "express",
          installedVersion: "4.18.0",
          filePath: "node_modules/express/index.js",
          severity: "medium",
          cvssScore: 5.3,
          fixedVersion: "4.18.0", // Unchanged
          description: "DoS",
          source: "free",
          detectedData: {},
        },
        // New vulnerability
        {
          cveId: "CVE-2024-2003",
          packageName: "react",
          installedVersion: "18.0.0",
          filePath: "node_modules/react/index.js",
          severity: "low",
          cvssScore: 3.1,
          fixedVersion: "18.1.0",
          description: "New React vulnerability",
          source: "free",
          detectedData: {},
        },
      ];

      // Compute delta
      const reimportDelta = computeReimportDelta(oldFindings, newFindings);

      // Verify delta counts
      expect(reimportDelta.new).toHaveLength(1); // CVE-2024-2003
      expect(reimportDelta.updated).toHaveLength(1); // CVE-2024-2001 (fix version changed)
      expect(reimportDelta.unchanged).toHaveLength(1); // CVE-2024-2002
      expect(reimportDelta.mitigated).toHaveLength(0); // No mitigated

      // Apply to DB: new findings
      for (const finding of reimportDelta.new) {
        const fingerprint = computeFingerprint(finding);
        await prisma.finding.create({
          data: {
            scanId: scan2.id,
            userId,
            fingerprint,
            cveId: finding.cveId,
            packageName: finding.packageName,
            installedVersion: finding.installedVersion,
            filePath: finding.filePath,
            severity: finding.severity,
            cvssScore: finding.cvssScore,
            fixedVersion: finding.fixedVersion,
            description: finding.description,
            source: finding.source,
            detectedData: finding.detectedData,
            status: "active",
          },
        });
      }

      // Update existing findings for severity/fix changes
      for (const change of reimportDelta.updated) {
        const oldFinding = await prisma.finding.findFirst({
          where: {
            cveId: change.findingId,
            scanId: scan1.id,
          },
        });

        if (oldFinding) {
          await prisma.finding.update({
            where: { id: oldFinding.id },
            data: {
              severity: change.newSeverity,
              fixedVersion: change.newFixVersion,
            },
          });

          // Log history
          await prisma.findingHistory.create({
            data: {
              findingId: oldFinding.id,
              event: "severity_changed",
              prevValue: change.prevSeverity,
              newValue: change.newSeverity,
              metadata: {
                prevFixVersion: change.prevFixVersion,
                newFixVersion: change.newFixVersion,
              },
            },
          });
        }
      }

      // Update delta summary
      await prisma.scanDelta.update({
        where: { id: delta2.id },
        data: {
          totalFreeCount: reimportDelta.new.length,
          deltaCount: reimportDelta.new.length,
          reimportSummary: {
            new_count: reimportDelta.new.length,
            mitigated_count: reimportDelta.mitigated.length,
            updated_count: reimportDelta.updated.length,
            unchanged_count: reimportDelta.unchanged.length,
          },
        },
      });

      // Verify results
      const updatedFinding = await prisma.finding.findFirst({
        where: { cveId: "CVE-2024-2001", scanId: scan1.id },
      });

      expect(updatedFinding?.fixedVersion).toBe("4.17.21");

      const history = await prisma.findingHistory.findMany({
        where: { findingId: updatedFinding?.id },
      });

      expect(history).toHaveLength(1);
      expect(history[0].event).toBe("severity_changed");

      const scan2WithFindings = await prisma.scan.findUnique({
        where: { id: scan2.id },
        include: { findings: true, scanDeltas: true },
      });

      expect(scan2WithFindings?.findings).toHaveLength(1); // Only new finding
      expect(scan2WithFindings?.scanDeltas[0].reimportSummary).toEqual({
        new_count: 1,
        mitigated_count: 0,
        updated_count: 1,
        unchanged_count: 1,
      });
    });
  });

  describe("Mitigated Findings", () => {
    it("should mark findings as mitigated when they disappear in next scan", async () => {
      // Create first scan with vulnerability
      const scan1 = await prisma.scan.create({
        data: {
          userId,
          inputType: "source_zip",
          inputRef: "test-repo-mitigated.zip",
          status: "done",
          components: [],
          planAtSubmission: "starter",
        },
      });

      await prisma.scanDelta.create({
        data: {
          scanId: scan1.id,
          totalFreeCount: 1,
          totalEnterpriseCount: 0,
          deltaCount: 1,
          deltaBySeverity: {},
          isLocked: false,
        },
      });

      const oldFindings: NormalizedFinding[] = [
        {
          cveId: "CVE-2024-3001",
          packageName: "vulnerable-lib",
          installedVersion: "1.0.0",
          filePath: "node_modules/vulnerable-lib/index.js",
          severity: "critical",
          cvssScore: 9.8,
          fixedVersion: "2.0.0",
          description: "Critical vulnerability",
          source: "free",
          detectedData: {},
        },
      ];

      const finding = await prisma.finding.create({
        data: {
          scanId: scan1.id,
          userId,
          fingerprint: computeFingerprint(oldFindings[0]),
          cveId: oldFindings[0].cveId,
          packageName: oldFindings[0].packageName,
          installedVersion: oldFindings[0].installedVersion,
          filePath: oldFindings[0].filePath,
          severity: oldFindings[0].severity,
          cvssScore: oldFindings[0].cvssScore,
          fixedVersion: oldFindings[0].fixedVersion,
          description: oldFindings[0].description,
          source: oldFindings[0].source,
          detectedData: oldFindings[0].detectedData,
          status: "active",
        },
      });

      // Second scan: vulnerability is fixed (not found)
      const scan2 = await prisma.scan.create({
        data: {
          userId,
          inputType: "source_zip",
          inputRef: "test-repo-mitigated.zip",
          status: "pending",
          components: [],
          planAtSubmission: "starter",
        },
      });

      const delta2 = await prisma.scanDelta.create({
        data: {
          scanId: scan2.id,
          totalFreeCount: 0,
          totalEnterpriseCount: 0,
          deltaCount: 0,
          deltaBySeverity: {},
          isLocked: false,
        },
      });

      // New scan has no findings (vulnerability mitigated)
      const newFindings: NormalizedFinding[] = [];

      const reimportDelta = computeReimportDelta(oldFindings, newFindings);

      expect(reimportDelta.mitigated).toHaveLength(1);

      // Apply: mark as mitigated
      for (const item of reimportDelta.mitigated) {
        const existingFinding = await prisma.finding.findFirst({
          where: {
            cveId: item.findingId,
            scanId: scan1.id,
            status: "active",
          },
        });

        if (existingFinding) {
          await prisma.finding.update({
            where: { id: existingFinding.id },
            data: {
              status: "mitigated",
              mitigatedAt: item.mitigatedAt,
              mitigatedInScanId: scan2.id,
            },
          });

          await prisma.findingHistory.create({
            data: {
              findingId: existingFinding.id,
              event: "auto_mitigated",
              metadata: { mitigatedInScanId: scan2.id },
            },
          });
        }
      }

      // Verify
      const mitigatedFinding = await prisma.finding.findUnique({
        where: { id: finding.id },
      });

      expect(mitigatedFinding?.status).toBe("mitigated");
      expect(mitigatedFinding?.mitigatedInScanId).toBe(scan2.id);

      const history = await prisma.findingHistory.findMany({
        where: { findingId: finding.id },
      });

      expect(history).toHaveLength(1);
      expect(history[0].event).toBe("auto_mitigated");
    });
  });

  describe("Fingerprint Determinism", () => {
    it("should generate identical fingerprints for same findings", async () => {
      const finding: NormalizedFinding = {
        cveId: "CVE-2024-4001",
        packageName: "test-lib",
        installedVersion: "1.2.3",
        filePath: "src/lib.ts",
        severity: "high", // Should not affect fingerprint
        cvssScore: 7.5, // Should not affect fingerprint
        fixedVersion: "1.2.4", // Should not affect fingerprint
        description: "Test vulnerability", // Should not affect fingerprint
        source: "free",
        detectedData: {},
      };

      const fp1 = computeFingerprint(finding);
      const fp2 = computeFingerprint(finding);

      expect(fp1).toBe(fp2);

      // Changing severity should NOT change fingerprint
      const findingWithDifferentSeverity = { ...finding, severity: "low" };
      const fp3 = computeFingerprint(findingWithDifferentSeverity);
      expect(fp1).toBe(fp3);

      // Changing CVE ID SHOULD change fingerprint
      const findingWithDifferentCVE = { ...finding, cveId: "CVE-2024-9999" };
      const fp4 = computeFingerprint(findingWithDifferentCVE);
      expect(fp1).not.toBe(fp4);
    });
  });
});
