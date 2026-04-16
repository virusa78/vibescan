/**
 * PR-07: Ingestion Pipeline Orchestrator - Test Suite
 * 
 * Tests for the complete ingestion pipeline integration
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ingestScanOutput,
  ingestFromJSON,
  getPipelineStatus,
  type IngestionContext,
} from "../src/ingestion/orchestrator";

describe("PR-07: Ingestion Pipeline Orchestrator", () => {
  let context: IngestionContext;

  beforeEach(() => {
    context = {
      scanId: "scan-001",
      userId: "user-001",
      scannerName: "grype",
      scannerVersion: "0.65.0",
      timestamp: new Date().toISOString(),
    };
  });

  describe("ingestScanOutput", () => {
    it("should ingest valid Grype output through full pipeline", async () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: {
              id: "CVE-2021-1234",
              severity: "high",
              dataSource: "nvd",
              cvssScore: 7.5,
            },
            artifact: {
              name: "express",
              version: "4.17.0",
              type: "npm",
            },
          },
        ],
      };

      const result = await ingestScanOutput(grypeOutput, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload).toBeDefined();
        expect(result.payload?.vulnerabilities).toBeDefined();
        expect(result.payload?.vulnerabilities.length).toBeGreaterThan(0);
        expect(result.payload?.stats).toBeDefined();
      }
    });

    it("should handle invalid scanner name", async () => {
      const output = { matches: [] };
      const result = await ingestScanOutput(output, "unknown-scanner", context);

      expect(result.success).toBe(false);
      expect(result.error?.stage).toBe("adapter");
      expect(result.error?.message).toContain("Unknown scanner");
    });

    it("should handle Trivy output", async () => {
      context.scannerName = "trivy";
      const trivyOutput = {
        Results: [
          {
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2021-5678",
                PkgName: "curl",
                PkgVersion: "7.68.0",
                Severity: "HIGH",
                CVSS: { nvd: { V3Score: 8.5 } },
              },
            ],
          },
        ],
      };

      const result = await ingestScanOutput(trivyOutput, "trivy", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.vulnerabilities.length).toBeGreaterThan(0);
      }
    });

    it("should handle Snyk output", async () => {
      context.scannerName = "snyk";
      const snykOutput = {
        vulnerabilities: [
          {
            name: "CVE-2021-9999",
            package: "lodash",
            version: "4.17.20",
            severity: "critical",
            cvssScore: 9.8,
          },
        ],
      };

      const result = await ingestScanOutput(snykOutput, "snyk", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.vulnerabilities.length).toBeGreaterThan(0);
      }
    });

    it("should handle OSV output", async () => {
      context.scannerName = "osv-scanner";
      const osvOutput = {
        results: [
          {
            packages: [
              {
                package: { name: "numpy", version: "1.19.0" },
                vulnerabilities: [
                  {
                    id: "GHSA-1234-5678-90ab",
                    severity: { type: "CVSS_V3", score: 7.2 },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await ingestScanOutput(osvOutput, "osv-scanner", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.vulnerabilities.length).toBeGreaterThan(0);
      }
    });

    it("should track ingestion metadata", async () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: {
              id: "CVE-2021-1111",
              severity: "medium",
              cvssScore: 5.3,
            },
            artifact: { name: "pkg", version: "1.0" },
          },
        ],
      };

      const result = await ingestScanOutput(grypeOutput, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.scanId).toBe(context.scanId);
        expect(result.payload?.scannerId).toBe("grype");
      }
    });

    it("should generate unified payload stats", async () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: {
              id: "CVE-2021-2222",
              severity: "high",
              cvssScore: 8.0,
            },
            artifact: { name: "pkg1", version: "1.0" },
          },
          {
            vulnerability: {
              id: "CVE-2021-3333",
              severity: "low",
              cvssScore: 2.0,
            },
            artifact: { name: "pkg2", version: "2.0" },
          },
        ],
      };

      const result = await ingestScanOutput(grypeOutput, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.stats).toBeDefined();
        expect(result.payload?.stats.vulnerabilityCount).toBe(2);
        expect(result.payload?.stats.severityCounts).toBeDefined();
      }
    });

    it("should handle empty output gracefully", async () => {
      const emptyOutput = { matches: [] };

      const result = await ingestScanOutput(emptyOutput, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.vulnerabilities.length).toBe(0);
      }
    });

    it("should catch parser errors", async () => {
      const invalidOutput = {
        matches: [
          {
            vulnerability: { id: "CVE-1" },
            artifact: { name: "", version: "" }, // Invalid: empty name/version
          },
        ],
      };

      const result = await ingestScanOutput(invalidOutput, "grype", context);

      // Even if validation fails, should report gracefully
      if (!result.success) {
        expect(result.error?.stage).toBeDefined();
        expect(result.error?.message).toBeTruthy();
      }
    });
  });

  describe("ingestFromJSON", () => {
    it("should parse JSON string and ingest", async () => {
      const jsonString = JSON.stringify({
        matches: [
          {
            vulnerability: {
              id: "CVE-2021-4444",
              severity: "high",
              cvssScore: 7.5,
            },
            artifact: { name: "express", version: "4.17.0" },
          },
        ],
      });

      const result = await ingestFromJSON(jsonString, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.vulnerabilities.length).toBeGreaterThan(0);
      }
    });

    it("should handle invalid JSON", async () => {
      const invalidJson = "{ invalid json }";

      const result = await ingestFromJSON(invalidJson, "grype", context);

      expect(result.success).toBe(false);
      expect(result.error?.stage).toBe("adapter");
    });
  });

  describe("getPipelineStatus", () => {
    it("should report pipeline health", () => {
      const status = getPipelineStatus();

      expect(status.stages).toContain("adapter");
      expect(status.stages).toContain("parser");
      expect(status.stages).toContain("validator");
      expect(status.stages).toContain("unifier");
      expect(status.version).toBe("1.0.0");
    });

    it("should list supported scanners", () => {
      const status = getPipelineStatus();

      expect(status.supportedScanners).toContain("grype");
      expect(status.supportedScanners).toContain("trivy");
      expect(status.supportedScanners).toContain("snyk");
      expect(status.supportedScanners).toContain("osv-scanner");
    });
  });

  describe("Error Propagation", () => {
    it("should report adapter errors clearly", async () => {
      const result = await ingestScanOutput({}, "nonexistent", context);

      expect(result.success).toBe(false);
      expect(result.error?.stage).toBe("adapter");
    });

    it("should include error details for debugging", async () => {
      const result = await ingestScanOutput({}, "invalid-scanner", context);

      expect(result.error?.details).toBeDefined();
    });
  });

  describe("Pipeline Completeness", () => {
    it("should process multiple vulnerabilities", async () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: { id: "CVE-1", severity: "high", cvssScore: 8.0 },
            artifact: { name: "pkg1", version: "1.0" },
          },
          {
            vulnerability: { id: "CVE-2", severity: "medium", cvssScore: 5.0 },
            artifact: { name: "pkg2", version: "2.0" },
          },
          {
            vulnerability: { id: "CVE-3", severity: "low", cvssScore: 2.0 },
            artifact: { name: "pkg3", version: "3.0" },
          },
        ],
      };

      const result = await ingestScanOutput(grypeOutput, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload?.vulnerabilities.length).toBe(3);
        expect(result.payload?.stats.vulnerabilityCount).toBe(3);
      }
    });

    it("should preserve severity mapping across pipeline", async () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: { id: "CVE-CRIT", severity: "critical", cvssScore: 9.9 },
            artifact: { name: "critical", version: "1.0" },
          },
          {
            vulnerability: { id: "CVE-HIGH", severity: "high", cvssScore: 8.0 },
            artifact: { name: "high", version: "1.0" },
          },
          {
            vulnerability: { id: "CVE-MED", severity: "medium", cvssScore: 5.0 },
            artifact: { name: "medium", version: "1.0" },
          },
        ],
      };

      const result = await ingestScanOutput(grypeOutput, "grype", context);

      expect(result.success).toBe(true);
      if (result.success) {
        const vulns = result.payload?.vulnerabilities || [];
        expect(vulns.some(v => v.severity.level === "critical")).toBe(true);
        expect(vulns.some(v => v.severity.level === "high")).toBe(true);
        expect(vulns.some(v => v.severity.level === "medium")).toBe(true);
      }
    });
  });
});
